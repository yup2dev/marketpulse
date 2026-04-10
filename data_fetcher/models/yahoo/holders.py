"""Yahoo Finance Holders Model"""
from typing import Optional, List, Dict, Any
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class YFinanceHoldersQueryParams(BaseQueryParams):
    symbol: str = Field(description="종목 코드")


class YFinanceInstitutionalHolderData(BaseData):
    """기관 투자자 보유 데이터"""
    name: str = Field(default="")
    shares: int = Field(default=0)
    value: float = Field(default=0.0)
    pct_held: float = Field(default=0.0)
    pct_change: float = Field(default=0.0)
    date_reported: Optional[str] = None


class YFinanceHoldersData(BaseData):
    """보유 현황 통합 데이터"""
    symbol: str
    summary: Dict[str, Any] = Field(default_factory=dict)
    institutional: List[YFinanceInstitutionalHolderData] = Field(default_factory=list)
