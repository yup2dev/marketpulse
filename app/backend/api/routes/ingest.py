"""적재 데이터 수신(ingest) API — 로컬 배치 DB를 클라우드로 동기화하는 수신단.

로컬 PC에서 적재 배치(scripts/backfill_stk_stbd.py 등)가 채운 SQLite 테이블을
scripts/sync_db_to_cloud.py 가 읽어 이 API로 전송(bulk upsert)한다.
EAI식 별도 미들웨어 없이 REST로 단방향(로컬 → 클라우드) 연계한다.

인증: admin 로그인 JWT (require_admin).

엔드포인트:
    GET  /api/ingest/status          테이블별 행수·최신 base_ymd (증분 동기화 기준점)
    POST /api/ingest/{table}         rows bulk upsert (whitelist 테이블만)

upsert 규칙은 테이블별 설정(_TABLES)을 따른다:
    conflict   : 자연키(UNIQUE/PK) 충돌 시 나머지 컬럼 갱신
    replace_by : 해당 키 값 단위로 삭제 후 재삽입 (자연키 없는 스냅샷 테이블)
                 — 클라이언트는 같은 키의 행들을 반드시 한 요청에 담아 보내야 한다.
"""
from __future__ import annotations

import json
import logging
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import Boolean, Date, DateTime, JSON, func, select
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from app.backend.core.auth.dependencies import require_admin
from app.backend.core.db import get_db
from index_analyzer.models.orm.ingest import (
    MBS_IN_ARTICLE,
    MBS_IN_FINANCIAL_METRICS,
    MBS_IN_INDX_MEMBER,
    MBS_IN_INDX_STBD,
    MBS_IN_INSTI_HOLD,
    MBS_IN_INSTI_MST,
    MBS_IN_INSTI_PORT,
    MBS_IN_RESEARCH_RPT,
    MBS_IN_STBD_MST,
    MBS_IN_STK_PROFILE,
    MBS_IN_STK_RELATIONS,
    MBS_IN_STK_STBD,
)

log = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(require_admin)])

# 동기화 허용 테이블 whitelist — conflict(자연키 upsert) 또는 replace_by(교체) 중 하나.
_TABLES: Dict[str, Dict[str, Any]] = {
    "mbs_in_stbd_mst":          {"model": MBS_IN_STBD_MST,          "conflict": ["ticker_cd"]},
    "mbs_in_indx_stbd":         {"model": MBS_IN_INDX_STBD,         "conflict": ["indx_cd"]},
    "mbs_in_article":           {"model": MBS_IN_ARTICLE,           "conflict": ["news_id"]},
    "mbs_in_stk_stbd":          {"model": MBS_IN_STK_STBD,          "conflict": ["stk_cd", "base_ymd"]},
    "mbs_in_financial_metrics": {"model": MBS_IN_FINANCIAL_METRICS, "conflict": ["stk_cd", "base_ymd", "fiscal_period"]},
    "mbs_in_stk_profile":       {"model": MBS_IN_STK_PROFILE,       "conflict": ["stk_cd"]},
    "mbs_in_stk_relations":     {"model": MBS_IN_STK_RELATIONS,     "conflict": ["stk_cd", "related_cd", "relation_type"]},
    "mbs_in_indx_member":       {"model": MBS_IN_INDX_MEMBER,       "conflict": ["indx_cd", "stk_cd"]},
    "mbs_in_insti_mst":         {"model": MBS_IN_INSTI_MST,         "conflict": ["institution_key"]},
    "mbs_in_insti_port":        {"model": MBS_IN_INSTI_PORT,        "conflict": ["institution_key"]},
    "mbs_in_insti_hold":        {"model": MBS_IN_INSTI_HOLD,        "replace_by": "institution_key"},
    "mbs_in_research_rpt":      {"model": MBS_IN_RESEARCH_RPT,      "conflict": ["report_id"]},
}

_MAX_ROWS_PER_REQUEST = 5000


class IngestRequest(BaseModel):
    rows: List[Dict[str, Any]] = Field(..., max_length=_MAX_ROWS_PER_REQUEST)


def _coerce_row(model, row: Dict[str, Any]) -> Dict[str, Any]:
    """JSON 직렬화된 값(ISO 날짜 문자열, 0/1 불리언, JSON 문자열)을 컬럼 타입으로 복원.

    모델에 없는 키와 autoincrement PK(id)는 버린다. created_at/updated_at은
    수신 시점 기준으로 서버가 새로 기록한다.
    """
    cols = model.__table__.columns
    out: Dict[str, Any] = {}
    for key, value in row.items():
        if key not in cols or key in ("id", "created_at", "updated_at"):
            continue
        if value is None:
            out[key] = None
            continue
        col_type = cols[key].type
        if isinstance(col_type, DateTime):
            out[key] = datetime.fromisoformat(str(value)) if not isinstance(value, datetime) else value
        elif isinstance(col_type, Date):
            out[key] = date.fromisoformat(str(value)[:10]) if not isinstance(value, date) else value
        elif isinstance(col_type, Boolean):
            out[key] = bool(value)
        elif isinstance(col_type, JSON) and isinstance(value, str):
            out[key] = json.loads(value)
        else:
            out[key] = value
    return out


def _upsert(session: Session, model, conflict: List[str], rows: List[Dict[str, Any]]) -> int:
    """자연키 충돌 시 갱신하는 bulk upsert. 컬럼 구성이 같은 행끼리 묶어 executemany."""
    total = 0
    by_shape: Dict[tuple, List[Dict[str, Any]]] = {}
    for r in rows:
        by_shape.setdefault(tuple(sorted(r.keys())), []).append(r)

    for shape, group in by_shape.items():
        missing = [c for c in conflict if c not in shape]
        if missing:
            raise HTTPException(status_code=400, detail=f"rows missing conflict key(s): {missing}")
        stmt = sqlite_insert(model.__table__)
        update_cols = {c: stmt.excluded[c] for c in shape if c not in conflict}
        update_cols["updated_at"] = datetime.utcnow()
        stmt = stmt.on_conflict_do_update(index_elements=conflict, set_=update_cols)
        session.execute(stmt, group)
        total += len(group)
    return total


def _replace(session: Session, model, key_col: str, rows: List[Dict[str, Any]]) -> int:
    """키 값 단위 삭제 후 재삽입 — 같은 키의 전체 행이 한 요청에 있어야 한다."""
    keys = {r.get(key_col) for r in rows}
    if None in keys:
        raise HTTPException(status_code=400, detail=f"rows missing replace key '{key_col}'")
    col = getattr(model, key_col)
    session.query(model).filter(col.in_(keys)).delete(synchronize_session=False)
    session.execute(sqlite_insert(model.__table__), rows)
    return len(rows)


@router.get("/ingest/status")
async def ingest_status(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """테이블별 행수와 최신 base_ymd — 클라이언트가 증분 범위를 정하는 기준."""
    out: Dict[str, Any] = {}
    for name, cfg in _TABLES.items():
        model = cfg["model"]
        try:
            count = db.execute(select(func.count()).select_from(model.__table__)).scalar()
            info: Dict[str, Any] = {"rows": count}
            if "base_ymd" in model.__table__.columns:
                max_ymd = db.execute(select(func.max(model.__table__.c.base_ymd))).scalar()
                info["max_base_ymd"] = max_ymd.isoformat() if isinstance(max_ymd, date) else max_ymd
            out[name] = info
        except Exception as exc:  # 미생성 테이블 등 — 상태 조회는 fail-soft
            out[name] = {"error": str(exc)}
    return out


@router.post("/ingest/{table}")
async def ingest_rows(table: str, req: IngestRequest, db: Session = Depends(get_db)) -> Dict[str, Any]:
    cfg = _TABLES.get(table)
    if cfg is None:
        raise HTTPException(status_code=404, detail=f"unknown ingest table '{table}'")
    if not req.rows:
        return {"table": table, "upserted": 0}

    model = cfg["model"]
    try:
        rows = [_coerce_row(model, r) for r in req.rows]
    except (ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=400, detail=f"row parse error: {exc}") from exc

    try:
        if "conflict" in cfg:
            n = _upsert(db, model, cfg["conflict"], rows)
        else:
            n = _replace(db, model, cfg["replace_by"], rows)
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        log.exception("[ingest] %s upsert failed", table)
        raise HTTPException(status_code=500, detail=f"upsert failed: {exc}") from exc

    log.info("[ingest] %s: %d rows upserted", table, n)
    return {"table": table, "upserted": n}
