"""DB FX Rate Fetcher — 배치가 적재한 일별 환율(MBS_IN_FX_STBD) 조회.

요청 시 외부 API 를 부르지 않는다 (적재: MarketpulseBatch/jobs/collect_fx.py).
적재된 쌍이 없으면 역방향 쌍으로 계산한다 (KRW→USD = 1 / USDKRW). 같은 통화면 1.
환율이 없으면 빈 목록 — 다른 DB fetcher 와 같다.
"""
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.base_fetchers import DbFetcher
from data_fetcher.abstract_provider.standard_models.fx_rate import FxRateData, FxRateQueryParams
from data_fetcher.providers.database.schema import MBS_IN_FX_STBD


def _latest(session, fx_cd: str, on_or_before) -> Optional[MBS_IN_FX_STBD]:
    q = session.query(MBS_IN_FX_STBD).filter(MBS_IN_FX_STBD.fx_cd == fx_cd)
    if on_or_before is not None:
        q = q.filter(MBS_IN_FX_STBD.base_ymd <= on_or_before)
    return q.order_by(MBS_IN_FX_STBD.base_ymd.desc()).first()


def _float(v) -> Optional[float]:
    return None if v is None else float(v)


class DBFxRateFetcher(DbFetcher[FxRateQueryParams, List[FxRateData]]):
    """DB(MBS_IN_FX_STBD)에서 통화쌍 환율 조회."""

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> FxRateQueryParams:
        return FxRateQueryParams(**params)

    @classmethod
    def extract_data(
        cls,
        query: FxRateQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        if query.base == query.quote:
            return [{"date": query.date, "rate": 1.0}]
        with cls.db_session(**kwargs) as session:
            row = _latest(session, f"{query.base}{query.quote}", query.date)
            if row is not None:
                return [{"date": row.base_ymd, "rate": _float(row.rate),
                         "change_rate": _float(row.change_rate)}]
            row = _latest(session, f"{query.quote}{query.base}", query.date)
            if row is not None and _float(row.rate):
                return [{"date": row.base_ymd, "rate": _float(row.rate),
                         "change_rate": _float(row.change_rate), "inverted": True}]
        return []

    @staticmethod
    def transform_data(
        query: FxRateQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any,
    ) -> List[FxRateData]:
        out = []
        for r in data or []:
            rate, chg, inverted = r["rate"], r.get("change_rate"), r.get("inverted", False)
            if inverted:
                rate = 1 / rate
                # 역방향 등락률: (1/r1)/(1/r0) - 1 = 1/(1+c) - 1
                chg = round((1 / (1 + chg / 100) - 1) * 100, 4) if chg is not None and chg != -100 else None
            out.append(FxRateData(
                date=r.get("date"), base_currency=query.base, counter_currency=query.quote,
                rate=rate, change_percent=chg, inverted=inverted,
            ))
        return out
