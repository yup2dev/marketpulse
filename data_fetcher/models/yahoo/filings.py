"""Yahoo Finance SEC Filings Model"""
from typing import Optional, Dict, Any
from pydantic import Field
from data_fetcher.models.base import BaseQueryParams, BaseData


class YFinanceFilingsQueryParams(BaseQueryParams):
    symbol: str = Field(description="종목 코드")
    limit: int = Field(default=20, description="반환할 최대 레코드 수")


class YFinanceFilingData(BaseData):
    """SEC 공시 데이터"""
    type: str = Field(default="", description="공시 유형 (10-K, 10-Q, 8-K, ...)")
    title: str = Field(default="", description="공시 제목")
    date: str = Field(default="", description="공시일")
    url: str = Field(default="", description="EDGAR 링크")
    exhibits: Optional[Dict[str, Any]] = Field(default=None, description="첨부 파일 목록")
