"""Standard Model: Stock Sentiment (종목 감성 분석)

뉴스/소셜 등 출처별 감성 데이터의 공통 인터페이스. 공통 컬럼은 symbol + aggregate(종합
감성 지표)이며, provider는 이 클래스를 상속해 출처별 원시 데이터 필드를 추가한다.
(polygon=news/trend, social=stocktwits/reddit 등)
"""
from typing import Any, Dict

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class StockSentimentQueryParams(BaseQueryParams):
    """종목 감성 조회 표준 파라미터"""

    symbol: str = Field(description="종목 코드")


class StockSentimentData(BaseData):
    """종목 감성 표준 데이터 (공통: symbol + aggregate)"""

    symbol: str = Field(description="종목 코드")
    aggregate: Dict[str, Any] = Field(default_factory=dict, description="종합 감성 지표")
