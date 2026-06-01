"""Yahoo Finance SWOT Analysis Model"""
from typing import Optional, List
from pydantic import Field
from data_fetcher.abstract_provider.abstract import BaseQueryParams, BaseData


class YFinanceSWOTQueryParams(BaseQueryParams):
    symbol: str = Field(description="종목 코드")


class YFinanceSWOTItem(BaseData):
    """SWOT 항목"""
    label: str
    value: str
    type: str  # 'positive' | 'negative'


class YFinanceSWOTData(BaseData):
    """SWOT 분석 데이터"""
    symbol: str
    strengths: List[YFinanceSWOTItem] = Field(default_factory=list)
    weaknesses: List[YFinanceSWOTItem] = Field(default_factory=list)
    opportunities: List[YFinanceSWOTItem] = Field(default_factory=list)
    threats: List[YFinanceSWOTItem] = Field(default_factory=list)
    ai_analysis: Optional[str] = None


"""Yahoo Finance SWOT Analysis Fetcher"""
import logging
from typing import Any, Dict, List, Optional
import yfinance as yf

from data_fetcher.abstract_provider.abstract.fetcher import Fetcher

log = logging.getLogger(__name__)


class YFinanceSWOTFetcher(Fetcher[YFinanceSWOTQueryParams, YFinanceSWOTData]):

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> YFinanceSWOTQueryParams:
        return YFinanceSWOTQueryParams(**params)

    @staticmethod
    def extract_data(
        query: YFinanceSWOTQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        ticker = yf.Ticker(query.symbol)
        return ticker.info

    @staticmethod
    def transform_data(
        query: YFinanceSWOTQueryParams,
        data: Dict[str, Any],
        **kwargs: Any,
    ) -> List[YFinanceSWOTData]:
        info = data or {}
        strengths: List[YFinanceSWOTItem] = []
        weaknesses: List[YFinanceSWOTItem] = []
        opportunities: List[YFinanceSWOTItem] = []
        threats: List[YFinanceSWOTItem] = []

        roe = info.get('returnOnEquity')
        if roe is not None:
            if roe > 0.15:
                strengths.append(YFinanceSWOTItem(label='High ROE', value=f"{roe*100:.1f}%", type='positive'))
            elif roe < 0.05:
                weaknesses.append(YFinanceSWOTItem(label='Low ROE', value=f"{roe*100:.1f}%", type='negative'))

        roa = info.get('returnOnAssets')
        if roa is not None:
            if roa > 0.08:
                strengths.append(YFinanceSWOTItem(label='Strong ROA', value=f"{roa*100:.1f}%", type='positive'))
            elif roa < 0.02:
                weaknesses.append(YFinanceSWOTItem(label='Low ROA', value=f"{roa*100:.1f}%", type='negative'))

        op_margin = info.get('operatingMargins')
        if op_margin is not None:
            if op_margin > 0.20:
                strengths.append(YFinanceSWOTItem(label='High Operating Margin', value=f"{op_margin*100:.1f}%", type='positive'))
            elif op_margin < 0.05:
                weaknesses.append(YFinanceSWOTItem(label='Thin Operating Margin', value=f"{op_margin*100:.1f}%", type='negative'))

        fcf = info.get('freeCashflow')
        if fcf and fcf > 0:
            strengths.append(YFinanceSWOTItem(label='Positive FCF', value=f"${fcf/1e9:.1f}B", type='positive'))
        elif fcf and fcf < 0:
            weaknesses.append(YFinanceSWOTItem(label='Negative FCF', value=f"${fcf/1e9:.1f}B", type='negative'))

        de = info.get('debtToEquity')
        if de is not None:
            if de > 100:
                weaknesses.append(YFinanceSWOTItem(label='High Debt/Equity', value=f"{de:.0f}%", type='negative'))
                threats.append(YFinanceSWOTItem(label='Leverage Risk', value=f"D/E {de:.0f}%", type='negative'))
            elif de < 30:
                strengths.append(YFinanceSWOTItem(label='Low Leverage', value=f"D/E {de:.0f}%", type='positive'))

        rev_growth = info.get('revenueGrowth')
        if rev_growth is not None:
            if rev_growth > 0.10:
                strengths.append(YFinanceSWOTItem(label='Revenue Growth', value=f"{rev_growth*100:.1f}%", type='positive'))
            elif rev_growth < 0:
                weaknesses.append(YFinanceSWOTItem(label='Revenue Decline', value=f"{rev_growth*100:.1f}%", type='negative'))

        eps_growth = info.get('earningsGrowth')
        if eps_growth is not None and eps_growth > 0.15:
            opportunities.append(YFinanceSWOTItem(label='EPS Growth Trend', value=f"{eps_growth*100:.1f}%", type='positive'))

        current_price = info.get('currentPrice') or info.get('regularMarketPrice')
        target_mean = info.get('targetMeanPrice')
        if current_price and target_mean:
            upside = (target_mean - current_price) / current_price * 100
            if upside > 15:
                opportunities.append(YFinanceSWOTItem(label='Analyst Upside', value=f"+{upside:.1f}%", type='positive'))
            elif upside < -10:
                threats.append(YFinanceSWOTItem(label='Analyst Downside', value=f"{upside:.1f}%", type='negative'))

        beta = info.get('beta')
        if beta is not None:
            if beta > 1.5:
                threats.append(YFinanceSWOTItem(label='High Volatility', value=f"Beta {beta:.2f}", type='negative'))
            elif beta < 0.7:
                strengths.append(YFinanceSWOTItem(label='Low Volatility', value=f"Beta {beta:.2f}", type='positive'))

        market_cap = info.get('marketCap')
        if market_cap and market_cap > 100e9:
            strengths.append(YFinanceSWOTItem(label='Large Cap Stability', value=f"${market_cap/1e9:.0f}B", type='positive'))

        forward_pe = info.get('forwardPE')
        trailing_pe = info.get('trailingPE')
        if forward_pe and trailing_pe and forward_pe < trailing_pe * 0.85:
            opportunities.append(YFinanceSWOTItem(label='Improving Earnings Outlook', value=f"Fwd PE {forward_pe:.1f}", type='positive'))

        return [YFinanceSWOTData(
            symbol=query.symbol,
            strengths=strengths,
            weaknesses=weaknesses,
            opportunities=opportunities,
            threats=threats,
        )]
