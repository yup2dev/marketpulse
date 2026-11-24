"""Quantitative Analysis Provider"""
from data_fetcher.abstract_provider.abstract.provider import Provider
from data_fetcher.providers.quantitative.models.summary import QuantSummaryFetcher
from data_fetcher.providers.quantitative.models.normality import QuantNormalityFetcher
from data_fetcher.providers.quantitative.models.capm import QuantCAPMFetcher
from data_fetcher.providers.quantitative.models.rolling import QuantRollingFetcher
from data_fetcher.providers.quantitative.models.unitroot import QuantUnitRootFetcher
from data_fetcher.providers.quantitative.models.correlation import QuantCorrelationFetcher


quantitative_provider = Provider(
    name="quantitative",
    description="Quantitative Analysis Suite — descriptive stats, normality, CAPM, rolling metrics, ADF, correlation",
    credentials=[],
    fetcher_dict={
        "summary": QuantSummaryFetcher,
        "normality": QuantNormalityFetcher,
        "capm": QuantCAPMFetcher,
        "rolling": QuantRollingFetcher,
        "unitroot": QuantUnitRootFetcher,
        "correlation": QuantCorrelationFetcher,
    },
    metadata={
        "rate_limit": "yfinance only",
        "data_coverage": "any yfinance-available ticker",
    },
)
