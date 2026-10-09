"""Yahoo Finance Calendar Model (회사 일정)"""
from data_fetcher.abstract_provider.standard_models.company_calendar import (
    CompanyCalendarQueryParams,
    CompanyCalendarData,
)


class YFinanceCalendarQueryParams(CompanyCalendarQueryParams):
    """회사 일정 조회 파라미터 (standard CompanyCalendar 경유)"""


class YFinanceCalendarData(CompanyCalendarData):
    """회사 일정 데이터 (standard CompanyCalendar 경유)"""


"""Yahoo Finance Calendar Fetcher"""
import logging
from typing import Any, Dict, List, Optional
import yfinance as yf
import pandas as pd

from data_fetcher.abstract_provider.abstract.base_fetchers import YFinanceFetcher

log = logging.getLogger(__name__)


class YFinanceCalendarFetcher(YFinanceFetcher[YFinanceCalendarQueryParams, YFinanceCalendarData]):

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> YFinanceCalendarQueryParams:
        return YFinanceCalendarQueryParams(**params)

    @staticmethod
    def extract_data(
        query: YFinanceCalendarQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        ticker = yf.Ticker(query.symbol)
        return {
            'calendar': ticker.calendar,
            'earnings_dates': ticker.earnings_dates,
            'info': ticker.info,
        }

    @staticmethod
    def transform_data(
        query: YFinanceCalendarQueryParams,
        data: Dict[str, Any],
        **kwargs: Any,
    ) -> List[YFinanceCalendarData]:
        calendar    = data.get('calendar')
        earnings_df = data.get('earnings_dates')
        info        = data.get('info') or {}

        events: List[Dict[str, Any]] = []
        upcoming_earnings: Dict[str, Any] = {}

        if calendar and isinstance(calendar, dict):
            earnings_date_list = calendar.get('Earnings Date', [])
            if not isinstance(earnings_date_list, list):
                earnings_date_list = [earnings_date_list]
            for ed in earnings_date_list:
                if ed:
                    date_str = ed.strftime('%Y-%m-%d') if hasattr(ed, 'strftime') else str(ed)
                    events.append({
                        'type': 'earnings',
                        'title': 'Earnings Release',
                        'date': date_str,
                        'description': 'Quarterly earnings report',
                        'eps_estimate': calendar.get('Earnings Average'),
                        'eps_low': calendar.get('Earnings Low'),
                        'eps_high': calendar.get('Earnings High'),
                        'revenue_estimate': calendar.get('Revenue Average'),
                        'revenue_low': calendar.get('Revenue Low'),
                        'revenue_high': calendar.get('Revenue High'),
                    })
                    upcoming_earnings['date'] = date_str
                    upcoming_earnings['eps_estimate'] = calendar.get('Earnings Average')

            ex_div = calendar.get('Ex-Dividend Date')
            if ex_div:
                date_str = ex_div.strftime('%Y-%m-%d') if hasattr(ex_div, 'strftime') else str(ex_div)
                events.append({
                    'type': 'ex_dividend',
                    'title': 'Ex-Dividend Date',
                    'date': date_str,
                    'description': f"Dividend: ${info.get('dividendRate', 0):.2f}/share",
                    'amount': info.get('dividendRate', 0),
                })

            div_date = calendar.get('Dividend Date')
            if div_date:
                date_str = div_date.strftime('%Y-%m-%d') if hasattr(div_date, 'strftime') else str(div_date)
                events.append({
                    'type': 'dividend_payment',
                    'title': 'Dividend Payment',
                    'date': date_str,
                    'description': f"Dividend: ${info.get('dividendRate', 0):.2f}/share",
                    'amount': info.get('dividendRate', 0),
                })

        events.sort(key=lambda x: x.get('date', ''))

        # Apply date filters
        start_date = query.start_date
        end_date   = query.end_date
        if start_date or end_date:
            events = [
                e for e in events
                if (not start_date or e.get('date', '') >= start_date)
                and (not end_date or e.get('date', '') <= end_date)
            ]

        earnings_history: List[Dict[str, Any]] = []
        if earnings_df is not None and not earnings_df.empty:
            for date_idx, row in earnings_df.iterrows():
                try:
                    date_str = date_idx.strftime('%Y-%m-%d') if hasattr(date_idx, 'strftime') else str(date_idx)[:10]
                    est = row.get('EPS Estimate')
                    act = row.get('Reported EPS')
                    sur = row.get('Surprise(%)')
                    earnings_history.append({
                        'date': date_str,
                        'eps_estimate': float(est) if est is not None and not pd.isna(est) else None,
                        'eps_actual':   float(act) if act is not None and not pd.isna(act) else None,
                        'surprise_pct': float(sur) if sur is not None and not pd.isna(sur) else None,
                    })
                except Exception as e:
                    log.warning(f"Error parsing earnings date: {e}")

        return [YFinanceCalendarData(
            symbol=query.symbol,
            events=events,
            upcoming_earnings=upcoming_earnings,
            earnings_history=earnings_history[:12],
            dividend_info={
                'rate': info.get('dividendRate'),
                'yield': info.get('dividendYield'),
                'payout_ratio': info.get('payoutRatio'),
            },
        )]
