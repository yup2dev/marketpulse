"""DB Sector Performance Fetcher — 종목 프로필(MBS_IN_STK_PROFILE)을 섹터로 묶는다.

S&P 500 편입 종목이 50개 이상 적재돼 있으면 그것만, 아니면 프로필 전체. 섹터는 시가총액 합 큰 순.
"""
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.base_fetchers import DbFetcher
from data_fetcher.abstract_provider.standard_models.sector_performance import (
    SectorPerformanceData,
    SectorPerformanceQueryParams,
)
from data_fetcher.providers.database.schema import MBS_IN_STK_PROFILE


class DBSectorPerformanceFetcher(DbFetcher[SectorPerformanceQueryParams, List[SectorPerformanceData]]):

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> SectorPerformanceQueryParams:
        return SectorPerformanceQueryParams(**params)

    @classmethod
    def extract_data(cls, query: SectorPerformanceQueryParams,
                     credentials: Optional[Dict[str, str]] = None, **kwargs: Any) -> List[Dict[str, Any]]:
        with cls.db_session(**kwargs) as session:
            base = session.query(MBS_IN_STK_PROFILE).filter(MBS_IN_STK_PROFILE.sector.isnot(None))
            sp500 = base.filter(MBS_IN_STK_PROFILE.in_sp500 == True).all()  # noqa: E712
            rows = sp500 if len(sp500) >= 50 else base.all()
            return [
                {"symbol": p.stk_cd, "name": p.stk_nm, "sector": p.sector or "Other", "industry": p.industry,
                 "market_cap": float(p.market_cap) if p.market_cap else 0,
                 "price": float(p.price) if p.price else None}
                for p in rows
            ]

    @staticmethod
    def transform_data(query: SectorPerformanceQueryParams, data: List[Dict[str, Any]],
                       **kwargs: Any) -> List[SectorPerformanceData]:
        groups: Dict[str, List[Dict[str, Any]]] = {}
        for s in data or []:
            groups.setdefault(s["sector"], []).append(s)
        out = [
            SectorPerformanceData(
                sector=sector, count=len(stocks), total_market_cap=sum(s["market_cap"] for s in stocks),
                stocks=sorted(stocks, key=lambda s: s["market_cap"], reverse=True)[:query.top],
            )
            for sector, stocks in groups.items()
        ]
        return sorted(out, key=lambda g: g.total_market_cap, reverse=True)
