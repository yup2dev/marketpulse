"""QuantLib Provider"""
from data_fetcher.abstract_provider.abstract.provider import Provider
from data_fetcher.providers.quantlib.models.pricing import QuantLibPricingFetcher


quantlib_provider = Provider(
    name="quantlib",
    description="QuantLib Suite — local quantitative computation (no external API)",
    website="https://www.quantlib.org",
    credentials=[],
    fetcher_dict={"pricing": QuantLibPricingFetcher},
    metadata={
        "rate_limit": "none (local computation)",
        "data_coverage": "Option pricing, Greeks, curves, risk, volatility",
    }
)
