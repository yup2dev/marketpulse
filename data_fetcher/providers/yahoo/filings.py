"""Yahoo Finance SEC Filings Model (standard CompanyFilings 경유)"""
from datetime import date as date_type
from typing import Optional, Dict, Any
from pydantic import Field
from data_fetcher.abstract_provider.standard_models.company_filings import (
    CompanyFilingsQueryParams,
    CompanyFilingsData,
)


class YFinanceFilingsQueryParams(CompanyFilingsQueryParams):
    """SEC 공시 조회 파라미터 (standard CompanyFilings 경유)"""
    symbol: str = Field(description="종목 코드")
    limit: int = Field(default=20, description="반환할 최대 레코드 수")


class YFinanceFilingData(CompanyFilingsData):
    """SEC 공시 데이터 (standard CompanyFilings 경유, yfinance 원본키 alias)"""

    __alias_dict__ = {
        "report_type": "type",
        "filing_date": "date",
        "report_url": "url",
    }

    # yahoo는 공시일/URL이 비어있을 수 있어 required→optional override
    filing_date: Optional[date_type] = Field(default=None, description="공시일")
    report_url: Optional[str] = Field(default=None, description="EDGAR 링크")
    title: Optional[str] = Field(default=None, description="공시 제목")
    exhibits: Optional[Dict[str, Any]] = Field(default=None, description="첨부 파일 목록")


"""Yahoo Finance SEC Filings Fetcher"""
import logging
from typing import Any, Dict, List, Optional
import yfinance as yf

from data_fetcher.abstract_provider.abstract.fetcher import Fetcher

log = logging.getLogger(__name__)


class YFinanceFilingsFetcher(Fetcher[YFinanceFilingsQueryParams, YFinanceFilingData]):

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> YFinanceFilingsQueryParams:
        return YFinanceFilingsQueryParams(**params)

    @staticmethod
    def extract_data(
        query: YFinanceFilingsQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        ticker = yf.Ticker(query.symbol)
        sec_filings = ticker.sec_filings
        if not sec_filings or len(sec_filings) == 0:
            return []
        return list(sec_filings[:query.limit])

    @staticmethod
    def transform_data(
        query: YFinanceFilingsQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any,
    ) -> List[YFinanceFilingData]:
        out: List[YFinanceFilingData] = []
        for f in data:
            d = f.get('date', '')
            if hasattr(d, 'isoformat'):
                d = d.isoformat()
            out.append(YFinanceFilingData(
                type=f.get('type', ''),
                title=f.get('title', ''),
                date=str(d) if d else '',
                url=f.get('edgarUrl', '') or f.get('url', ''),
                exhibits=f.get('exhibits'),
            ))
        return out
