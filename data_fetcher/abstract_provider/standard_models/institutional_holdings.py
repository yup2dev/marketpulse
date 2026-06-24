"""Standard Model: Institutional Holdings (기관 13F 보유 현황)

특정 기관의 13F 포트폴리오(보유 종목 목록 + 분기 비교)의 공통 인터페이스.
sec/whalewisdom 등 여러 provider가 이 클래스를 상속/공유한다(멀티프로바이더).
"""
from typing import List, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams
from data_fetcher.abstract_provider.standard_models.institutions_list import InstitutionInfo


class InstitutionalHoldingsQueryParams(BaseQueryParams):
    """기관 보유 현황 조회 표준 파라미터"""

    institution_key: str = Field(description="기관 식별자 (예: 'berkshire', 'bridgewater')")
    limit: Optional[int] = Field(default=50, description="최대 보유 종목 수")
    summary_only: bool = Field(default=False, description="True이면 종목 목록 없이 요약만 반환")


class HoldingData(BaseData):
    """개별 보유 종목 데이터"""

    ticker: Optional[str] = Field(default=None, description="종목 심볼")
    cusip: Optional[str] = Field(default=None, description="CUSIP")
    name: Optional[str] = Field(default=None, description="종목명")
    shares: Optional[int] = Field(default=None, description="보유 주식 수")
    value: Optional[float] = Field(default=None, description="보유 가치 ($천)")
    percentage: Optional[float] = Field(default=None, description="포트폴리오 비중 (%)")
    change_shares: Optional[int] = Field(default=None, description="전분기 대비 주식 수 변화")
    change_pct: Optional[float] = Field(default=None, description="전분기 대비 변화율 (%)")
    action: Optional[str] = Field(default=None, description="변화 유형 (New, Add, Reduce, Sell)")


class InstitutionalHoldingsData(BaseData):
    """기관 보유 현황 표준 데이터"""

    institution: Optional[InstitutionInfo] = Field(default=None, description="기관 정보")
    period: Optional[str] = Field(default=None, description="보고 분기 (YYYY-MM-DD)")
    total_value: Optional[float] = Field(default=None, description="총 보유 가치 ($천)")
    total_holdings: Optional[int] = Field(default=None, description="총 보유 종목 수")
    holdings: List[HoldingData] = Field(default_factory=list, description="보유 종목 목록")
    prev_holdings: List[HoldingData] = Field(default_factory=list, description="전분기 보유 목록")
