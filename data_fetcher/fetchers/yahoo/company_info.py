"""Yahoo Finance Company Info Fetcher"""
import logging
from typing import Any, Dict, List, Optional
import yfinance as yf

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.models.yahoo.company_info import (
    YFinanceCompanyInfoQueryParams,
    YFinanceCompanyInfoData
)

log = logging.getLogger(__name__)


class YFinanceCompanyInfoFetcher(Fetcher[YFinanceCompanyInfoQueryParams, YFinanceCompanyInfoData]):
    """Yahoo Finance 회사 정보 Fetcher"""

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> YFinanceCompanyInfoQueryParams:
        """쿼리 파라미터 변환"""
        return YFinanceCompanyInfoQueryParams(**params)

    @staticmethod
    def extract_data(
        query: YFinanceCompanyInfoQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        """Yahoo Finance에서 회사 정보 추출"""
        try:
            ticker = yf.Ticker(query.symbol)
            return ticker.info
        except Exception as e:
            log.error(f"Error fetching company info for {query.symbol}: {e}")
            raise

    @staticmethod
    def transform_data(
        query: YFinanceCompanyInfoQueryParams,
        data: Dict[str, Any],
        **kwargs: Any
    ) -> List[YFinanceCompanyInfoData]:
        """원시 데이터를 표준 모델로 변환 (alias_dict로 매핑)"""
        payload = {**(data or {}), "symbol": query.symbol}
        company_info = YFinanceCompanyInfoData.model_validate(payload)
        log.info(f"Fetched company info for {query.symbol}")
        return [company_info]
