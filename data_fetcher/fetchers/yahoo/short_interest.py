"""Yahoo Finance Short Interest Fetcher"""
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
import yfinance as yf

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.models.yahoo.short_interest import (
    ShortInterestQueryParams,
    ShortInterestData
)

log = logging.getLogger(__name__)


class YahooShortInterestFetcher(
    Fetcher[ShortInterestQueryParams, ShortInterestData]
):
    """Yahoo Finance 공매도 데이터 Fetcher"""

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> ShortInterestQueryParams:
        """쿼리 파라미터 변환"""
        return ShortInterestQueryParams(**params)

    @staticmethod
    def extract_data(
        query: ShortInterestQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        """
        Yahoo Finance에서 공매도 데이터 추출

        Args:
            query: 쿼리 파라미터
            credentials: 사용 안함 (Yahoo Finance는 무료)
            **kwargs: 추가 파라미터

        Returns:
            원시 데이터 딕셔너리
        """
        try:
            ticker = yf.Ticker(query.symbol)
            info = ticker.info

            # 기간별 히스토리 데이터 (참고용)
            hist_data = None
            if query.start_date or query.end_date:
                end_date = datetime.now()
                start_date = end_date - timedelta(days=90)  # 기본 3개월

                if query.start_date:
                    start_date = datetime.strptime(query.start_date, '%Y-%m-%d')
                if query.end_date:
                    end_date = datetime.strptime(query.end_date, '%Y-%m-%d')

                hist_data = ticker.history(start=start_date, end=end_date, interval='1d')

            return {
                'info': info,
                'history': hist_data,
                'symbol': query.symbol
            }

        except Exception as e:
            log.error(f"Error extracting short interest data for {query.symbol}: {e}")
            raise

    @staticmethod
    def transform_data(
        query: ShortInterestQueryParams,
        data: Dict[str, Any],
        **kwargs: Any
    ) -> List[ShortInterestData]:
        """
        원시 데이터를 표준 모델로 변환

        Args:
            query: 쿼리 파라미터
            data: 원시 데이터
            **kwargs: 추가 파라미터

        Returns:
            ShortInterestData 리스트
        """
        info = data['info']
        symbol = data['symbol']

        # 공매도 주식 수
        shares_short = info.get('sharesShort')
        shares_short_prior = info.get('sharesShortPriorMonth')

        # 변화율 계산
        month_change = None
        month_change_pct = None
        if shares_short and shares_short_prior:
            month_change = shares_short - shares_short_prior
            month_change_pct = (month_change / shares_short_prior) * 100 if shares_short_prior > 0 else None

        # 날짜 변환
        date_short_interest = None
        date_short_timestamp = info.get('dateShortInterest')
        if date_short_timestamp:
            date_short_interest = datetime.fromtimestamp(date_short_timestamp).date()

        # 발행주식 대비 공매도 비율
        short_pct_outstanding = None
        shares_outstanding = info.get('sharesOutstanding')
        if shares_short and shares_outstanding:
            short_pct_outstanding = shares_short / shares_outstanding

        short_data = ShortInterestData(
            symbol=symbol,
            company_name=info.get('longName'),
            shares_short=shares_short,
            shares_short_prior_month=shares_short_prior,
            short_percent_of_float=info.get('shortPercentOfFloat'),
            short_ratio=info.get('shortRatio'),
            month_over_month_change=month_change,
            month_over_month_change_percent=month_change_pct,
            float_shares=info.get('floatShares'),
            shares_outstanding=shares_outstanding,
            average_volume=info.get('averageVolume'),
            date_short_interest=date_short_interest,
            fetched_at=datetime.now(),
            short_percent_of_outstanding=short_pct_outstanding,
            days_to_cover=info.get('shortRatio')
        )

        return [short_data]
