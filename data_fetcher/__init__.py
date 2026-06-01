"""
data_fetcher — 금융 데이터 수집 라이브러리

주요 진입점:
    from data_fetcher.query_executor import QueryExecutor
    from data_fetcher.abstract_provider.abstract import Fetcher, BaseData, BaseQueryParams
    from data_fetcher.abstract_provider.abstract.provider import Provider, ProviderRegistry
    from data_fetcher.abstract_provider.standard_models import EquityQuoteData, ...
    from data_fetcher.providers.{name}.fetchers.{module} import {FetcherClass}
"""
__version__ = "0.1.0"
