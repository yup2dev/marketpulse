"""Standard Model: Company Management (경영진/거버넌스)"""
from typing import Any, Dict, List, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class CompanyOfficerData(BaseData):
    """임원 정보"""

    name: str = Field(default="", description="이름")
    title: str = Field(default="", description="직책")
    age: Optional[int] = Field(default=None, description="나이")
    total_pay: Optional[int] = Field(default=None, description="총 보수")
    year_born: Optional[int] = Field(default=None, description="출생연도")


class CompanyManagementQueryParams(BaseQueryParams):
    """경영진 조회 표준 파라미터"""

    symbol: str = Field(description="종목 코드")


class CompanyManagementData(BaseData):
    """경영진 및 거버넌스 표준 데이터"""

    symbol: str = Field(description="종목 코드")
    officers: List[CompanyOfficerData] = Field(default_factory=list, description="임원 목록")
    governance: Dict[str, Any] = Field(default_factory=dict, description="거버넌스 지표")
