"""시장 집계 — 기간별 수익률 · 섹터 성과를 로컬 DB 로 미리 계산한다.

서버(512MB)는 조회 때마다 종가를 모아 수익률을 계산하거나 섹터를 묶지 않는다. 이 모듈이 로컬에서 계산해
mbs_in_stk_period_rtn · mbs_in_sector_perf 에 적재하고, sync_db_to_cloud 가 /api/ingest 로 올린다.
서버의 db provider fetcher 는 그 행을 읽어 정렬만 한다.

  기간별 수익률  mbs_in_stk_stbd(일별 종가) → 종목 × 기간 한 행
                  1d          상태판의 전일 대비(change_rate) 그대로
                  1w ~ 1y     자기 최신일 종가 vs (최신일 - N일) 이하의 가장 최근 종가.
                              그런 과거가 없으면 자기 첫 거래일 종가 (상장 초기 종목)
                  거래일이 시장마다 달라(US 06-05 · KR 06-08) 전역 최신일이 아니라 종목별 최신일을 쓴다.
  섹터 성과      mbs_in_stk_profile → 섹터마다 종목 수 · 시총 합 · 시총 순 종목 목록
                  universe 'all'(프로필 전체)은 항상, 'sp500'(편입 종목)은 50종목 이상일 때만 만든다.
"""
from __future__ import annotations

import json
import logging
from datetime import date
from typing import Any, Dict, List, Optional

from sqlalchemy import text

log = logging.getLogger(__name__)

# 기간 → 일수 (달력 기준 근사; 그 이하의 가장 가까운 과거 거래일을 찾는다)
PERIOD_DAYS = {"1w": 7, "1mo": 30, "3mo": 90, "6mo": 180, "1y": 365}
SP500_MIN_STOCKS = 50

_LATEST_SQL = (
    "WITH span AS ("
    "  SELECT stk_cd, MAX(base_ymd) AS max_ymd, MIN(base_ymd) AS min_ymd"
    "  FROM mbs_in_stk_stbd WHERE close_price IS NOT NULL GROUP BY stk_cd"
    ") "
    "SELECT c.stk_cd, c.stk_nm, c.sector, c.curr, c.base_ymd, c.close_price, c.change_rate, s.min_ymd "
    "FROM span s JOIN mbs_in_stk_stbd c ON c.stk_cd = s.stk_cd AND c.base_ymd = s.max_ymd"
)

# 종목별 '자기 최신일 - N일' 이하의 가장 최근 종가 (idx_in_stk_cd_date (stk_cd, base_ymd) 인덱스 전제)
_REF_SQL = (
    "WITH span AS ("
    "  SELECT stk_cd, MAX(base_ymd) AS max_ymd"
    "  FROM mbs_in_stk_stbd WHERE close_price IS NOT NULL GROUP BY stk_cd"
    ") "
    "SELECT s.stk_cd, t.base_ymd, t.close_price "
    "FROM span s JOIN mbs_in_stk_stbd t ON t.stk_cd = s.stk_cd AND t.base_ymd = ("
    "  SELECT MAX(x.base_ymd) FROM mbs_in_stk_stbd x"
    "  WHERE x.stk_cd = s.stk_cd AND x.base_ymd < s.max_ymd"
    "    AND x.base_ymd <= date(s.max_ymd, :offset) AND x.close_price IS NOT NULL"
    ")"
)

_FIRST_SQL = (
    "SELECT t.stk_cd, t.base_ymd, t.close_price FROM mbs_in_stk_stbd t JOIN ("
    "  SELECT stk_cd, MIN(base_ymd) AS min_ymd FROM mbs_in_stk_stbd"
    "  WHERE close_price IS NOT NULL GROUP BY stk_cd"
    ") f ON f.stk_cd = t.stk_cd AND f.min_ymd = t.base_ymd"
)


def _f(v) -> Optional[float]:
    return float(v) if v is not None else None


def _d(v) -> Optional[date]:
    if v is None or isinstance(v, date):
        return v
    return date.fromisoformat(str(v)[:10])


def pct(cur: Optional[float], ref: Optional[float]) -> Optional[float]:
    if cur is None or not ref:
        return None
    return round((cur - ref) / ref * 100, 4)


def period_returns(session) -> List[Dict[str, Any]]:
    """종목 × 기간(1d · 1w · 1mo · 3mo · 6mo · 1y) 수익률 행."""
    latest = session.execute(text(_LATEST_SQL)).fetchall()
    first = {r[0]: (r[1], r[2]) for r in session.execute(text(_FIRST_SQL)).fetchall()}
    out: List[Dict[str, Any]] = []

    def row(stk, period, ref_ymd, ref_close, change):
        stk_cd, stk_nm, sector, curr, base_ymd, close = stk[:6]
        return {
            "stk_cd": stk_cd, "period": period, "stk_nm": stk_nm or stk_cd, "sector": sector or "",
            "curr": curr or "USD", "base_ymd": _d(base_ymd), "close_price": _f(close),
            "ref_ymd": _d(ref_ymd), "ref_close": _f(ref_close), "change_rate": change,
        }

    for stk in latest:
        out.append(row(stk, "1d", None, None, _f(stk[6])))

    for period, days in PERIOD_DAYS.items():
        refs = {r[0]: (r[1], r[2]) for r in session.execute(text(_REF_SQL), {"offset": f"-{days} day"}).fetchall()}
        for stk in latest:
            stk_cd, base_ymd = stk[0], stk[4]
            ref_ymd, ref_close = refs.get(stk_cd) or first.get(stk_cd) or (None, None)
            if ref_ymd is not None and str(ref_ymd) >= str(base_ymd):       # 첫 거래일 = 최신일 (하루치뿐)
                ref_ymd = ref_close = None
            out.append(row(stk, period, ref_ymd, ref_close, pct(_f(stk[5]), _f(ref_close))))
    return out


def sector_performance(session, today: Optional[date] = None) -> List[Dict[str, Any]]:
    """universe × 섹터 행 — 종목 수 · 시총 합 · 시총 큰 순 종목 목록(JSON)."""
    rows = session.execute(text(
        "SELECT stk_cd, stk_nm, sector, industry, market_cap, price, in_sp500 "
        "FROM mbs_in_stk_profile WHERE sector IS NOT NULL"
    )).fetchall()
    stocks = [
        {"symbol": r[0], "name": r[1], "sector": r[2] or "Other", "industry": r[3],
         "market_cap": float(r[4]) if r[4] else 0.0, "price": _f(r[5]), "_sp500": bool(r[6])}
        for r in rows
    ]
    universes = {"all": stocks}
    sp500 = [s for s in stocks if s["_sp500"]]
    if len(sp500) >= SP500_MIN_STOCKS:
        universes["sp500"] = sp500

    out = []
    for universe, members in universes.items():
        groups: Dict[str, List[Dict[str, Any]]] = {}
        for s in members:
            groups.setdefault(s["sector"], []).append({k: v for k, v in s.items() if k != "_sp500"})
        for sector, items in groups.items():
            items.sort(key=lambda s: s["market_cap"], reverse=True)
            out.append({
                "universe": universe, "sector": sector, "stock_count": len(items),
                "total_market_cap": round(sum(s["market_cap"] for s in items), 2),
                "stocks": json.dumps(items, ensure_ascii=False), "base_ymd": today or date.today(),
            })
    return out


def replace_table(session, model, rows: List[Dict[str, Any]]) -> int:
    """로컬 테이블을 통째로 바꾼다 (매일 다시 계산하는 집계라 증분이 없다)."""
    session.query(model).delete(synchronize_session=False)
    session.bulk_insert_mappings(model, rows)
    session.commit()
    return len(rows)


def build_all(db) -> Dict[str, int]:
    """기간별 수익률 · 섹터 성과를 계산해 로컬 DB 에 적재. 반환: 테이블별 행 수."""
    from index_analyzer.db.orm import MBS_IN_SECTOR_PERF, MBS_IN_STK_PERIOD_RTN

    session = db.get_session()
    try:
        n_rtn = replace_table(session, MBS_IN_STK_PERIOD_RTN, period_returns(session))
        n_sec = replace_table(session, MBS_IN_SECTOR_PERF, sector_performance(session))
        log.info("[market_stats] 기간별 수익률 %d행 · 섹터 성과 %d행", n_rtn, n_sec)
        return {"mbs_in_stk_period_rtn": n_rtn, "mbs_in_sector_perf": n_sec}
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
