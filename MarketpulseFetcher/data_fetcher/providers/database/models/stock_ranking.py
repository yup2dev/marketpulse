"""DB Stock Ranking Fetcher

배치(build_market_stats)가 미리 계산한 mbs_in_stk_period_rtn(종목 × 기간 수익률)을 읽어 정렬만 한다.
조회 때 종가를 모아 수익률을 계산하지 않는다 — 계산은 로컬 배치(MarketpulseBatch/index_analyzer/market_stats.py).

period: 1d(상태판 전일 대비) · 1w · 1mo · 3mo · 6mo · 1y

주의: 상태판 적재에 거래량이 없어 volume/trade_value는 0이다.
      (volume 기준 정렬은 realtime 탭의 라이브 경로에서만 의미가 있음)
"""
import logging
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.standard_models.stock_ranking import (
    StockRankingQueryParams,
    StockRankingData,
    in_market,
    rank,
)
from data_fetcher.abstract_provider.abstract.base_fetchers import DbFetcher
from data_fetcher.providers.database.schema import MBS_IN_STK_PERIOD_RTN

log = logging.getLogger(__name__)


class DBStockRankingQueryParams(StockRankingQueryParams):
    """DB 종목 랭킹 조회 파라미터 (standard StockRanking 경유)"""


class DBStockRankingData(StockRankingData):
    """DB 종목 랭킹 데이터 (standard StockRanking 경유)"""


class DBStockRankingFetcher(DbFetcher[DBStockRankingQueryParams, DBStockRankingData]):
    """mbs_in_stk_period_rtn 기간 수익률 기반 랭킹 (읽기 · 정렬만)."""

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> DBStockRankingQueryParams:
        return DBStockRankingQueryParams(**params)

    @classmethod
    def extract_data(
        cls,
        query: DBStockRankingQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        t = MBS_IN_STK_PERIOD_RTN
        with cls.db_session(**kwargs) as session:
            rows = (
                session.query(t.stk_cd, t.stk_nm, t.sector, t.curr, t.close_price, t.change_rate)
                .filter(t.period == query.period, t.close_price.isnot(None))
                .all()
            )
        return [
            {
                'stk_cd':      stk_cd,
                'stk_nm':      stk_nm or stk_cd,
                'curr':        curr or 'USD',
                'sector':      sector or '',
                'close_price': float(close),
                'change_rate': float(chg) if chg is not None else None,
                'volume':      0,
                'trade_value': 0.0,
            }
            for stk_cd, stk_nm, sector, curr, close, chg in rows
        ]

    @staticmethod
    def transform_data(
        query: DBStockRankingQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any,
    ) -> List[DBStockRankingData]:
        rows = rank((r for r in data or [] if in_market(r, query.market)), query.sort_by)
        if query.limit:
            rows = rows[:query.limit]
        results: List[DBStockRankingData] = []
        for item in rows:
            try:
                results.append(DBStockRankingData(**item))
            except Exception as exc:
                log.warning("[DBStockRankingFetcher] transform error: %s", exc)
        return results
