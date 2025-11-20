"""FMP Analyst Estimates Fetcher"""
import logging
import requests
from datetime import datetime
from typing import Any, Dict, List, Optional

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.models.fmp.analyst_estimates import AnalystEstimatesQueryParams, AnalystEstimatesData
from data_fetcher.utils.api_keys import get_api_key

log = logging.getLogger(__name__)


class FMPAnalystEstimatesFetcher(Fetcher[AnalystEstimatesQueryParams, AnalystEstimatesData]):
    """FMP 애널리스트 추정치 Fetcher"""

    BASE_URL = "https://financialmodelingprep.com/stable"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> AnalystEstimatesQueryParams:
        """쿼리 파라미터 변환"""
        return AnalystEstimatesQueryParams(**params)

    @staticmethod
    def extract_data(
        query: AnalystEstimatesQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> List[Dict[str, Any]]:
        """
        FMP에서 애널리스트 추정치 데이터 추출

        Args:
            query: 쿼리 파라미터
            credentials: API 키 딕셔너리
            **kwargs: 추가 파라미터

        Returns:
            원시 데이터 리스트
        """
        try:
            # API 키 조회
            api_key = get_api_key(
                credentials=credentials,
                api_name="FMP",
                env_var="FMP_API_KEY"
            )

            # API 엔드포인트 (최신 stable 엔드포인트)
            url = f"{FMPAnalystEstimatesFetcher.BASE_URL}/analyst-estimates"

            # 파라미터 설정
            params = {
                "symbol": query.symbol,
                "period": query.period or "annual",
                "page": query.page or 0,
                "limit": query.limit or 10,
                "apikey": api_key
            }

            # API 호출
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()

            data = response.json()

            if not isinstance(data, list):
                log.warning(f"Unexpected response format for {query.symbol}")
                return []

            return data

        except requests.exceptions.RequestException as e:
            log.error(f"Error fetching analyst estimates from FMP for {query.symbol}: {e}")
            raise
        except Exception as e:
            log.error(f"Unexpected error: {e}")
            raise

    @staticmethod
    def transform_data(
        query: AnalystEstimatesQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any
    ) -> List[AnalystEstimatesData]:
        """
        원시 데이터를 표준 모델로 변환

        Args:
            query: 쿼리 파라미터
            data: 원시 데이터
            **kwargs: 추가 파라미터

        Returns:
            AnalystEstimatesData 리스트
        """
        if not data:
            log.info(f"No analyst estimates data for {query.symbol}")
            return []

        estimates_list = []

        for item in data:
            try:
                # Parse date
                estimate_date = None
                if item.get("date"):
                    try:
                        estimate_date = datetime.strptime(item["date"], "%Y-%m-%d").date()
                    except (ValueError, AttributeError):
                        pass

                if not estimate_date:
                    continue

                estimates_data = AnalystEstimatesData(
                    symbol=item.get("symbol", query.symbol),
                    date=estimate_date,
                    estimated_revenue_low=item.get("estimatedRevenueLow"),
                    estimated_revenue_high=item.get("estimatedRevenueHigh"),
                    estimated_revenue_avg=item.get("estimatedRevenueAvg"),
                    number_analyst_estimated_revenue=item.get("numberAnalystEstimatedRevenue"),
                    estimated_eps_low=item.get("estimatedEpsLow"),
                    estimated_eps_high=item.get("estimatedEpsHigh"),
                    estimated_eps_avg=item.get("estimatedEpsAvg"),
                    number_analyst_estimated_eps=item.get("numberAnalystsEstimatedEps"),
                    estimated_ebitda_low=item.get("estimatedEbitdaLow"),
                    estimated_ebitda_high=item.get("estimatedEbitdaHigh"),
                    estimated_ebitda_avg=item.get("estimatedEbitdaAvg"),
                    number_analyst_estimated_ebitda=item.get("numberAnalystsEstimatedEbitda"),
                    estimated_ebit_low=item.get("estimatedEbitLow"),
                    estimated_ebit_high=item.get("estimatedEbitHigh"),
                    estimated_ebit_avg=item.get("estimatedEbitAvg"),
                    number_analyst_estimated_ebit=item.get("numberAnalystsEstimatedEbit"),
                    estimated_net_income_low=item.get("estimatedNetIncomeLow"),
                    estimated_net_income_high=item.get("estimatedNetIncomeHigh"),
                    estimated_net_income_avg=item.get("estimatedNetIncomeAvg"),
                    number_analyst_estimated_net_income=item.get("numberAnalystsEstimatedNetIncome"),
                    estimated_sga_expense_low=item.get("estimatedSgaExpenseLow"),
                    estimated_sga_expense_high=item.get("estimatedSgaExpenseHigh"),
                    estimated_sga_expense_avg=item.get("estimatedSgaExpenseAvg"),
                    number_analyst_estimated_sga_expense=item.get("numberAnalystsEstimatedSgaExpense"),
                )

                estimates_list.append(estimates_data)

            except (KeyError, ValueError) as e:
                log.warning(f"Error parsing analyst estimates data: {e}")
                continue

        log.info(f"Fetched {len(estimates_list)} analyst estimates records for {query.symbol}")
        return estimates_list