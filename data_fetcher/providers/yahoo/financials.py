"""Yahoo Finance Financials (재무제표 통합 — 손익+재무상태+현금흐름)"""
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

import yfinance as yf
from pydantic import Field

from data_fetcher.abstract_provider.abstract.base_fetchers import YFinanceFetcher
from data_fetcher.abstract_provider.standard_models import FinancialsQueryParams, FinancialsData

log = logging.getLogger(__name__)


class YFinanceFinancialsQueryParams(FinancialsQueryParams):
    """Yahoo Finance 재무제표 파라미터 — period 대신 freq 별칭 지원"""
    freq: Optional[str] = Field(default=None, description="보고 주기 (quarterly/annual) — period 별칭")


class YFinanceFinancialsData(FinancialsData):
    """Yahoo Finance 재무제표 데이터 — 표준 FinancialsData 상속"""
    total_liabilities_net_minority_interest: Optional[float] = Field(
        default=None, description="총 부채 (소수주주 제외)"
    )


class YFinanceFinancialsFetcher(YFinanceFetcher[YFinanceFinancialsQueryParams, YFinanceFinancialsData]):

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> YFinanceFinancialsQueryParams:
        # freq → period 통일
        if 'freq' in params and 'period' not in params:
            params = {**params, 'period': params['freq']}
        return YFinanceFinancialsQueryParams(**params)

    @staticmethod
    def extract_data(
        query: YFinanceFinancialsQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        try:
            ticker = yf.Ticker(query.symbol)
            freq = query.freq or query.period or 'annual'
            if freq == 'quarterly':
                income_stmt  = ticker.quarterly_income_stmt
                balance_sheet = ticker.quarterly_balance_sheet
                cash_flow    = ticker.quarterly_cashflow
            else:
                income_stmt  = ticker.income_stmt
                balance_sheet = ticker.balance_sheet
                cash_flow    = ticker.cashflow
            return {'income_stmt': income_stmt, 'balance_sheet': balance_sheet,
                    'cash_flow': cash_flow, 'freq': freq}
        except Exception as e:
            log.error(f"Error fetching financials for {query.symbol}: {e}")
            raise

    @staticmethod
    def transform_data(
        query: YFinanceFinancialsQueryParams,
        data: Dict[str, Any],
        **kwargs: Any,
    ) -> List[YFinanceFinancialsData]:
        try:
            income_stmt   = data.get('income_stmt')
            balance_sheet = data.get('balance_sheet')
            cash_flow     = data.get('cash_flow')
            results       = []

            if income_stmt is None or income_stmt.empty:
                return results

            def safe_get(df, key, col):
                try:
                    if df is not None and not df.empty and key in df.index:
                        val = df.loc[key, col]
                        if (hasattr(val, '__iter__') and len(val) == 0) or str(val) == 'nan':
                            return None
                        return float(val)
                except Exception:
                    pass
                return None

            for date_col in income_stmt.columns:
                dt = date_col.to_pydatetime() if hasattr(date_col, 'to_pydatetime') else datetime.now()
                results.append(YFinanceFinancialsData(
                    symbol=query.symbol,
                    date=dt.date(),
                    # 손익계산서 — 표준 필드명 사용
                    revenue=safe_get(income_stmt, 'Total Revenue', date_col),
                    cost_of_revenue=safe_get(income_stmt, 'Cost Of Revenue', date_col),
                    gross_profit=safe_get(income_stmt, 'Gross Profit', date_col),
                    operating_expenses=safe_get(income_stmt, 'Operating Expense', date_col),
                    operating_income=safe_get(income_stmt, 'Operating Income', date_col),
                    net_income=safe_get(income_stmt, 'Net Income', date_col),
                    ebitda=safe_get(income_stmt, 'EBITDA', date_col),
                    eps=safe_get(income_stmt, 'Basic EPS', date_col),
                    eps_diluted=safe_get(income_stmt, 'Diluted EPS', date_col),
                    # 재무상태표
                    total_assets=safe_get(balance_sheet, 'Total Assets', date_col),
                    current_assets=safe_get(balance_sheet, 'Current Assets', date_col),
                    cash=safe_get(balance_sheet, 'Cash And Cash Equivalents', date_col),
                    total_liabilities=safe_get(balance_sheet, 'Total Liabilities Net Minority Interest', date_col),
                    total_liabilities_net_minority_interest=safe_get(balance_sheet, 'Total Liabilities Net Minority Interest', date_col),
                    current_liabilities=safe_get(balance_sheet, 'Current Liabilities', date_col),
                    stockholders_equity=safe_get(balance_sheet, 'Stockholders Equity', date_col),
                    total_debt=safe_get(balance_sheet, 'Total Debt', date_col),
                    # 현금흐름표
                    operating_cash_flow=safe_get(cash_flow, 'Operating Cash Flow', date_col),
                    investing_cash_flow=safe_get(cash_flow, 'Investing Cash Flow', date_col),
                    financing_cash_flow=safe_get(cash_flow, 'Financing Cash Flow', date_col),
                    free_cash_flow=safe_get(cash_flow, 'Free Cash Flow', date_col),
                    capital_expenditure=safe_get(cash_flow, 'Capital Expenditure', date_col),
                ))

            log.info(f"Fetched {len(results)} periods of financials for {query.symbol}")
            return results

        except Exception as e:
            log.error(f"Error transforming financials: {e}")
            raise
