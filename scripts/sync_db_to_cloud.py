"""로컬 적재 DB → 클라우드 백엔드 동기화 배치.

로컬 SQLite(data/marketpulse.db)의 적재 테이블을 읽어 클라우드 백엔드의
/api/ingest/{table} 로 bulk upsert 전송한다. 적재 배치(backfill_stk_stbd.py 등)를
로컬에서 돌린 뒤 이 스크립트를 실행하면 클라우드 DB가 따라온다.

증분: base_ymd 컬럼이 있는 테이블은 서버의 max_base_ymd 이후 행만 보낸다
      (--full 로 전체 재전송). base_ymd 없는 마스터성 테이블은 항상 전체 upsert.

사용:
    python scripts/sync_db_to_cloud.py --email admin@x.com --password ...
    python scripts/sync_db_to_cloud.py --token <admin access_token>
    python scripts/sync_db_to_cloud.py --tables mbs_in_stk_stbd,mbs_in_stbd_mst
    python scripts/sync_db_to_cloud.py --base-url http://127.0.0.1:8000   # 로컬 테스트
    python scripts/sync_db_to_cloud.py --full                             # 전체 재전송

인증: admin 계정 JWT. --email/--password (또는 환경변수 MP_SYNC_EMAIL /
      MP_SYNC_PASSWORD)로 로그인하거나 --token 으로 직접 주입.
"""
from __future__ import annotations

import argparse
import logging
import os
import sqlite3
import sys
from itertools import groupby
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

import httpx

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("sync")

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "marketpulse.db"
DEFAULT_BASE_URL = "https://api.finance.dns-co.kr"
CHUNK_SIZE = 2000

# 서버 /api/ingest whitelist와 동일해야 한다 (app/backend/api/routes/ingest.py).
# group_by: 같은 키의 행이 반드시 한 요청에 담겨야 하는 교체(replace) 테이블.
TABLES: Dict[str, Dict[str, Any]] = {
    "mbs_in_stbd_mst":          {},
    "mbs_in_indx_stbd":         {},
    "mbs_in_article":           {"incremental": "base_ymd"},
    "mbs_in_stk_stbd":          {"incremental": "base_ymd"},
    "mbs_in_financial_metrics": {"incremental": "base_ymd"},
    "mbs_in_stk_profile":       {},
    "mbs_in_stk_relations":     {},
    "mbs_in_indx_member":       {},
    "mbs_in_insti_mst":         {},
    "mbs_in_insti_port":        {},
    "mbs_in_insti_hold":        {"group_by": "institution_key"},
    "mbs_in_research_rpt":      {},
}

_DROP_COLS = {"id", "created_at", "updated_at"}


def _login(client: httpx.Client, base_url: str, email: str, password: str) -> str:
    res = client.post(f"{base_url}/api/auth/login", json={"email": email, "password": password})
    res.raise_for_status()
    token = res.json().get("access_token")
    if not token:
        raise RuntimeError("login succeeded but no access_token in response")
    return token


def _read_rows(con: sqlite3.Connection, table: str, since: Optional[str], incr_col: Optional[str]) -> List[Dict[str, Any]]:
    cur = con.cursor()
    sql = f"SELECT * FROM {table}"
    params: tuple = ()
    if since and incr_col:
        sql += f" WHERE {incr_col} > ?"
        params = (since,)
    try:
        cur.execute(sql, params)
    except sqlite3.OperationalError as exc:  # 로컬에 없는 테이블은 스킵
        log.warning("  %s: skip (%s)", table, exc)
        return []
    cols = [d[0] for d in cur.description]
    return [
        {k: v for k, v in zip(cols, row) if k not in _DROP_COLS}
        for row in cur.fetchall()
    ]


def _chunks(rows: List[Dict[str, Any]], group_by: Optional[str]) -> Iterable[List[Dict[str, Any]]]:
    """CHUNK_SIZE 단위 분할. group_by 지정 시 같은 키의 행을 한 청크에 유지한다."""
    if not group_by:
        for i in range(0, len(rows), CHUNK_SIZE):
            yield rows[i:i + CHUNK_SIZE]
        return

    rows = sorted(rows, key=lambda r: str(r.get(group_by)))
    chunk: List[Dict[str, Any]] = []
    for _, grp in groupby(rows, key=lambda r: str(r.get(group_by))):
        grp = list(grp)
        if chunk and len(chunk) + len(grp) > CHUNK_SIZE:
            yield chunk
            chunk = []
        chunk.extend(grp)
    if chunk:
        yield chunk


def sync_table(
    client: httpx.Client,
    base_url: str,
    con: sqlite3.Connection,
    table: str,
    cfg: Dict[str, Any],
    server_status: Dict[str, Any],
    full: bool,
) -> int:
    incr_col = cfg.get("incremental")
    since = None
    if incr_col and not full:
        since = (server_status.get(table) or {}).get("max_base_ymd")

    rows = _read_rows(con, table, since, incr_col)
    if not rows:
        log.info("  %s: 보낼 행 없음 (since=%s)", table, since)
        return 0

    sent = 0
    for chunk in _chunks(rows, cfg.get("group_by")):
        res = client.post(f"{base_url}/api/ingest/{table}", json={"rows": chunk})
        if res.status_code != 200:
            raise RuntimeError(f"{table}: HTTP {res.status_code} — {res.text[:300]}")
        sent += res.json().get("upserted", 0)
        log.info("  %s: %d/%d rows", table, sent, len(rows))
    return sent


def main() -> int:
    ap = argparse.ArgumentParser(description="로컬 적재 DB를 클라우드 백엔드로 동기화")
    ap.add_argument("--base-url", default=os.getenv("MP_SYNC_BASE_URL", DEFAULT_BASE_URL))
    ap.add_argument("--email", default=os.getenv("MP_SYNC_EMAIL"))
    ap.add_argument("--password", default=os.getenv("MP_SYNC_PASSWORD"))
    ap.add_argument("--token", default=os.getenv("MP_SYNC_TOKEN"), help="admin access token (로그인 생략)")
    ap.add_argument("--tables", default=None, help="쉼표구분 테이블 목록 (기본: 전체)")
    ap.add_argument("--full", action="store_true", help="증분 무시하고 전체 재전송")
    ap.add_argument("--db", default=str(DB_PATH), help="로컬 SQLite 경로")
    args = ap.parse_args()

    base_url = args.base_url.rstrip("/")
    targets = list(TABLES) if not args.tables else [t.strip() for t in args.tables.split(",") if t.strip()]
    unknown = [t for t in targets if t not in TABLES]
    if unknown:
        log.error("알 수 없는 테이블: %s (지원: %s)", unknown, ", ".join(TABLES))
        return 1

    if not Path(args.db).exists():
        log.error("로컬 DB가 없습니다: %s", args.db)
        return 1

    with httpx.Client(timeout=120.0) as client:
        token = args.token
        if not token:
            if not (args.email and args.password):
                log.error("--token 또는 --email/--password (env MP_SYNC_EMAIL/MP_SYNC_PASSWORD) 필요")
                return 1
            token = _login(client, base_url, args.email, args.password)
            log.info("로그인 완료: %s", args.email)
        client.headers["Authorization"] = f"Bearer {token}"

        res = client.get(f"{base_url}/api/ingest/status")
        if res.status_code != 200:
            log.error("서버 상태 조회 실패: HTTP %s — %s", res.status_code, res.text[:300])
            return 1
        server_status = res.json()
        log.info("서버 상태: %s", {t: server_status.get(t) for t in targets})

        con = sqlite3.connect(args.db)
        try:
            total = 0
            for table in targets:
                log.info("▶ %s 동기화", table)
                total += sync_table(client, base_url, con, table, TABLES[table], server_status, args.full)
            log.info("✅ 완료 — 총 %d rows 전송", total)
        finally:
            con.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
