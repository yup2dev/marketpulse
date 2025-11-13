"""
Financial Data Fetcher

무료 데이터 소스를 활용한 재무지표 수집:
- yfinance: 재무제표, 밸류에이션 지표
- FRED API: CDS 스프레드, 채권 데이터
"""
import logging
from datetime import datetime, date
from typing import Optional, Dict, Any
import yfinance as yf
from decimal import Decimal

log = logging.getLogger(__name__)


class FinancialDataFetcher:
    """재무 데이터 수집기"""

    def __init__(self):
        self.logger = log

    def fetch_financial_metrics(self, ticker: str) -> Optional[Dict[str, Any]]:
        """
        yfinance로 재무지표 수집

        Args:
            ticker: 종목 코드

        Returns:
            재무지표 딕셔너리
        """
        try:
            stock = yf.Ticker(ticker)
            info = stock.info

            # 재무제표 가져오기
            balance_sheet = stock.balance_sheet
            financials = stock.financials

            metrics = {
                'stk_cd': ticker,
                'stk_nm': info.get('longName', ticker),
                'base_ymd': date.today(),
            }

            # 재무비율 계산
            if not balance_sheet.empty and len(balance_sheet.columns) > 0:
                latest_bs = balance_sheet.iloc[:, 0]

                # 총자산, 총부채
                total_assets = latest_bs.get('Total Assets', 0)
                total_liabilities = latest_bs.get('Total Liabilities Net Minority Interest', 0)
                total_equity = latest_bs.get('Stockholders Equity', 0)
                current_assets = latest_bs.get('Current Assets', 0)
                current_liabilities = latest_bs.get('Current Liabilities', 0)

                # 부채/자산 비율
                if total_assets and total_assets > 0:
                    metrics['debt_to_asset'] = float(total_liabilities / total_assets)

                # 부채/자본 비율
                if total_equity and total_equity > 0:
                    metrics['debt_to_equity'] = float(total_liabilities / total_equity)

                # 유동비율
                if current_liabilities and current_liabilities > 0:
                    metrics['current_ratio'] = float(current_assets / current_liabilities)

            # info에서 추가 지표
            metrics['pe_ratio'] = info.get('trailingPE', None)
            metrics['pb_ratio'] = info.get('priceToBook', None)
            metrics['market_cap'] = info.get('marketCap', None)
            metrics['roe'] = info.get('returnOnEquity', None)
            metrics['roa'] = info.get('returnOnAssets', None)
            metrics['profit_margin'] = info.get('profitMargins', None)

            # 회계기간 (가장 최근 분기)
            if not balance_sheet.empty:
                latest_date = balance_sheet.columns[0]
                if hasattr(latest_date, 'strftime'):
                    metrics['fiscal_period'] = latest_date.strftime('%Y-%m')
                else:
                    metrics['fiscal_period'] = str(latest_date)[:7]

            self.logger.info(f"Fetched financial metrics for {ticker}")
            return metrics

        except Exception as e:
            self.logger.error(f"Error fetching financial metrics for {ticker}: {e}")
            return None

    def fetch_corporate_bond_data(self) -> Optional[Dict[str, Any]]:
        """
        기업채권 발행량 데이터 수집 (시뮬레이션)

        주의: 실제 채권 발행량 데이터는 Bloomberg, TRACE 등이 필요
        여기서는 FRED의 채권 스프레드 데이터를 대안으로 제공
        """
        try:
            # FRED에서 BAA 등급 회사채 수익률 가져오기 (yfinance 대안)
            # ^TNX: 10년물 국채, BAA: Moody's Baa Corporate Bond Yield
            treasury_10y = yf.Ticker("^TNX")
            hist = treasury_10y.history(period="1d")

            if not hist.empty:
                bond_data = {
                    'treasury_10y_yield': float(hist['Close'].iloc[-1]),
                    'base_ymd': date.today(),
                    'data_source': 'yfinance'
                }
                return bond_data

            return None

        except Exception as e:
            self.logger.error(f"Error fetching bond data: {e}")
            return None

    def fetch_credit_spread_indicators(self) -> Dict[str, Any]:
        """
        신용 스프레드 지표 수집

        실제 CDS 프리미엄 데이터는 유료이므로,
        무료 대안으로 하이일드 스프레드와 투자등급 채권 스프레드를 제공
        """
        try:
            indicators = {}

            # High Yield 대리 지표: HYG (iShares iBoxx High Yield Corporate Bond ETF)
            hyg = yf.Ticker("HYG")
            hyg_hist = hyg.history(period="30d")

            if not hyg_hist.empty:
                indicators['high_yield_etf_price'] = float(hyg_hist['Close'].iloc[-1])
                indicators['high_yield_30d_change'] = float(
                    (hyg_hist['Close'].iloc[-1] - hyg_hist['Close'].iloc[0]) / hyg_hist['Close'].iloc[0] * 100
                )

            # Investment Grade 대리 지표: LQD (iShares iBoxx Investment Grade Corporate Bond ETF)
            lqd = yf.Ticker("LQD")
            lqd_hist = lqd.history(period="30d")

            if not lqd_hist.empty:
                indicators['investment_grade_etf_price'] = float(lqd_hist['Close'].iloc[-1])
                indicators['investment_grade_30d_change'] = float(
                    (lqd_hist['Close'].iloc[-1] - lqd_hist['Close'].iloc[0]) / lqd_hist['Close'].iloc[0] * 100
                )

            # VIX (변동성 지수) - 시장 리스크 대리 지표
            vix = yf.Ticker("^VIX")
            vix_hist = vix.history(period="1d")

            if not vix_hist.empty:
                indicators['vix'] = float(vix_hist['Close'].iloc[-1])

            indicators['base_ymd'] = date.today()
            indicators['note'] = "Using ETF prices as proxy for credit spreads (HYG for high-yield, LQD for investment-grade)"

            return indicators

        except Exception as e:
            self.logger.error(f"Error fetching credit spread indicators: {e}")
            return {}

    def fetch_multiple_financials(self, tickers: list) -> Dict[str, Any]:
        """
        여러 종목의 재무지표를 한 번에 수집

        Args:
            tickers: 종목 코드 리스트

        Returns:
            {ticker: metrics} 딕셔너리
        """
        results = {}
        for ticker in tickers:
            metrics = self.fetch_financial_metrics(ticker)
            if metrics:
                results[ticker] = metrics

        return results


# Singleton instance
_fetcher_instance = None


def get_financial_fetcher() -> FinancialDataFetcher:
    """Financial Fetcher 싱글톤 인스턴스 반환"""
    global _fetcher_instance
    if _fetcher_instance is None:
        _fetcher_instance = FinancialDataFetcher()
    return _fetcher_instance
