"""DB Equity Screener Fetcher — 종목 마스터 + 프로필 + 최신 재무지표를 붙여 조건으로 거른다.

    유니버스   MBS_IN_STBD_MST (활성 · 주식)
    규모 · 분류 MBS_IN_STK_PROFILE (없으면 마스터 값)
    재무       MBS_IN_FINANCIAL_METRICS 의 종목별 최신 행 — roe · roa · profit_margin 은 소수(0.32)로 적재돼 % 로 바꾼다

실시간 가격은 없다 — 가격 조건은 호출하는 쪽이 시세 provider 로 붙인 뒤 건다.
"""
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.base_fetchers import DbFetcher
from data_fetcher.abstract_provider.standard_models.equity_screener import (
    RANGE_FIELDS,
    EquityScreenerData,
    EquityScreenerQueryParams,
)
from data_fetcher.providers.database.schema import (
    MBS_IN_FINANCIAL_METRICS,
    MBS_IN_STBD_MST,
    MBS_IN_STK_PROFILE,
)


def _float(v) -> Optional[float]:
    return float(v) if v else None      # 0 은 '없음' 으로 본다 (적재 관례)


def _pct(v) -> Optional[float]:
    return float(v) * 100 if v is not None else None


def matches(row: Dict[str, Any], q: EquityScreenerQueryParams) -> bool:
    if q.market == "domestic" and row.get("currency") != "KRW":
        return False
    if q.market == "overseas" and row.get("currency") == "KRW":
        return False
    if q.sector:
        wanted = {s.strip().lower() for s in q.sector.split(",") if s.strip()}
        if (row.get("sector") or "").lower() not in wanted:
            return False
    if q.industry and (row.get("industry") or "").lower() != q.industry.lower():
        return False
    if q.exchange and (row.get("exchange") or "").upper() != q.exchange.upper():
        return False
    for f in RANGE_FIELDS:
        lo, hi, v = getattr(q, f"{f}_min"), getattr(q, f"{f}_max"), row.get(f)
        if (lo is not None or hi is not None) and v is None:
            return False
        if lo is not None and v < lo or hi is not None and v > hi:
            return False
    return True


class DBEquityScreenerFetcher(DbFetcher[EquityScreenerQueryParams, List[EquityScreenerData]]):

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> EquityScreenerQueryParams:
        return EquityScreenerQueryParams(**params)

    @classmethod
    def extract_data(cls, query: EquityScreenerQueryParams,
                     credentials: Optional[Dict[str, str]] = None, **kwargs: Any) -> List[Dict[str, Any]]:
        with cls.db_session(**kwargs) as session:
            masters = (session.query(MBS_IN_STBD_MST)
                       .filter(MBS_IN_STBD_MST.is_active == True)  # noqa: E712
                       .all())
            profiles = {p.stk_cd: p for p in session.query(MBS_IN_STK_PROFILE).all()}
            metrics: Dict[str, Any] = {}
            for m in (session.query(MBS_IN_FINANCIAL_METRICS)
                      .order_by(MBS_IN_FINANCIAL_METRICS.stk_cd, MBS_IN_FINANCIAL_METRICS.base_ymd.desc())):
                metrics.setdefault(m.stk_cd, m)
            rows = []
            for b in masters:
                if not b.ticker_cd or (b.asset_type or "stock") != "stock":
                    continue
                p, m = profiles.get(b.ticker_cd), metrics.get(b.ticker_cd)
                rows.append({
                    "symbol": b.ticker_cd,
                    "name": (p.stk_nm if p else b.ticker_nm) or b.ticker_cd,
                    "currency": (p.currency if p else b.curr) or "USD",
                    "sector": (p.sector if p else b.sector) or "",
                    "industry": (p.industry if p else b.industry) or "",
                    "exchange": (p.exchange if p else b.exchange) or "",
                    "market_cap": _float(p.market_cap) if p else None,
                    "beta": _float(p.beta) if p else None,
                    "pe_ratio": _float(m.pe_ratio) if m else None,
                    "pb_ratio": _float(m.pb_ratio) if m else None,
                    "roe": _pct(m.roe) if m else None,
                    "roa": _pct(m.roa) if m else None,
                    "profit_margin": _pct(m.profit_margin) if m else None,
                    "debt_to_equity": _float(m.debt_to_equity) if m else None,
                    "current_ratio": _float(m.current_ratio) if m else None,
                    "quick_ratio": _float(m.quick_ratio) if m else None,
                })
            return rows

    @staticmethod
    def transform_data(query: EquityScreenerQueryParams, data: List[Dict[str, Any]],
                       **kwargs: Any) -> List[EquityScreenerData]:
        rows = [r for r in data or [] if matches(r, query)]
        if query.limit:
            rows = rows[:query.limit]
        return [EquityScreenerData.model_validate(r) for r in rows]
