"""Yahoo Finance Investment Scorecard Model"""
from data_fetcher.abstract_provider.standard_models.investment_scorecard import (
    InvestmentScorecardQueryParams,
    InvestmentScorecardData,
)


class YFinanceScorecardQueryParams(InvestmentScorecardQueryParams):
    """투자 스코어카드 조회 파라미터 (standard InvestmentScorecard 경유)"""


class YFinanceScorecardData(InvestmentScorecardData):
    """투자 스코어카드 데이터 (standard InvestmentScorecard 경유)"""


"""Yahoo Finance Investment Scorecard Fetcher"""
import logging
from typing import Any, Dict, List, Optional
import yfinance as yf

from data_fetcher.abstract_provider.abstract.base_fetchers import YFinanceFetcher

log = logging.getLogger(__name__)


class YFinanceScorecardFetcher(YFinanceFetcher[YFinanceScorecardQueryParams, YFinanceScorecardData]):

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> YFinanceScorecardQueryParams:
        return YFinanceScorecardQueryParams(**params)

    @staticmethod
    def extract_data(
        query: YFinanceScorecardQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        return yf.Ticker(query.symbol).info

    @staticmethod
    def transform_data(
        query: YFinanceScorecardQueryParams,
        data: Dict[str, Any],
        **kwargs: Any,
    ) -> List[YFinanceScorecardData]:
        info = data or {}

        roe = info.get('returnOnEquity') or 0
        roa = info.get('returnOnAssets') or 0
        op_margin = info.get('operatingMargins') or 0
        net_margin = info.get('profitMargins') or 0
        fundamentals_score = min(100, max(0, int(
            (min(roe / 0.20, 1) * 30) +
            (min(roa / 0.10, 1) * 20) +
            (min(op_margin / 0.25, 1) * 30) +
            (min(net_margin / 0.15, 1) * 20)
        ) * 100 // 100))

        rev_growth = info.get('revenueGrowth') or 0
        eps_growth = info.get('earningsGrowth') or 0
        eq_growth  = info.get('earningsQuarterlyGrowth') or 0
        growth_score = min(100, max(0, int(
            (min(max(rev_growth, 0) / 0.20, 1) * 40) +
            (min(max(eps_growth, 0) / 0.25, 1) * 40) +
            (min(max(eq_growth,  0) / 0.20, 1) * 20)
        ) * 100 // 100))

        pe = info.get('trailingPE') or 0
        pb = info.get('priceToBook') or 0
        ev_ebitda = info.get('enterpriseToEbitda') or 0
        pe_score   = max(0, 100 - min(pe / 30, 1) * 100) if pe > 0 else 50
        pb_score   = max(0, 100 - min(pb / 5,  1) * 100) if pb > 0 else 50
        eveb_score = max(0, 100 - min(ev_ebitda / 20, 1) * 100) if ev_ebitda > 0 else 50
        valuation_score = int(pe_score * 0.4 + pb_score * 0.3 + eveb_score * 0.3)

        current_price = info.get('currentPrice') or info.get('regularMarketPrice') or 0
        target_mean   = info.get('targetMeanPrice') or 0
        upside = ((target_mean - current_price) / current_price * 100) if current_price and target_mean else 0
        rec_mean = info.get('recommendationMean') or 3
        analyst_score  = max(0, 100 - (rec_mean - 1) / 4 * 100)
        upside_score   = min(100, max(0, 50 + upside * 2))
        sentiment_score = int(analyst_score * 0.6 + upside_score * 0.4)

        price = info.get('currentPrice') or info.get('regularMarketPrice') or 0
        ma50  = info.get('fiftyDayAverage') or 0
        ma200 = info.get('twoHundredDayAverage') or 0
        if price and ma50 and ma200:
            if price > ma50 > ma200:
                ma_score = 100
            elif price > ma50 or price > ma200:
                ma_score = 60
            else:
                ma_score = 20
        else:
            ma_score = 0
        technical_score = ma_score

        overall = int(
            fundamentals_score * 0.30 +
            growth_score       * 0.25 +
            valuation_score    * 0.20 +
            sentiment_score    * 0.15 +
            technical_score    * 0.10
        )
        if overall >= 80:
            grade = 'Strong Buy'
        elif overall >= 65:
            grade = 'Buy'
        elif overall >= 45:
            grade = 'Hold'
        elif overall >= 30:
            grade = 'Sell'
        else:
            grade = 'Strong Sell'

        return [YFinanceScorecardData(
            symbol=query.symbol,
            overall_score=overall,
            investment_grade=grade,
            categories={
                'fundamentals': {'score': fundamentals_score, 'detail': {
                    'ROE': f"{roe*100:.1f}%" if roe else 'N/A',
                    'ROA': f"{roa*100:.1f}%" if roa else 'N/A',
                    'Op Margin': f"{op_margin*100:.1f}%" if op_margin else 'N/A',
                }},
                'growth': {'score': growth_score, 'detail': {
                    'Rev Growth': f"{rev_growth*100:.1f}%" if rev_growth else 'N/A',
                    'EPS Growth': f"{eps_growth*100:.1f}%" if eps_growth else 'N/A',
                }},
                'valuation': {'score': valuation_score, 'detail': {
                    'P/E': f"{pe:.1f}" if pe else 'N/A',
                    'P/B': f"{pb:.1f}" if pb else 'N/A',
                    'EV/EBITDA': f"{ev_ebitda:.1f}" if ev_ebitda else 'N/A',
                }},
                'sentiment': {'score': sentiment_score, 'detail': {
                    'Analyst Rating': f"{rec_mean:.1f}/5" if rec_mean else 'N/A',
                    'Price Upside': f"+{upside:.1f}%" if upside > 0 else f"{upside:.1f}%",
                }},
                'technical': {'score': technical_score, 'detail': {
                    '50 MA': f"${ma50:.2f}" if ma50 else 'N/A',
                    '200 MA': f"${ma200:.2f}" if ma200 else 'N/A',
                    'Price vs MAs': 'Above' if price > ma50 else 'Below',
                }},
            },
            outlook={
                'short_term':  'Positive' if technical_score >= 60 else 'Neutral' if technical_score >= 30 else 'Negative',
                'medium_term': 'Positive' if growth_score >= 60 else 'Neutral' if growth_score >= 30 else 'Negative',
                'long_term':   'Positive' if fundamentals_score >= 60 else 'Neutral' if fundamentals_score >= 30 else 'Negative',
            },
        )]
