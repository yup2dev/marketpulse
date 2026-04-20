"""
MarketManager

시장 데이터 (뉴스, 실적, 애널리스트, 배당, 검색) 관련 데이터 조회.
"""
from typing import Dict, List, Optional

from data_fetcher.query_executor import QueryExecutor
from data_fetcher.fetchers.base import AnnotatedResult
from data_fetcher.models.polygon.news import NewsData
from data_fetcher.models.polygon.earnings import EarningsData
from data_fetcher.models.fmp.analyst_recommendations import AnalystRecommendationsData
from data_fetcher.models.fmp.quote import QuoteData
from data_fetcher.models.fmp.search import FMPSearchData
from data_fetcher.models.fmp.active_stocks import FMPActiveStockData
from data_fetcher.models.yahoo.dividends import YFinanceDividendData


class MarketManager:
    """시장 데이터 관리"""

    # ── 뉴스 ──────────────────────────────────────────────────────────────
    @classmethod
    async def polygon_news_data(
        cls,
        ticker: Optional[str] = None,
        limit: int = 10,
        credentials: Optional[Dict] = None,
    ) -> List[NewsData]:
        """Polygon 뉴스 조회"""
        params: Dict = {"limit": limit}
        if ticker:
            params["ticker"] = ticker
        raw = await QueryExecutor.fetch(
            provider="polygon",
            model="news",
            params=params,
            credentials=credentials,
        )
        result = raw.result if isinstance(raw, AnnotatedResult) else raw
        return result[:limit]

    # ── 실적 ──────────────────────────────────────────────────────────────
    @classmethod
    async def polygon_earnings_data(
        cls,
        symbol: str,
        limit: int = 8,
        credentials: Optional[Dict] = None,
    ) -> List[EarningsData]:
        """Polygon 실적 조회"""
        raw = await QueryExecutor.fetch(
            provider="polygon",
            model="earnings",
            params={"symbol": symbol, "limit": limit},
            credentials=credentials,
        )
        result = raw.result if isinstance(raw, AnnotatedResult) else raw
        return result[:limit]

    # ── 애널리스트 ────────────────────────────────────────────────────────
    @classmethod
    async def fmp_analyst_recommendations_data(
        cls,
        symbol: str,
        limit: int = 10,
        credentials: Optional[Dict] = None,
    ) -> List[AnalystRecommendationsData]:
        """FMP 애널리스트 투자의견 조회"""
        raw = await QueryExecutor.fetch(
            provider="fmp",
            model="analyst_recommendations",
            params={"symbol": symbol, "limit": limit},
            credentials=credentials,
        )
        return raw.result if isinstance(raw, AnnotatedResult) else raw

    # ── 시세 ──────────────────────────────────────────────────────────────
    @classmethod
    async def fmp_quote_data(
        cls,
        symbol: str,
        credentials: Optional[Dict] = None,
    ) -> Optional[QuoteData]:
        """FMP 실시간 시세 조회"""
        raw = await QueryExecutor.fetch(
            provider="fmp",
            model="quote",
            params={"symbol": symbol},
            credentials=credentials,
        )
        result = raw.result if isinstance(raw, AnnotatedResult) else raw
        return result[0] if result else None

    # ── 검색 ──────────────────────────────────────────────────────────────
    @classmethod
    async def fmp_search_data(
        cls,
        query: str,
        limit: int = 10,
        credentials: Optional[Dict] = None,
    ) -> List[FMPSearchData]:
        """FMP 종목 검색"""
        raw = await QueryExecutor.fetch(
            provider="fmp",
            model="search",
            params={"query": query, "limit": limit},
            credentials=credentials,
        )
        return raw.result if isinstance(raw, AnnotatedResult) else raw

    # ── 시장 무버 (Most Actives / Gainers / Losers) ───────────────────────
    @classmethod
    async def fmp_most_actives_data(
        cls,
        credentials: Optional[Dict] = None,
    ) -> List[FMPActiveStockData]:
        """FMP Most Actives 조회"""
        raw = await QueryExecutor.fetch(
            provider="fmp",
            model="most_actives",
            params={},
            credentials=credentials,
        )
        return raw.result if isinstance(raw, AnnotatedResult) else raw

    @classmethod
    async def fmp_gainers_data(
        cls,
        credentials: Optional[Dict] = None,
    ) -> List[FMPActiveStockData]:
        """FMP Biggest Gainers 조회"""
        raw = await QueryExecutor.fetch(
            provider="fmp",
            model="gainers",
            params={},
            credentials=credentials,
        )
        return raw.result if isinstance(raw, AnnotatedResult) else raw

    @classmethod
    async def fmp_losers_data(
        cls,
        credentials: Optional[Dict] = None,
    ) -> List[FMPActiveStockData]:
        """FMP Biggest Losers 조회"""
        raw = await QueryExecutor.fetch(
            provider="fmp",
            model="losers",
            params={},
            credentials=credentials,
        )
        return raw.result if isinstance(raw, AnnotatedResult) else raw

    # ── 배당 ──────────────────────────────────────────────────────────────
    @classmethod
    async def yahoo_dividends_data(
        cls,
        symbol: str,
        limit: Optional[int] = None,
    ) -> List[YFinanceDividendData]:
        """Yahoo Finance 배당 이력 조회"""
        raw = await QueryExecutor.fetch(
            provider="yahoo",
            model="dividends",
            params={"symbol": symbol},
        )
        result = raw.result if isinstance(raw, AnnotatedResult) else raw
        return result[:limit] if limit else result
