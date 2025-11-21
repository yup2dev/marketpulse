"""Yahoo Finance Financials Fetcher"""
import logging
from typing import Any, Dict, List, Optional
import yfinance as yf
from datetime import datetime

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.models.yahoo.financials import (
    FinancialsQueryParams,
    FinancialsData
)

log = logging.getLogger(__name__)


class YahooFinancialsFetcher(Fetcher[FinancialsQueryParams, FinancialsData]):
    """Yahoo Finance 재무제표 Fetcher"""

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> FinancialsQueryParams:
        """쿼리 파라미터 변환"""
        return FinancialsQueryParams(**params)

    @staticmethod
    def extract_data(
        query: FinancialsQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        """
        Yahoo Finance에서 재무제표 정보 추출

        Args:
            query: 쿼리 파라미터
            credentials: 사용 안함

        Returns:
            재무제표 정보 딕셔너리
        """
        try:
            ticker = yf.Ticker(query.symbol)

            # Get financial statements
            income_stmt = ticker.income_stmt
            balance_sheet = ticker.balance_sheet
            cash_flow = ticker.cashflow

            return {
                'income_stmt': income_stmt,
                'balance_sheet': balance_sheet,
                'cash_flow': cash_flow
            }

        except Exception as e:
            log.error(f"Error fetching financials for {query.symbol}: {e}")
            raise

    @staticmethod
    def transform_data(
        query: FinancialsQueryParams,
        data: Dict[str, Any],
        **kwargs: Any
    ) -> List[FinancialsData]:
        """
        원시 데이터를 표준 모델로 변환

        Args:
            query: 쿼리 파라미터
            data: 재무제표 딕셔너리

        Returns:
            FinancialsData 리스트
        """
        try:
            income_stmt = data.get('income_stmt')
            balance_sheet = data.get('balance_sheet')
            cash_flow = data.get('cash_flow')

            results = []

            # Process most recent column
            if income_stmt is not None and not income_stmt.empty:
                latest_date = income_stmt.columns[0]

                # Helper function to safely get values
                def safe_get(df, key):
                    try:
                        if key in df.index:
                            val = df.loc[key, latest_date]
                            return None if (hasattr(val, '__iter__') and len(val) == 0) or str(val) == 'nan' else float(val)
                    except:
                        pass
                    return None

                financials = FinancialsData(
                    symbol=query.symbol,
                    as_of_date=latest_date.to_pydatetime() if hasattr(latest_date, 'to_pydatetime') else datetime.now(),

                    # Income Statement
                    total_revenue=safe_get(income_stmt, 'Total Revenue'),
                    cost_of_revenue=safe_get(income_stmt, 'Cost Of Revenue'),
                    gross_profit=safe_get(income_stmt, 'Gross Profit'),
                    operating_expense=safe_get(income_stmt, 'Operating Expense'),
                    operating_income=safe_get(income_stmt, 'Operating Income'),
                    net_income=safe_get(income_stmt, 'Net Income'),
                    ebitda=safe_get(income_stmt, 'EBITDA'),
                    basic_eps=safe_get(income_stmt, 'Basic EPS'),
                    diluted_eps=safe_get(income_stmt, 'Diluted EPS'),

                    # Balance Sheet
                    total_assets=safe_get(balance_sheet, 'Total Assets') if balance_sheet is not None else None,
                    current_assets=safe_get(balance_sheet, 'Current Assets') if balance_sheet is not None else None,
                    cash=safe_get(balance_sheet, 'Cash And Cash Equivalents') if balance_sheet is not None else None,
                    total_liabilities_net_minority_interest=safe_get(balance_sheet, 'Total Liabilities Net Minority Interest') if balance_sheet is not None else None,
                    current_liabilities=safe_get(balance_sheet, 'Current Liabilities') if balance_sheet is not None else None,
                    stockholders_equity=safe_get(balance_sheet, 'Stockholders Equity') if balance_sheet is not None else None,
                    total_debt=safe_get(balance_sheet, 'Total Debt') if balance_sheet is not None else None,

                    # Cash Flow
                    operating_cash_flow=safe_get(cash_flow, 'Operating Cash Flow') if cash_flow is not None else None,
                    investing_cash_flow=safe_get(cash_flow, 'Investing Cash Flow') if cash_flow is not None else None,
                    financing_cash_flow=safe_get(cash_flow, 'Financing Cash Flow') if cash_flow is not None else None,
                    free_cash_flow=safe_get(cash_flow, 'Free Cash Flow') if cash_flow is not None else None,
                    capital_expenditure=safe_get(cash_flow, 'Capital Expenditure') if cash_flow is not None else None,
                )

                results.append(financials)
                log.info(f"Fetched financials for {query.symbol}")

            return results

        except Exception as e:
            log.error(f"Error transforming financials: {e}")
            raise
