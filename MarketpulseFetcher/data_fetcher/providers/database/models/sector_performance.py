"""DB Sector Performance Fetcher — 배치(build_market_stats)가 미리 묶어 둔 mbs_in_sector_perf 를 읽는다.

S&P 500 묶음(universe 'sp500')이 있으면 그것, 없으면 프로필 전체('all'). 섹터는 시가총액 합 큰 순,
종목은 적재된 시총 순 목록에서 top 개. 묶음 계산은 로컬 배치(MarketpulseBatch/index_analyzer/market_stats.py).
"""
import json
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.base_fetchers import DbFetcher
from data_fetcher.abstract_provider.standard_models.sector_performance import (
    SectorPerformanceData,
    SectorPerformanceQueryParams,
)
from data_fetcher.providers.database.schema import MBS_IN_SECTOR_PERF

_UNIVERSES = ("sp500", "all")   # 앞에 있는 것이 우선


class DBSectorPerformanceFetcher(DbFetcher[SectorPerformanceQueryParams, List[SectorPerformanceData]]):

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> SectorPerformanceQueryParams:
        return SectorPerformanceQueryParams(**params)

    @classmethod
    def extract_data(cls, query: SectorPerformanceQueryParams,
                     credentials: Optional[Dict[str, str]] = None, **kwargs: Any) -> List[Dict[str, Any]]:
        t = MBS_IN_SECTOR_PERF
        with cls.db_session(**kwargs) as session:
            for universe in _UNIVERSES:
                rows = session.query(t).filter(t.universe == universe).all()
                if rows:
                    return [
                        {"sector": r.sector, "count": r.stock_count,
                         "total_market_cap": float(r.total_market_cap or 0), "stocks": json.loads(r.stocks or "[]")}
                        for r in rows
                    ]
        return []

    @staticmethod
    def transform_data(query: SectorPerformanceQueryParams, data: List[Dict[str, Any]],
                       **kwargs: Any) -> List[SectorPerformanceData]:
        out = [SectorPerformanceData(**{**g, "stocks": g["stocks"][:query.top]}) for g in data or []]
        return sorted(out, key=lambda g: g.total_market_cap, reverse=True)
