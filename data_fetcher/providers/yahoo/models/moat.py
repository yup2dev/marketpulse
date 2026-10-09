"""Yahoo Finance Moat Analysis Model"""
from data_fetcher.abstract_provider.standard_models.economic_moat import (
    EconomicMoatYearData as YFinanceMoatYearData,
    EconomicMoatQueryParams,
    EconomicMoatData,
)


class YFinanceMoatQueryParams(EconomicMoatQueryParams):
    """Moat 조회 파라미터 (standard EconomicMoat 경유)"""


class YFinanceMoatData(EconomicMoatData):
    """Moat 분석 데이터 (standard EconomicMoat 경유)"""


"""Yahoo Finance Moat Analysis Fetcher"""
import logging
from typing import Any, Dict, List, Optional
import numpy as np
import yfinance as yf

from data_fetcher.abstract_provider.abstract.base_fetchers import YFinanceFetcher

log = logging.getLogger(__name__)


def _safe(df, row, col):
    try:
        val = df.loc[row, col]
        if val is None or (isinstance(val, float) and np.isnan(val)):
            return None
        return float(val)
    except Exception:
        return None


class YFinanceMoatFetcher(YFinanceFetcher[YFinanceMoatQueryParams, YFinanceMoatData]):

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> YFinanceMoatQueryParams:
        return YFinanceMoatQueryParams(**params)

    @staticmethod
    def extract_data(
        query: YFinanceMoatQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Optional[Dict[str, Any]]:
        ticker = yf.Ticker(query.symbol)
        income = ticker.income_stmt
        balance = ticker.balance_sheet
        cashflow = ticker.cashflow
        if income is None or income.empty:
            return None
        return {'income': income, 'balance': balance, 'cashflow': cashflow}

    @staticmethod
    def transform_data(
        query: YFinanceMoatQueryParams,
        data: Optional[Dict[str, Any]],
        **kwargs: Any,
    ) -> List[YFinanceMoatData]:
        if not data:
            return [YFinanceMoatData(symbol=query.symbol)]

        income = data['income']
        balance = data.get('balance')
        cashflow = data.get('cashflow')
        cols = sorted(income.columns)

        history: List[YFinanceMoatYearData] = []
        roe_above_15 = 0

        for col in cols:
            year = str(col)[:4]
            revenue = _safe(income, 'Total Revenue', col)
            gross   = _safe(income, 'Gross Profit', col)
            op_inc  = _safe(income, 'Operating Income', col)
            net_inc = _safe(income, 'Net Income', col)

            equity       = _safe(balance, 'Stockholders Equity', col) if balance is not None and not balance.empty else None
            total_assets = _safe(balance, 'Total Assets', col) if balance is not None and not balance.empty else None
            total_debt   = _safe(balance, 'Total Debt', col) if balance is not None and not balance.empty else None

            fcf = None
            if cashflow is not None and not cashflow.empty:
                ocf   = _safe(cashflow, 'Operating Cash Flow', col)
                capex = _safe(cashflow, 'Capital Expenditure', col)
                if ocf is not None and capex is not None:
                    fcf = ocf + capex

            roe = round(net_inc / equity * 100, 1) if (net_inc and equity and equity != 0) else None
            invested_capital = (total_assets - (total_assets - (equity or 0) - (total_debt or 0))) if total_assets else None
            roic = None
            if op_inc and invested_capital and invested_capital != 0:
                roic = round(op_inc / invested_capital * 100, 1)

            gross_margin = round(gross / revenue * 100, 1) if (gross and revenue and revenue != 0) else None
            op_margin    = round(op_inc / revenue * 100, 1) if (op_inc and revenue and revenue != 0) else None
            net_margin   = round(net_inc / revenue * 100, 1) if (net_inc and revenue and revenue != 0) else None
            fcf_margin   = round(fcf / revenue * 100, 1) if (fcf and revenue and revenue != 0) else None

            if roe is not None and roe >= 15:
                roe_above_15 += 1

            history.append(YFinanceMoatYearData(
                year=year, roe=roe, roic=roic,
                gross_margin=gross_margin, op_margin=op_margin,
                net_margin=net_margin, fcf_margin=fcf_margin,
            ))

        if roe_above_15 >= 7:
            moat_type = 'Wide'
            moat_score = min(100, 60 + roe_above_15 * 5)
        elif roe_above_15 >= 4:
            moat_type = 'Narrow'
            moat_score = 30 + roe_above_15 * 5
        else:
            # 'None' 문자열은 BaseData sanitizer(_EMPTY_STRINGS)가 실제 None 으로
            # 치환해 non-optional str 검증을 깨뜨린다 → 라벨을 'No Moat' 로 사용.
            moat_type = 'No Moat'
            moat_score = max(0, roe_above_15 * 5)

        return [YFinanceMoatData(
            symbol=query.symbol,
            history=history,
            moat_score=moat_score,
            moat_type=moat_type,
        )]
