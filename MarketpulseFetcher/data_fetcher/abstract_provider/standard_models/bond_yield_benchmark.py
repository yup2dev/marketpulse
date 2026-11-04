"""Standard Model: Bond Yield Benchmark (시장 채권 벤치마크 수익률)

개별 증권이 아니라 만기/상품별 시장 벤치마크 수익률 스냅샷(국고채 1·3·5·10년,
회사채, CD 등) 1행을 표현한다. provider는 이 클래스를 상속해 전용 필드를 추가한다.
"""
from typing import Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class BondYieldBenchmarkQueryParams(BaseQueryParams):
    """채권 벤치마크 수익률 조회 표준 파라미터 (스냅샷)."""


class BondYieldBenchmarkData(BaseData):
    """채권 벤치마크 수익률 — 만기/상품별 1행."""

    ticker_cd: str = Field(description="벤치마크 코드")
    ticker_nm: str = Field(description="벤치마크 이름")
    asset_type: str = Field(default="bond", description="자산 유형")
    bond_type: Optional[str] = Field(
        default=None, description="채권 유형 (treasury/corporate/msb/cd/call 등)"
    )
    maturity: Optional[str] = Field(default=None, description="만기 (예: 1Y, 3M, 30D)")
    yield_rate: Optional[float] = Field(default=None, description="수익률 (%)")
    country: str = Field(default="KR", description="국가 코드")
    curr: str = Field(default="KRW", description="통화")
    is_active: bool = Field(default=True, description="활성 여부")
