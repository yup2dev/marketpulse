"""Standard Model: Batch Quotes (다중 종목 배치 시세)

여러 심볼의 경량 시세를 한 번에 조회하는 배치 피드의 공통 인터페이스
(WS/랭킹 등 대량 조회용. 단일 시세 equity_quote 와 목적이 다름).
"""
from typing import List

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class BatchQuotesQueryParams(BaseQueryParams):
    """배치 시세 조회 표준 파라미터"""

    symbols: List[str] = Field(description="종목 코드 리스트")
    period: str = Field(default="5d", description="조회 기간")
    chunk_size: int = Field(default=50, description="배치 청크 크기")
    max_workers: int = Field(default=4, description="병렬 워커 수")
    mode: str = Field(default="live", description="live|period")


class BatchQuoteData(BaseData):
    """배치 시세 표준 데이터 (경량)"""

    symbol: str = Field(description="종목 코드")
    price: float = Field(description="현재가")
    change: float = Field(description="전일 대비 변화")
    change_percent: float = Field(description="전일 대비 변화율 (%)")
    volume: int = Field(default=0, description="거래량")
