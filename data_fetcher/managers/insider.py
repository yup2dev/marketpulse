"""
InsiderManager

내부자 거래 / 보유 현황 관련 데이터 조회.
"""
from typing import Dict, List, Optional

from data_fetcher.query_executor import QueryExecutor
from data_fetcher.fetchers.base import AnnotatedResult
from data_fetcher.models.yahoo.insider_trading import (
    YFinanceInsiderTransactionData,
    YFinanceInsiderHolderData,
)
from data_fetcher.models.polygon.insider_trading import InsiderTradingData


class InsiderManager:
    """내부자 거래 / 보유 데이터 관리"""

    # ── Yahoo ──────────────────────────────────────────────────────────────
    @classmethod
    async def yahoo_insider_trading(
        cls,
        symbol: str,
        limit: int = 50,
    ) -> List[YFinanceInsiderTransactionData]:
        """Yahoo Finance 내부자 거래 조회"""
        raw = await QueryExecutor.fetch(
            provider="yahoo",
            model="insider_trading",
            params={"symbol": symbol},
        )
        result = raw.result if isinstance(raw, AnnotatedResult) else raw
        return result[:limit]

    @classmethod
    async def yahoo_insider_holders(
        cls,
        symbol: str,
    ) -> List[YFinanceInsiderHolderData]:
        """Yahoo Finance 내부자 보유 현황 조회"""
        raw = await QueryExecutor.fetch(
            provider="yahoo",
            model="insider_holders",
            params={"symbol": symbol},
        )
        return raw.result if isinstance(raw, AnnotatedResult) else raw

    # ── Polygon ────────────────────────────────────────────────────────────
    @classmethod
    async def polygon_insider_trading(
        cls,
        symbol: str,
        limit: int = 50,
        credentials: Optional[Dict] = None,
    ) -> List[InsiderTradingData]:
        """Polygon 내부자 거래 조회"""
        raw = await QueryExecutor.fetch(
            provider="polygon",
            model="insider_trading",
            params={"symbol": symbol, "limit": limit},
            credentials=credentials,
        )
        result = raw.result if isinstance(raw, AnnotatedResult) else raw
        return result[:limit]
