"""AlphaVantage Company Overview Fetcher"""
import logging
from typing import Any, Dict, List, Optional
import requests

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.models.alphavantage.company_overview import (
    CompanyOverviewQueryParams,
    CompanyOverviewData
)
from data_fetcher.utils.credentials import get_api_key

log = logging.getLogger(__name__)


class AlphaVantageCompanyOverviewFetcher(
    Fetcher[CompanyOverviewQueryParams, CompanyOverviewData]
):
    """AlphaVantage 기업 개요 Fetcher"""

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> CompanyOverviewQueryParams:
        """쿼리 파라미터 변환"""
        return CompanyOverviewQueryParams(**params)

    @staticmethod
    def extract_data(
        query: CompanyOverviewQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        """
        AlphaVantage API에서 기업 개요 데이터 추출

        Args:
            query: 쿼리 파라미터
            credentials: API 키 포함

        Returns:
            원시 JSON 데이터
        """
        api_key = get_api_key(
            credentials=credentials,
            api_name="AlphaVantage",
            env_var="ALPHAVANTAGE_API_KEY"
        )

        try:
            url = "https://www.alphavantage.co/query"
            params = {
                'function': 'OVERVIEW',
                'symbol': query.symbol.upper(),
                'apikey': api_key
            }

            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()

            # API 오류 체크
            if 'Error Message' in data:
                raise ValueError(f"AlphaVantage API Error: {data['Error Message']}")
            if 'Note' in data:
                raise ValueError(f"AlphaVantage API Limit: {data['Note']}")

            return data

        except Exception as e:
            log.error(f"Error fetching company overview: {e}")
            raise

    @staticmethod
    def transform_data(
        query: CompanyOverviewQueryParams,
        data: Dict[str, Any],
        **kwargs: Any
    ) -> List[CompanyOverviewData]:
        """
        원시 데이터를 표준 모델로 변환

        Args:
            query: 쿼리 파라미터
            data: AlphaVantage API 응답

        Returns:
            CompanyOverviewData 리스트
        """
        def safe_float(value):
            """문자열을 float로 안전하게 변환"""
            try:
                return float(value) if value and value != 'None' else None
            except (ValueError, TypeError):
                return None

        def safe_int(value):
            """문자열을 int로 안전하게 변환"""
            try:
                return int(float(value)) if value and value != 'None' else None
            except (ValueError, TypeError):
                return None

        try:
            overview = CompanyOverviewData(
                symbol=query.symbol.upper(),
                name=data.get('Name'),
                description=data.get('Description'),
                exchange=data.get('Exchange'),
                currency=data.get('Currency'),
                country=data.get('Country'),
                sector=data.get('Sector'),
                industry=data.get('Industry'),

                # 재무 정보
                market_cap=safe_int(data.get('MarketCapitalization')),
                ebitda=safe_int(data.get('EBITDA')),
                pe_ratio=safe_float(data.get('PERatio')),
                peg_ratio=safe_float(data.get('PEGRatio')),
                book_value=safe_float(data.get('BookValue')),
                dividend_per_share=safe_float(data.get('DividendPerShare')),
                dividend_yield=safe_float(data.get('DividendYield')),
                eps=safe_float(data.get('EPS')),
                revenue_per_share=safe_float(data.get('RevenuePerShareTTM')),
                profit_margin=safe_float(data.get('ProfitMargin')),
                operating_margin=safe_float(data.get('OperatingMarginTTM')),
                roe=safe_float(data.get('ReturnOnEquityTTM')),
                roa=safe_float(data.get('ReturnOnAssetsTTM')),

                # 성장성
                revenue_growth_yoy=safe_float(data.get('RevenuePerShareTTM')),
                earnings_growth_yoy=safe_float(data.get('QuarterlyEarningsGrowthYOY')),
                revenue_growth_quarterly=safe_float(data.get('QuarterlyRevenueGrowthYOY')),
                earnings_growth_quarterly=safe_float(data.get('QuarterlyEarningsGrowthYOY')),

                # 가격 정보
                week_52_high=safe_float(data.get('52WeekHigh')),
                week_52_low=safe_float(data.get('52WeekLow')),
                day_50_ma=safe_float(data.get('50DayMovingAverage')),
                day_200_ma=safe_float(data.get('200DayMovingAverage')),

                # 주식 정보
                shares_outstanding=safe_int(data.get('SharesOutstanding')),
                dividend_date=data.get('DividendDate'),
                ex_dividend_date=data.get('ExDividendDate'),

                # 애널리스트
                analyst_target_price=safe_float(data.get('AnalystTargetPrice'))
            )

            log.info(f"Fetched company overview for {query.symbol}")
            return [overview]

        except Exception as e:
            log.error(f"Error transforming company overview data: {e}")
            raise
