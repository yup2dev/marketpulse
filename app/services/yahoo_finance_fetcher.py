"""
Yahoo Finance Fetcher Service

Yahoo Finance API를 사용한 실시간 주식 데이터 fetcher
- 실시간 주가 조회
- 히스토리컬 데이터 조회
- 티커 정보 조회
- 재무제표 데이터 조회
"""
import logging
from datetime import datetime, date, timedelta
from typing import List, Dict, Optional, Union
import yfinance as yf
import pandas as pd

log = logging.getLogger(__name__)


class YahooFinanceFetcher:
    """Yahoo Finance API 래퍼 서비스"""

    def __init__(self):
        """YahooFinanceFetcher 초기화"""
        pass

    def get_ticker_info(self, symbol: str) -> Optional[Dict]:
        """
        티커 기본 정보 조회

        Args:
            symbol: 티커 심볼 (예: AAPL, MSFT)

        Returns:
            티커 정보 딕셔너리
        """
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info

            if not info or len(info) <= 1:
                log.warning(f"No info found for {symbol}")
                return None

            # 주요 정보만 추출
            return {
                'symbol': symbol,
                'name': info.get('longName') or info.get('shortName', symbol),
                'sector': info.get('sector'),
                'industry': info.get('industry'),
                'exchange': info.get('exchange'),
                'currency': info.get('currency', 'USD'),
                'market_cap': info.get('marketCap'),
                'current_price': info.get('currentPrice') or info.get('regularMarketPrice'),
                'previous_close': info.get('previousClose'),
                'open': info.get('open'),
                'day_high': info.get('dayHigh'),
                'day_low': info.get('dayLow'),
                'volume': info.get('volume'),
                'avg_volume': info.get('averageVolume'),
                '52_week_high': info.get('fiftyTwoWeekHigh'),
                '52_week_low': info.get('fiftyTwoWeekLow'),
                'pe_ratio': info.get('trailingPE'),
                'forward_pe': info.get('forwardPE'),
                'dividend_yield': info.get('dividendYield'),
                'beta': info.get('beta'),
                'website': info.get('website'),
                'description': info.get('longBusinessSummary')
            }

        except Exception as e:
            log.error(f"Error fetching info for {symbol}: {e}")
            return None

    def get_current_price(self, symbol: str) -> Optional[Dict]:
        """
        현재 가격 조회 (실시간)

        Args:
            symbol: 티커 심볼

        Returns:
            현재 가격 정보
        """
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info

            if not info or len(info) <= 1:
                return None

            current_price = info.get('currentPrice') or info.get('regularMarketPrice') or info.get('previousClose')
            previous_close = info.get('previousClose')

            # 변동률 계산
            change = None
            change_percent = None

            if current_price and previous_close:
                change = current_price - previous_close
                change_percent = (change / previous_close) * 100

            return {
                'symbol': symbol,
                'current_price': current_price,
                'previous_close': previous_close,
                'change': change,
                'change_percent': change_percent,
                'volume': info.get('volume'),
                'timestamp': datetime.now().isoformat()
            }

        except Exception as e:
            log.error(f"Error fetching current price for {symbol}: {e}")
            return None

    def get_historical_data(
        self,
        symbol: str,
        period: str = "1mo",
        interval: str = "1d",
        start: Optional[Union[str, date]] = None,
        end: Optional[Union[str, date]] = None
    ) -> Optional[pd.DataFrame]:
        """
        히스토리컬 데이터 조회

        Args:
            symbol: 티커 심볼
            period: 기간 (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max)
            interval: 간격 (1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo)
            start: 시작일 (YYYY-MM-DD)
            end: 종료일 (YYYY-MM-DD)

        Returns:
            pandas DataFrame (columns: Open, High, Low, Close, Volume)
        """
        try:
            ticker = yf.Ticker(symbol)

            if start and end:
                df = ticker.history(start=start, end=end, interval=interval)
            else:
                df = ticker.history(period=period, interval=interval)

            if df.empty:
                log.warning(f"No historical data found for {symbol}")
                return None

            return df

        except Exception as e:
            log.error(f"Error fetching historical data for {symbol}: {e}")
            return None

    def get_historical_data_as_dict(
        self,
        symbol: str,
        period: str = "1mo",
        interval: str = "1d",
        start: Optional[Union[str, date]] = None,
        end: Optional[Union[str, date]] = None
    ) -> Optional[List[Dict]]:
        """
        히스토리컬 데이터를 딕셔너리 리스트로 반환

        Args:
            symbol: 티커 심볼
            period: 기간
            interval: 간격
            start: 시작일
            end: 종료일

        Returns:
            히스토리컬 데이터 리스트
        """
        df = self.get_historical_data(
            symbol=symbol,
            period=period,
            interval=interval,
            start=start,
            end=end
        )

        if df is None or df.empty:
            return None

        # DataFrame을 딕셔너리 리스트로 변환
        data = []
        for index, row in df.iterrows():
            data.append({
                'date': index.strftime('%Y-%m-%d') if hasattr(index, 'strftime') else str(index),
                'open': round(row['Open'], 2) if pd.notna(row['Open']) else None,
                'high': round(row['High'], 2) if pd.notna(row['High']) else None,
                'low': round(row['Low'], 2) if pd.notna(row['Low']) else None,
                'close': round(row['Close'], 2) if pd.notna(row['Close']) else None,
                'volume': int(row['Volume']) if pd.notna(row['Volume']) else None
            })

        return data

    def get_dividends(self, symbol: str) -> Optional[pd.Series]:
        """
        배당 이력 조회

        Args:
            symbol: 티커 심볼

        Returns:
            배당 데이터 Series
        """
        try:
            ticker = yf.Ticker(symbol)
            dividends = ticker.dividends

            if dividends.empty:
                log.debug(f"No dividend data for {symbol}")
                return None

            return dividends

        except Exception as e:
            log.error(f"Error fetching dividends for {symbol}: {e}")
            return None

    def get_dividends_as_dict(self, symbol: str, limit: int = 10) -> Optional[List[Dict]]:
        """
        배당 이력을 딕셔너리 리스트로 반환

        Args:
            symbol: 티커 심볼
            limit: 최대 개수

        Returns:
            배당 데이터 리스트
        """
        dividends = self.get_dividends(symbol)

        if dividends is None or dividends.empty:
            return None

        # 최근 데이터부터 limit개 반환
        recent_dividends = dividends.tail(limit)

        data = []
        for date_idx, value in recent_dividends.items():
            data.append({
                'date': date_idx.strftime('%Y-%m-%d') if hasattr(date_idx, 'strftime') else str(date_idx),
                'dividend': round(float(value), 4)
            })

        return data

    def get_financials(self, symbol: str) -> Optional[Dict]:
        """
        재무제표 조회

        Args:
            symbol: 티커 심볼

        Returns:
            재무제표 데이터
        """
        try:
            ticker = yf.Ticker(symbol)

            financials = {
                'income_statement': None,
                'balance_sheet': None,
                'cash_flow': None
            }

            # 손익계산서
            if not ticker.income_stmt.empty:
                financials['income_statement'] = ticker.income_stmt.to_dict()

            # 대차대조표
            if not ticker.balance_sheet.empty:
                financials['balance_sheet'] = ticker.balance_sheet.to_dict()

            # 현금흐름표
            if not ticker.cashflow.empty:
                financials['cash_flow'] = ticker.cashflow.to_dict()

            return financials

        except Exception as e:
            log.error(f"Error fetching financials for {symbol}: {e}")
            return None

    def get_recommendations(self, symbol: str) -> Optional[pd.DataFrame]:
        """
        애널리스트 추천 의견 조회

        Args:
            symbol: 티커 심볼

        Returns:
            추천 의견 DataFrame
        """
        try:
            ticker = yf.Ticker(symbol)
            recommendations = ticker.recommendations

            if recommendations is None or recommendations.empty:
                log.debug(f"No recommendations for {symbol}")
                return None

            return recommendations

        except Exception as e:
            log.error(f"Error fetching recommendations for {symbol}: {e}")
            return None

    def get_options_chain(self, symbol: str) -> Optional[Dict]:
        """
        옵션 체인 조회

        Args:
            symbol: 티커 심볼

        Returns:
            옵션 데이터 (calls, puts)
        """
        try:
            ticker = yf.Ticker(symbol)

            # 만기일 목록 조회
            expirations = ticker.options

            if not expirations:
                log.debug(f"No options available for {symbol}")
                return None

            # 가장 가까운 만기일의 옵션 조회
            nearest_expiration = expirations[0]
            option_chain = ticker.option_chain(nearest_expiration)

            return {
                'expiration': nearest_expiration,
                'calls': option_chain.calls.to_dict('records') if not option_chain.calls.empty else [],
                'puts': option_chain.puts.to_dict('records') if not option_chain.puts.empty else []
            }

        except Exception as e:
            log.error(f"Error fetching options for {symbol}: {e}")
            return None

    def search_tickers(self, query: str) -> List[Dict]:
        """
        티커 검색 (간단한 구현)

        Args:
            query: 검색어

        Returns:
            검색 결과 리스트
        """
        # yfinance는 직접 검색 기능이 없으므로 간단한 구현
        # 실제로는 별도의 ticker 목록 DB를 활용하는 것이 좋음
        try:
            ticker = yf.Ticker(query.upper())
            info = ticker.info

            if info and len(info) > 1:
                return [{
                    'symbol': query.upper(),
                    'name': info.get('longName') or info.get('shortName', query.upper()),
                    'exchange': info.get('exchange'),
                    'sector': info.get('sector')
                }]
            else:
                return []

        except Exception as e:
            log.debug(f"Search failed for {query}: {e}")
            return []

    def get_multiple_quotes(self, symbols: List[str]) -> List[Dict]:
        """
        여러 종목의 현재가 일괄 조회

        Args:
            symbols: 티커 심볼 리스트

        Returns:
            가격 정보 리스트
        """
        quotes = []

        for symbol in symbols:
            quote = self.get_current_price(symbol)
            if quote:
                quotes.append(quote)

        return quotes

    def get_market_summary(self) -> Dict:
        """
        주요 지수 현황 조회

        Returns:
            주요 지수 정보
        """
        indices = {
            'S&P 500': '^GSPC',
            'Dow Jones': '^DJI',
            'NASDAQ': '^IXIC',
            'Russell 2000': '^RUT',
            'VIX': '^VIX'
        }

        summary = {}

        for name, symbol in indices.items():
            quote = self.get_current_price(symbol)
            if quote:
                summary[name] = {
                    'symbol': symbol,
                    'price': quote['current_price'],
                    'change': quote['change'],
                    'change_percent': quote['change_percent']
                }

        return summary


# Singleton instance
_yahoo_fetcher_instance = None


def get_yahoo_fetcher() -> YahooFinanceFetcher:
    """
    Yahoo Finance Fetcher 싱글톤 인스턴스 반환

    Returns:
        YahooFinanceFetcher 인스턴스
    """
    global _yahoo_fetcher_instance

    if _yahoo_fetcher_instance is None:
        _yahoo_fetcher_instance = YahooFinanceFetcher()

    return _yahoo_fetcher_instance


# 사용 예시
if __name__ == "__main__":
    fetcher = YahooFinanceFetcher()

    print("=== Yahoo Finance Fetcher Test ===\n")

    # 1. 티커 정보
    print("1. Ticker info for AAPL:")
    info = fetcher.get_ticker_info('AAPL')
    if info:
        print(f"   Name: {info['name']}")
        print(f"   Sector: {info['sector']}")
        print(f"   Price: ${info['current_price']}")

    # 2. 현재가
    print("\n2. Current price for AAPL:")
    price = fetcher.get_current_price('AAPL')
    if price:
        print(f"   Price: ${price['current_price']}")
        print(f"   Change: {price['change_percent']}%")

    # 3. 히스토리컬 데이터
    print("\n3. Historical data for AAPL (last 5 days):")
    history = fetcher.get_historical_data_as_dict('AAPL', period='5d')
    if history:
        for day in history[:3]:
            print(f"   {day['date']}: ${day['close']}")

    # 4. 배당
    print("\n4. Recent dividends for AAPL:")
    dividends = fetcher.get_dividends_as_dict('AAPL', limit=5)
    if dividends:
        for div in dividends[-3:]:
            print(f"   {div['date']}: ${div['dividend']}")

    # 5. 시장 요약
    print("\n5. Market summary:")
    summary = fetcher.get_market_summary()
    for name, data in summary.items():
        print(f"   {name}: {data['price']} ({data['change_percent']}%)")

    # 6. 여러 종목 조회
    print("\n6. Multiple quotes:")
    quotes = fetcher.get_multiple_quotes(['AAPL', 'MSFT', 'GOOGL'])
    for quote in quotes:
        print(f"   {quote['symbol']}: ${quote['current_price']} ({quote['change_percent']}%)")
