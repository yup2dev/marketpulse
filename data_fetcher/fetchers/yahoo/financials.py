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

            # Get financial statements based on frequency (quarterly or annual)
            freq = getattr(query, 'freq', 'annual')  # Default to annual if not specified

            if freq == 'quarterly':
                income_stmt = ticker.quarterly_income_stmt
                balance_sheet = ticker.quarterly_balance_sheet
                cash_flow = ticker.quarterly_cashflow
            else:  # annual
                income_stmt = ticker.income_stmt
                balance_sheet = ticker.balance_sheet
                cash_flow = ticker.cashflow

            return {
                'income_stmt': income_stmt,
                'balance_sheet': balance_sheet,
                'cash_flow': cash_flow,
                'freq': freq
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

            # Process all periods (columns)
            if income_stmt is not None and not income_stmt.empty:
                # Helper function to safely get values for a specific date
                def safe_get(df, key, date_col):
                    try:
                        if df is not None and not df.empty and key in df.index:
                            val = df.loc[key, date_col]
                            return None if (hasattr(val, '__iter__') and len(val) == 0) or str(val) == 'nan' else float(val)
                    except:
                        pass
                    return None

                # Iterate through all columns (periods) in the income statement
                for date_col in income_stmt.columns:
                    financials = FinancialsData(
                        symbol=query.symbol,
                        as_of_date=date_col.to_pydatetime() if hasattr(date_col, 'to_pydatetime') else datetime.now(),

                        # Income Statement
                        total_revenue=safe_get(income_stmt, 'Total Revenue', date_col),
                        cost_of_revenue=safe_get(income_stmt, 'Cost Of Revenue', date_col),
                        gross_profit=safe_get(income_stmt, 'Gross Profit', date_col),
                        operating_expense=safe_get(income_stmt, 'Operating Expense', date_col),
                        operating_income=safe_get(income_stmt, 'Operating Income', date_col),
                        net_income=safe_get(income_stmt, 'Net Income', date_col),
                        ebitda=safe_get(income_stmt, 'EBITDA', date_col),
                        basic_eps=safe_get(income_stmt, 'Basic EPS', date_col),
                        diluted_eps=safe_get(income_stmt, 'Diluted EPS', date_col),

                        # Balance Sheet
                        total_assets=safe_get(balance_sheet, 'Total Assets', date_col),
                        current_assets=safe_get(balance_sheet, 'Current Assets', date_col),
                        cash=safe_get(balance_sheet, 'Cash And Cash Equivalents', date_col),
                        total_liabilities_net_minority_interest=safe_get(balance_sheet, 'Total Liabilities Net Minority Interest', date_col),
                        current_liabilities=safe_get(balance_sheet, 'Current Liabilities', date_col),
                        stockholders_equity=safe_get(balance_sheet, 'Stockholders Equity', date_col),
                        total_debt=safe_get(balance_sheet, 'Total Debt', date_col),

                        # Cash Flow
                        operating_cash_flow=safe_get(cash_flow, 'Operating Cash Flow', date_col),
                        investing_cash_flow=safe_get(cash_flow, 'Investing Cash Flow', date_col),
                        financing_cash_flow=safe_get(cash_flow, 'Financing Cash Flow', date_col),
                        free_cash_flow=safe_get(cash_flow, 'Free Cash Flow', date_col),
                        capital_expenditure=safe_get(cash_flow, 'Capital Expenditure', date_col),
                    )

                    results.append(financials)

                log.info(f"Fetched {len(results)} periods of financials for {query.symbol}")

            return results

        except Exception as e:
            log.error(f"Error transforming financials: {e}")
            raise
