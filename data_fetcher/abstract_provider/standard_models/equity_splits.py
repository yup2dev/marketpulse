"""Standard Model: Equity Splits (주식 분할 내역)"""
from typing import Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class EquitySplitsQueryParams(BaseQueryParams):
    """주식 분할 조회 표준 파라미터"""

    symbol: str = Field(description="종목 코드")
    limit: int = Field(default=20, description="반환할 최대 레코드 수")


class EquitySplitsData(BaseData):
    """주식 분할 표준 데이터"""

    date: str = Field(description="분할일 (YYYY-MM-DD)")
    ratio: float = Field(description="분할 비율")
    description: Optional[str] = Field(default=None, description="분할 설명 (예: 4:1 split)")
