"""Yahoo Finance Management Model"""
from typing import Optional, List, Dict, Any
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class YFinanceManagementQueryParams(BaseQueryParams):
    symbol: str = Field(description="종목 코드")


class YFinanceOfficerData(BaseData):
    """임원 정보"""
    name: str = Field(default="")
    title: str = Field(default="")
    age: Optional[int] = None
    total_pay: Optional[int] = None
    year_born: Optional[int] = None


class YFinanceManagementData(BaseData):
    """경영진 및 거버넌스 데이터"""
    symbol: str
    officers: List[YFinanceOfficerData] = Field(default_factory=list)
    governance: Dict[str, Any] = Field(default_factory=dict)
