"""DB Quote Fetcher — 배치가 적재한 일별 시세(MBS_IN_STK_STBD)의 종목별 마지막 행.

실시간이 아니다 — 마지막 적재일의 종가 · 등락률 · 거래량. symbol 은 쉼표로 여러 개.
"""
from datetime import date as dateType
from typing import Any, Dict, List, Optional

from pydantic import Field
from sqlalchemy import func

from data_fetcher.abstract_provider.abstract.base_fetchers import DbFetcher
from data_fetcher.abstract_provider.standard_models.equity_quote import (
    EquityQuoteData,
    EquityQuoteQueryParams,
)
from data_fetcher.providers.database.schema import MBS_IN_STK_STBD


class DBEquityQuoteData(EquityQuoteData):
    date: Optional[dateType] = Field(default=None, description="적재 기준일")
    sector: Optional[str] = Field(default=None, description="섹터")


def _float(v) -> Optional[float]:
    return None if v is None else float(v)


class DBEquityQuoteFetcher(DbFetcher[EquityQuoteQueryParams, List[DBEquityQuoteData]]):
    """DB(MBS_IN_STK_STBD) 종목별 마지막 적재 시세."""

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> EquityQuoteQueryParams:
        return EquityQuoteQueryParams(**params)

    @classmethod
    def extract_data(
        cls,
        query: EquityQuoteQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        codes = [c.strip() for c in query.symbol.split(",") if c.strip()]
        if not codes:
            return []
        with cls.db_session(**kwargs) as session:
            last = (
                session.query(MBS_IN_STK_STBD.stk_cd, func.max(MBS_IN_STK_STBD.base_ymd).label("d"))
                .filter(MBS_IN_STK_STBD.stk_cd.in_(codes))
                .group_by(MBS_IN_STK_STBD.stk_cd)
                .subquery()
            )
            rows = (
                session.query(MBS_IN_STK_STBD)
                .join(last, (MBS_IN_STK_STBD.stk_cd == last.c.stk_cd) & (MBS_IN_STK_STBD.base_ymd == last.c.d))
                .all()
            )
            return [
                {
                    "symbol": r.stk_cd, "name": r.stk_nm, "last_price": _float(r.close_price),
                    "change_percent": _float(r.change_rate), "volume": r.volume,
                    "currency": r.curr, "sector": r.sector, "date": r.base_ymd,
                }
                for r in rows
            ]

    @staticmethod
    def transform_data(
        query: EquityQuoteQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any,
    ) -> List[DBEquityQuoteData]:
        return [DBEquityQuoteData.model_validate(r) for r in data or []]
