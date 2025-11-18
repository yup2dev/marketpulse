"""Yahoo Finance Company Info Fetcher"""
import logging
from typing import Any, Dict, List, Optional
import yfinance as yf

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.models.yahoo.company_info import (
    CompanyInfoQueryParams,
    CompanyInfoData
)

log = logging.getLogger(__name__)


class YahooCompanyInfoFetcher(Fetcher[CompanyInfoQueryParams, CompanyInfoData]):
    """Yahoo Finance 회사 정보 Fetcher"""

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> CompanyInfoQueryParams:
        """쿼리 파라미터 변환"""
        return CompanyInfoQueryParams(**params)

    @staticmethod
    def extract_data(
        query: CompanyInfoQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        """
        Yahoo Finance에서 회사 정보 추출

        Args:
            query: 쿼리 파라미터
            credentials: 사용 안함

        Returns:
            회사 정보 딕셔너리
        """
        try:
            ticker = yf.Ticker(query.symbol)
            info = ticker.info
            return info

        except Exception as e:
            log.error(f"Error fetching company info for {query.symbol}: {e}")
            raise

    @staticmethod
    def transform_data(
        query: CompanyInfoQueryParams,
        data: Dict[str, Any],
        **kwargs: Any
    ) -> List[CompanyInfoData]:
        """
        원시 데이터를 표준 모델로 변환

        Args:
            query: 쿼리 파라미터
            data: 회사 정보 딕셔너리

        Returns:
            CompanyInfoData 리스트
        """
        try:
            company_info = CompanyInfoData(
                symbol=query.symbol,
                company_name=data.get('longName'),
                sector=data.get('sector'),
                industry=data.get('industry'),
                country=data.get('country'),
                website=data.get('website'),
                description=data.get('longBusinessSummary'),

                # 시가총액
                market_cap=data.get('marketCap'),
                enterprise_value=data.get('enterpriseValue'),
                shares_outstanding=data.get('sharesOutstanding'),
                float_shares=data.get('floatShares'),

                # 재무 비율
                pe_ratio=data.get('trailingPE'),
                pb_ratio=data.get('priceToBook'),
                ps_ratio=data.get('priceToSalesTrailing12Months'),
                peg_ratio=data.get('pegRatio'),

                # 수익성
                profit_margin=data.get('profitMargins'),
                operating_margin=data.get('operatingMargins'),
                roe=data.get('returnOnEquity'),
                roa=data.get('returnOnAssets'),

                # 배당
                dividend_rate=data.get('dividendRate'),
                dividend_yield=data.get('dividendYield'),
                payout_ratio=data.get('payoutRatio'),

                # 가격
                current_price=data.get('currentPrice'),
                day_high=data.get('dayHigh'),
                day_low=data.get('dayLow'),
                week_52_high=data.get('fiftyTwoWeekHigh'),
                week_52_low=data.get('fiftyTwoWeekLow'),

                # 거래량
                volume=data.get('volume'),
                average_volume=data.get('averageVolume'),

                # 재무 건전성
                debt_to_equity=data.get('debtToEquity'),
                current_ratio=data.get('currentRatio'),
                quick_ratio=data.get('quickRatio'),

                # 성장성
                revenue_growth=data.get('revenueGrowth'),
                earnings_growth=data.get('earningsGrowth'),

                # 애널리스트
                target_price=data.get('targetMeanPrice'),
                recommendation=data.get('recommendationKey'),
                num_analysts=data.get('numberOfAnalystOpinions')
            )

            log.info(f"Fetched company info for {query.symbol}")
            return [company_info]

        except Exception as e:
            log.error(f"Error transforming company info: {e}")
            raise
