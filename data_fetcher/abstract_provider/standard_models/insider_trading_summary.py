"""Standard Model: Insider Trading Summary (내부자 거래 집계)

개별 거래(insider_trading)와 달리, 종목 단위로 요약 지표(summary)와 거래 목록
(transactions)을 함께 담는 집계 래퍼의 공통 인터페이스.
"""
from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class InsiderTradingSummaryQueryParams(BaseQueryParams):
    """내부자 거래 집계 조회 표준 파라미터"""

    symbol: str = Field(description="종목 코드")
    limit: int = Field(default=50, description="최대 거래 수")


class InsiderTradingSummaryData(BaseData):
    """내부자 거래 집계 표준 데이터 (summary + transactions)"""

    symbol: str = Field(description="종목 코드")
    source: str = Field(default="", description="데이터 출처")
    summary: dict = Field(default_factory=dict, description="요약 지표")
    transactions: list = Field(default_factory=list, description="거래 목록")
