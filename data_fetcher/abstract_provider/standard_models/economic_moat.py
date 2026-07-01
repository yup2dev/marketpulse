"""Standard Model: Economic Moat (경제적 해자 분석)"""
from typing import List, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class EconomicMoatYearData(BaseData):
    """연도별 해자 지표"""

    year: str = Field(description="연도")
    roe: Optional[float] = Field(default=None, description="자기자본이익률")
    roic: Optional[float] = Field(default=None, description="투하자본이익률")
    gross_margin: Optional[float] = Field(default=None, description="매출총이익률")
    op_margin: Optional[float] = Field(default=None, description="영업이익률")
    net_margin: Optional[float] = Field(default=None, description="순이익률")
    fcf_margin: Optional[float] = Field(default=None, description="잉여현금흐름률")


class EconomicMoatQueryParams(BaseQueryParams):
    """경제적 해자 조회 표준 파라미터"""

    symbol: str = Field(description="종목 코드")


class EconomicMoatData(BaseData):
    """경제적 해자 분석 표준 데이터"""

    symbol: str = Field(description="종목 코드")
    history: List[EconomicMoatYearData] = Field(default_factory=list, description="연도별 지표")
    moat_score: int = Field(default=0, description="해자 점수")
    # 기본/약한 해자 라벨은 'No Moat'. 'None' 문자열은 BaseData sanitizer가
    # None 으로 치환해 검증을 깨므로 사용하지 않는다.
    moat_type: str = Field(default="No Moat", description="해자 유형")
