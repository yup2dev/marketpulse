"""Yahoo Finance Calendar Fetcher"""
import logging
from typing import Any, Dict, List, Optional
from datetime import datetime
import yfinance as yf
import pandas as pd

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.models.yahoo.calendar import (
    CalendarQueryParams,
    CalendarData
)

log = logging.getLogger(__name__)


class YahooCalendarFetcher(Fetcher[CalendarQueryParams, CalendarData]):
    """Yahoo Finance 회사 일정 Fetcher"""

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> CalendarQueryParams:
        """쿼리 파라미터 변환"""
        return CalendarQueryParams(**params)

    @staticmethod
    def extract_data(
        query: CalendarQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        """
        Yahoo Finance에서 회사 일정 추출

        Args:
            query: 쿼리 파라미터
            credentials: 사용 안함

        Returns:
            회사 일정 딕셔너리
        """
        try:
            ticker = yf.Ticker(query.symbol)
            calendar = ticker.calendar
            info = ticker.info

            return {
                'calendar': calendar,
                'info': info
            }

        except Exception as e:
            log.error(f"Error fetching calendar for {query.symbol}: {e}")
            raise

    @staticmethod
    def transform_data(
        query: CalendarQueryParams,
        data: Dict[str, Any],
        **kwargs: Any
    ) -> List[CalendarData]:
        """
        원시 데이터를 표준 모델로 변환

        Args:
            query: 쿼리 파라미터
            data: 일정 정보 딕셔너리

        Returns:
            CalendarData 리스트
        """
        try:
            calendar = data.get('calendar')
            info = data.get('info', {})

            # calendar가 DataFrame일 수 있음
            earnings_date = None
            earnings_date_end = None
            earnings_avg = None
            earnings_low = None
            earnings_high = None
            revenue_avg = None
            revenue_low = None
            revenue_high = None
            ex_div_date = None
            div_date = None

            if calendar is not None:
                if isinstance(calendar, pd.DataFrame):
                    # DataFrame 형태인 경우
                    if 'Earnings Date' in calendar.columns:
                        ed = calendar.get('Earnings Date')
                        if ed is not None and len(ed) > 0:
                            earnings_date = ed.iloc[0].date() if pd.notna(ed.iloc[0]) else None
                            if len(ed) > 1:
                                earnings_date_end = ed.iloc[1].date() if pd.notna(ed.iloc[1]) else None
                    if 'Earnings Average' in calendar.columns:
                        ea = calendar.get('Earnings Average')
                        earnings_avg = float(ea.iloc[0]) if ea is not None and len(ea) > 0 and pd.notna(ea.iloc[0]) else None
                    if 'Earnings Low' in calendar.columns:
                        el = calendar.get('Earnings Low')
                        earnings_low = float(el.iloc[0]) if el is not None and len(el) > 0 and pd.notna(el.iloc[0]) else None
                    if 'Earnings High' in calendar.columns:
                        eh = calendar.get('Earnings High')
                        earnings_high = float(eh.iloc[0]) if eh is not None and len(eh) > 0 and pd.notna(eh.iloc[0]) else None
                    if 'Revenue Average' in calendar.columns:
                        ra = calendar.get('Revenue Average')
                        revenue_avg = float(ra.iloc[0]) if ra is not None and len(ra) > 0 and pd.notna(ra.iloc[0]) else None
                    if 'Revenue Low' in calendar.columns:
                        rl = calendar.get('Revenue Low')
                        revenue_low = float(rl.iloc[0]) if rl is not None and len(rl) > 0 and pd.notna(rl.iloc[0]) else None
                    if 'Revenue High' in calendar.columns:
                        rh = calendar.get('Revenue High')
                        revenue_high = float(rh.iloc[0]) if rh is not None and len(rh) > 0 and pd.notna(rh.iloc[0]) else None
                    if 'Ex-Dividend Date' in calendar.columns:
                        ed = calendar.get('Ex-Dividend Date')
                        ex_div_date = ed.iloc[0].date() if ed is not None and len(ed) > 0 and pd.notna(ed.iloc[0]) else None
                    if 'Dividend Date' in calendar.columns:
                        dd = calendar.get('Dividend Date')
                        div_date = dd.iloc[0].date() if dd is not None and len(dd) > 0 and pd.notna(dd.iloc[0]) else None
                elif isinstance(calendar, dict):
                    # dict 형태인 경우
                    earnings_dates = calendar.get('Earnings Date', [])
                    if earnings_dates and len(earnings_dates) > 0:
                        ed = earnings_dates[0]
                        earnings_date = ed.date() if hasattr(ed, 'date') else ed
                        if len(earnings_dates) > 1:
                            ed2 = earnings_dates[1]
                            earnings_date_end = ed2.date() if hasattr(ed2, 'date') else ed2
                    earnings_avg = calendar.get('Earnings Average')
                    earnings_low = calendar.get('Earnings Low')
                    earnings_high = calendar.get('Earnings High')
                    revenue_avg = calendar.get('Revenue Average')
                    revenue_low = calendar.get('Revenue Low')
                    revenue_high = calendar.get('Revenue High')
                    ex_div = calendar.get('Ex-Dividend Date')
                    if ex_div:
                        ex_div_date = ex_div.date() if hasattr(ex_div, 'date') else ex_div
                    div = calendar.get('Dividend Date')
                    if div:
                        div_date = div.date() if hasattr(div, 'date') else div

            # info에서 추가 정보 가져오기
            if not ex_div_date and info.get('exDividendDate'):
                ex_div_date = datetime.fromtimestamp(info['exDividendDate']).date()
            if not div_date and info.get('dividendDate'):
                div_date = datetime.fromtimestamp(info['dividendDate']).date()

            calendar_data = CalendarData(
                symbol=query.symbol,
                earnings_date=earnings_date,
                earnings_date_end=earnings_date_end,
                earnings_average=earnings_avg,
                earnings_low=earnings_low,
                earnings_high=earnings_high,
                revenue_average=revenue_avg,
                revenue_low=revenue_low,
                revenue_high=revenue_high,
                ex_dividend_date=ex_div_date,
                dividend_date=div_date
            )

            log.info(f"Fetched calendar for {query.symbol}")
            return [calendar_data]

        except Exception as e:
            log.error(f"Error transforming calendar: {e}")
            raise
