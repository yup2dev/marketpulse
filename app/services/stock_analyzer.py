"""
Stock Analyzer Service

주식 데이터 분석 및 기술 지표 계산
- 가격 추세 분석
- 변동성 계산
- 기술 지표 (이동평균, RSI, 볼린저 밴드 등)
- 섹터별 분석
"""
import logging
from datetime import datetime, date, timedelta
from typing import List, Dict, Optional, Tuple
from decimal import Decimal
import statistics
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

log = logging.getLogger(__name__)


class StockAnalyzer:
    """주식 데이터 분석 서비스"""

    def __init__(self, db_session: Session):
        """
        Args:
            db_session: SQLAlchemy Session
        """
        self.session = db_session

    def get_stock_price_history(
        self,
        ticker: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        limit: int = 100
    ) -> List[Dict]:
        """
        주식 가격 히스토리 조회

        Args:
            ticker: 종목 코드
            start_date: 시작일
            end_date: 종료일
            limit: 최대 조회 개수

        Returns:
            가격 데이터 리스트
        """
        from app.models.database import MBS_IN_STK_STBD

        query = self.session.query(MBS_IN_STK_STBD).filter(
            MBS_IN_STK_STBD.stk_cd == ticker
        )

        if start_date:
            query = query.filter(MBS_IN_STK_STBD.base_ymd >= start_date)

        if end_date:
            query = query.filter(MBS_IN_STK_STBD.base_ymd <= end_date)

        results = query.order_by(desc(MBS_IN_STK_STBD.base_ymd)).limit(limit).all()

        return [r.to_dict() for r in results]

    def get_latest_price(self, ticker: str) -> Optional[Dict]:
        """
        최신 주가 조회

        Args:
            ticker: 종목 코드

        Returns:
            최신 가격 정보
        """
        from app.models.database import MBS_IN_STK_STBD

        result = self.session.query(MBS_IN_STK_STBD).filter(
            MBS_IN_STK_STBD.stk_cd == ticker
        ).order_by(desc(MBS_IN_STK_STBD.base_ymd)).first()

        return result.to_dict() if result else None

    def calculate_price_change(
        self,
        ticker: str,
        period_days: int = 30
    ) -> Optional[Dict]:
        """
        가격 변동 계산

        Args:
            ticker: 종목 코드
            period_days: 기간 (일)

        Returns:
            가격 변동 정보
        """
        end_date = date.today()
        start_date = end_date - timedelta(days=period_days)

        history = self.get_stock_price_history(
            ticker=ticker,
            start_date=start_date,
            end_date=end_date,
            limit=period_days + 10
        )

        if len(history) < 2:
            return None

        # 최신가와 시작가
        latest = history[0]
        oldest = history[-1]

        latest_price = float(latest['close_price']) if latest['close_price'] else 0
        oldest_price = float(oldest['close_price']) if oldest['close_price'] else 0

        if oldest_price == 0:
            return None

        # 변동률 계산
        change = latest_price - oldest_price
        change_pct = (change / oldest_price) * 100

        return {
            'ticker': ticker,
            'period_days': period_days,
            'latest_price': latest_price,
            'start_price': oldest_price,
            'price_change': round(change, 2),
            'change_percent': round(change_pct, 2),
            'latest_date': latest['base_ymd'],
            'start_date': oldest['base_ymd']
        }

    def calculate_moving_average(
        self,
        ticker: str,
        period: int = 20
    ) -> Optional[float]:
        """
        이동평균 계산

        Args:
            ticker: 종목 코드
            period: 이동평균 기간 (일)

        Returns:
            이동평균값
        """
        history = self.get_stock_price_history(
            ticker=ticker,
            limit=period
        )

        if len(history) < period:
            log.debug(f"Insufficient data for {period}-day MA: {len(history)} records")
            return None

        prices = [float(h['close_price']) for h in history if h['close_price']]

        if len(prices) < period:
            return None

        return round(statistics.mean(prices), 2)

    def calculate_volatility(
        self,
        ticker: str,
        period_days: int = 30
    ) -> Optional[Dict]:
        """
        변동성 계산 (표준편차 기반)

        Args:
            ticker: 종목 코드
            period_days: 기간 (일)

        Returns:
            변동성 정보
        """
        history = self.get_stock_price_history(
            ticker=ticker,
            limit=period_days
        )

        if len(history) < 2:
            return None

        # 일간 변동률 계산
        daily_returns = []
        for i in range(len(history) - 1):
            current = float(history[i]['close_price']) if history[i]['close_price'] else 0
            previous = float(history[i + 1]['close_price']) if history[i + 1]['close_price'] else 0

            if previous != 0:
                daily_return = ((current - previous) / previous) * 100
                daily_returns.append(daily_return)

        if not daily_returns:
            return None

        # 변동성 = 표준편차
        volatility = statistics.stdev(daily_returns) if len(daily_returns) > 1 else 0

        return {
            'ticker': ticker,
            'period_days': period_days,
            'volatility': round(volatility, 2),
            'avg_daily_return': round(statistics.mean(daily_returns), 2),
            'max_daily_return': round(max(daily_returns), 2),
            'min_daily_return': round(min(daily_returns), 2)
        }

    def calculate_rsi(
        self,
        ticker: str,
        period: int = 14
    ) -> Optional[float]:
        """
        RSI (Relative Strength Index) 계산

        Args:
            ticker: 종목 코드
            period: RSI 기간 (기본 14일)

        Returns:
            RSI 값 (0-100)
        """
        history = self.get_stock_price_history(
            ticker=ticker,
            limit=period + 10
        )

        if len(history) < period + 1:
            return None

        # 가격 변동 계산
        gains = []
        losses = []

        for i in range(len(history) - 1):
            current = float(history[i]['close_price']) if history[i]['close_price'] else 0
            previous = float(history[i + 1]['close_price']) if history[i + 1]['close_price'] else 0

            change = current - previous

            if change > 0:
                gains.append(change)
                losses.append(0)
            else:
                gains.append(0)
                losses.append(abs(change))

        if len(gains) < period:
            return None

        # RSI 계산
        avg_gain = statistics.mean(gains[:period])
        avg_loss = statistics.mean(losses[:period])

        if avg_loss == 0:
            return 100.0

        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))

        return round(rsi, 2)

    def calculate_bollinger_bands(
        self,
        ticker: str,
        period: int = 20,
        std_dev: float = 2.0
    ) -> Optional[Dict]:
        """
        볼린저 밴드 계산

        Args:
            ticker: 종목 코드
            period: 기간 (기본 20일)
            std_dev: 표준편차 배수 (기본 2)

        Returns:
            볼린저 밴드 정보 (상단, 중단, 하단)
        """
        history = self.get_stock_price_history(
            ticker=ticker,
            limit=period
        )

        if len(history) < period:
            return None

        prices = [float(h['close_price']) for h in history if h['close_price']]

        if len(prices) < period:
            return None

        # 이동평균 (중단 밴드)
        ma = statistics.mean(prices)

        # 표준편차
        std = statistics.stdev(prices)

        # 상단/하단 밴드
        upper_band = ma + (std_dev * std)
        lower_band = ma - (std_dev * std)

        latest_price = prices[0]

        return {
            'ticker': ticker,
            'period': period,
            'latest_price': round(latest_price, 2),
            'middle_band': round(ma, 2),
            'upper_band': round(upper_band, 2),
            'lower_band': round(lower_band, 2),
            'band_width': round(upper_band - lower_band, 2),
            'position': self._get_price_position(latest_price, lower_band, upper_band)
        }

    def _get_price_position(self, price: float, lower: float, upper: float) -> str:
        """
        볼린저 밴드 내 가격 위치 판단

        Args:
            price: 현재 가격
            lower: 하단 밴드
            upper: 상단 밴드

        Returns:
            위치 ('oversold', 'normal', 'overbought')
        """
        if price < lower:
            return 'oversold'
        elif price > upper:
            return 'overbought'
        else:
            return 'normal'

    def get_sector_performance(
        self,
        sector: Optional[str] = None,
        limit: int = 10
    ) -> List[Dict]:
        """
        섹터별 성과 조회

        Args:
            sector: 섹터명 (None이면 전체)
            limit: 최대 조회 개수

        Returns:
            섹터 성과 리스트
        """
        from app.models.database import MBS_IN_STK_STBD
        from sqlalchemy import func

        today = date.today()

        query = self.session.query(
            MBS_IN_STK_STBD.sector,
            func.avg(MBS_IN_STK_STBD.change_rate).label('avg_change'),
            func.count(MBS_IN_STK_STBD.stk_cd).label('stock_count')
        ).filter(
            MBS_IN_STK_STBD.base_ymd == today,
            MBS_IN_STK_STBD.sector.isnot(None)
        )

        if sector:
            query = query.filter(MBS_IN_STK_STBD.sector == sector)

        results = query.group_by(
            MBS_IN_STK_STBD.sector
        ).order_by(
            desc('avg_change')
        ).limit(limit).all()

        return [
            {
                'sector': r.sector,
                'avg_change_rate': round(float(r.avg_change), 2) if r.avg_change else 0,
                'stock_count': r.stock_count
            }
            for r in results
        ]

    def get_top_performers(
        self,
        sector: Optional[str] = None,
        limit: int = 10
    ) -> List[Dict]:
        """
        상위 성과 종목 조회

        Args:
            sector: 섹터명 (필터링 옵션)
            limit: 최대 조회 개수

        Returns:
            상위 성과 종목 리스트
        """
        from app.models.database import MBS_IN_STK_STBD

        today = date.today()

        query = self.session.query(MBS_IN_STK_STBD).filter(
            MBS_IN_STK_STBD.base_ymd == today,
            MBS_IN_STK_STBD.change_rate.isnot(None)
        )

        if sector:
            query = query.filter(MBS_IN_STK_STBD.sector == sector)

        results = query.order_by(
            desc(MBS_IN_STK_STBD.change_rate)
        ).limit(limit).all()

        return [r.to_dict() for r in results]

    def get_bottom_performers(
        self,
        sector: Optional[str] = None,
        limit: int = 10
    ) -> List[Dict]:
        """
        하위 성과 종목 조회

        Args:
            sector: 섹터명 (필터링 옵션)
            limit: 최대 조회 개수

        Returns:
            하위 성과 종목 리스트
        """
        from app.models.database import MBS_IN_STK_STBD

        today = date.today()

        query = self.session.query(MBS_IN_STK_STBD).filter(
            MBS_IN_STK_STBD.base_ymd == today,
            MBS_IN_STK_STBD.change_rate.isnot(None)
        )

        if sector:
            query = query.filter(MBS_IN_STK_STBD.sector == sector)

        results = query.order_by(
            MBS_IN_STK_STBD.change_rate.asc()
        ).limit(limit).all()

        return [r.to_dict() for r in results]

    def get_stock_summary(self, ticker: str) -> Optional[Dict]:
        """
        종목 종합 분석

        Args:
            ticker: 종목 코드

        Returns:
            종합 분석 정보
        """
        latest = self.get_latest_price(ticker)

        if not latest:
            return None

        # 30일 변동
        change_30d = self.calculate_price_change(ticker, period_days=30)

        # 이동평균
        ma_20 = self.calculate_moving_average(ticker, period=20)
        ma_50 = self.calculate_moving_average(ticker, period=50)

        # 변동성
        volatility = self.calculate_volatility(ticker, period_days=30)

        # RSI
        rsi = self.calculate_rsi(ticker, period=14)

        # 볼린저 밴드
        bollinger = self.calculate_bollinger_bands(ticker, period=20)

        return {
            'ticker': ticker,
            'ticker_name': latest.get('stk_nm'),
            'sector': latest.get('sector'),
            'latest_price': latest.get('close_price'),
            'latest_change_rate': latest.get('change_rate'),
            'latest_date': latest.get('base_ymd'),
            'change_30d': change_30d,
            'moving_averages': {
                'ma_20': ma_20,
                'ma_50': ma_50
            },
            'volatility': volatility,
            'rsi': rsi,
            'bollinger_bands': bollinger
        }

    def compare_stocks(self, tickers: List[str]) -> List[Dict]:
        """
        여러 종목 비교

        Args:
            tickers: 종목 코드 리스트

        Returns:
            비교 정보 리스트
        """
        comparisons = []

        for ticker in tickers:
            summary = self.get_stock_summary(ticker)
            if summary:
                comparisons.append(summary)

        return comparisons


# Singleton instance
_stock_analyzer_instance = None


def get_stock_analyzer(db_session: Session = None) -> StockAnalyzer:
    """
    Stock Analyzer 인스턴스 반환

    Args:
        db_session: SQLAlchemy Session (옵션)

    Returns:
        StockAnalyzer 인스턴스
    """
    global _stock_analyzer_instance

    if db_session:
        return StockAnalyzer(db_session)

    if _stock_analyzer_instance is None:
        from app.models.database import SessionLocal
        session = SessionLocal()
        _stock_analyzer_instance = StockAnalyzer(session)

    return _stock_analyzer_instance


# 사용 예시
if __name__ == "__main__":
    from app.models.database import SessionLocal

    session = SessionLocal()
    analyzer = StockAnalyzer(session)

    print("=== Stock Analyzer Test ===\n")

    # 1. 최신 주가
    print("1. Latest price for AAPL:")
    latest = analyzer.get_latest_price('AAPL')
    if latest:
        print(f"   Price: ${latest['close_price']}, Change: {latest['change_rate']}%")
    else:
        print("   No data found")

    # 2. 30일 가격 변동
    print("\n2. 30-day price change for AAPL:")
    change = analyzer.calculate_price_change('AAPL', period_days=30)
    if change:
        print(f"   Change: {change['change_percent']}%")

    # 3. 이동평균
    print("\n3. Moving averages for AAPL:")
    ma_20 = analyzer.calculate_moving_average('AAPL', period=20)
    ma_50 = analyzer.calculate_moving_average('AAPL', period=50)
    print(f"   MA(20): ${ma_20}, MA(50): ${ma_50}")

    # 4. RSI
    print("\n4. RSI for AAPL:")
    rsi = analyzer.calculate_rsi('AAPL', period=14)
    print(f"   RSI(14): {rsi}")

    # 5. 볼린저 밴드
    print("\n5. Bollinger Bands for AAPL:")
    bollinger = analyzer.calculate_bollinger_bands('AAPL', period=20)
    if bollinger:
        print(f"   Upper: ${bollinger['upper_band']}")
        print(f"   Middle: ${bollinger['middle_band']}")
        print(f"   Lower: ${bollinger['lower_band']}")
        print(f"   Position: {bollinger['position']}")

    # 6. 섹터 성과
    print("\n6. Sector performance:")
    sectors = analyzer.get_sector_performance(limit=5)
    for s in sectors:
        print(f"   {s['sector']}: {s['avg_change_rate']}% ({s['stock_count']} stocks)")

    # 7. 종합 분석
    print("\n7. Stock summary for AAPL:")
    summary = analyzer.get_stock_summary('AAPL')
    if summary:
        print(f"   Ticker: {summary['ticker']} ({summary['ticker_name']})")
        print(f"   Sector: {summary['sector']}")
        print(f"   Latest: ${summary['latest_price']} ({summary['latest_change_rate']}%)")
        print(f"   RSI: {summary['rsi']}")

    session.close()
