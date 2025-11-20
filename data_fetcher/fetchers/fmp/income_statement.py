"""FMP Income Statement Fetcher"""
import logging
import requests
from datetime import datetime
from typing import Any, Dict, List, Optional

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.models.fmp.income_statement import IncomeStatementQueryParams, IncomeStatementData
from data_fetcher.utils.api_keys import get_api_key

log = logging.getLogger(__name__)


class FMPIncomeStatementFetcher(Fetcher[IncomeStatementQueryParams, IncomeStatementData]):
    """FMP 손익계산서 Fetcher"""

    BASE_URL = "https://financialmodelingprep.com/stable"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> IncomeStatementQueryParams:
        """쿼리 파라미터 변환"""
        return IncomeStatementQueryParams(**params)

    @staticmethod
    def extract_data(
        query: IncomeStatementQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> List[Dict[str, Any]]:
        """
        FMP에서 손익계산서 데이터 추출

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
            url = f"{FMPIncomeStatementFetcher.BASE_URL}/income-statement"

            # 파라미터 설정
            params = {
                "symbol": query.symbol,
                "apikey": api_key,
                "limit": query.limit or 10
            }

            if query.period:
                params["period"] = query.period

            # API 호출
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()

            data = response.json()

            if not isinstance(data, list):
                log.warning(f"Unexpected response format for {query.symbol}")
                return []

            return data

        except requests.exceptions.RequestException as e:
            log.error(f"Error fetching income statement from FMP for {query.symbol}: {e}")
            raise
        except Exception as e:
            log.error(f"Unexpected error: {e}")
            raise

    @staticmethod
    def transform_data(
        query: IncomeStatementQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any
    ) -> List[IncomeStatementData]:
        """
        원시 데이터를 표준 모델로 변환

        Args:
            query: 쿼리 파라미터
            data: 원시 데이터
            **kwargs: 추가 파라미터

        Returns:
            IncomeStatementData 리스트
        """
        if not data:
            log.info(f"No income statement data for {query.symbol}")
            return []

        statement_list = []

        for item in data:
            try:
                # Parse dates
                date = None
                reporting_date = None
                fiscal_date_ending = None
                accepted_date = None
                filling_date = None

                if item.get("date"):
                    try:
                        date = datetime.strptime(item["date"], "%Y-%m-%d").date()
                    except (ValueError, AttributeError):
                        pass

                if item.get("reportedCurrency"):
                    pass  # We don't use this but it's in the API

                if item.get("acceptedDate"):
                    try:
                        accepted_date = datetime.strptime(
                            item["acceptedDate"][:10], "%Y-%m-%d"
                        ).date()
                    except (ValueError, AttributeError, IndexError):
                        pass

                if item.get("fillingDate"):
                    try:
                        filling_date = datetime.strptime(item["fillingDate"], "%Y-%m-%d").date()
                    except (ValueError, AttributeError):
                        pass

                if item.get("calendarYear"):
                    fiscal_date_ending = date

                statement_data = IncomeStatementData(
                    symbol=query.symbol,
                    date=date or datetime.now().date(),
                    period=item.get("period", ""),
                    reporting_date=reporting_date,
                    fiscal_date_ending=fiscal_date_ending,
                    revenue=item.get("revenue"),
                    cost_of_revenue=item.get("costOfRevenue"),
                    gross_profit=item.get("grossProfit"),
                    gross_profit_ratio=item.get("grossProfitRatio"),
                    research_and_development_expenses=item.get("researchAndDevelopmentExpenses"),
                    general_and_administrative_expenses=item.get("generalAndAdministrativeExpenses"),
                    selling_and_marketing_expenses=item.get("sellingAndMarketingExpenses"),
                    selling_general_and_administrative_expenses=item.get("sellingGeneralAndAdministrativeExpenses"),
                    other_expenses=item.get("otherExpenses"),
                    operating_expenses=item.get("operatingExpenses"),
                    cost_and_expenses=item.get("costAndExpenses"),
                    operating_income=item.get("operatingIncome"),
                    operating_income_ratio=item.get("operatingIncomeRatio"),
                    interest_income=item.get("interestIncome"),
                    interest_expense=item.get("interestExpense"),
                    depreciation_and_amortization=item.get("depreciationAndAmortization"),
                    ebitda=item.get("ebitda"),
                    ebitda_ratio=item.get("ebitdaratio"),
                    total_other_income_expenses_net=item.get("totalOtherIncomeExpensesNet"),
                    income_before_tax=item.get("incomeBeforeTax"),
                    income_before_tax_ratio=item.get("incomeBeforeTaxRatio"),
                    income_tax_expense=item.get("incomeTaxExpense"),
                    net_income=item.get("netIncome"),
                    net_income_ratio=item.get("netIncomeRatio"),
                    eps=item.get("eps"),
                    eps_diluted=item.get("epsdiluted"),
                    weighted_average_shs_out=item.get("weightedAverageShsOut"),
                    weighted_average_shs_out_dil=item.get("weightedAverageShsOutDil"),
                    link=item.get("link"),
                    final_link=item.get("finalLink"),
                    accepted_date=accepted_date,
                    calendar_year=item.get("calendarYear"),
                    cik=item.get("cik"),
                    filling_date=filling_date,
                )

                statement_list.append(statement_data)

            except (KeyError, ValueError) as e:
                log.warning(f"Error parsing income statement data: {e}")
                continue

        log.info(f"Fetched {len(statement_list)} income statement records for {query.symbol}")
        return statement_list