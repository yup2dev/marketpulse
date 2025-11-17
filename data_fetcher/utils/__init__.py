"""Utilities for data fetchers"""
from data_fetcher.utils.credentials import (
    CredentialsError,
    get_api_key,
    validate_credentials,
    get_credentials_from_env,
    get_credentials_for_api
)
from data_fetcher.utils.http_client import (
    HTTPClient,
    HTTPClientError,
    RateLimitError,
    get_fred_client,
    get_alphavantage_client,
    get_yahoo_client
)
from data_fetcher.utils.validators import (
    ValidationError,
    validate_date,
    validate_symbol,
    validate_numeric,
    validate_country_code,
    validate_frequency,
    validate_date_range,
    validate_limit
)
from data_fetcher.utils.helpers import (
    calculate_growth_rate,
    calculate_change,
    safe_float,
    safe_int,
    parse_date,
    get_date_range,
    chunk_list,
    flatten_dict,
    merge_dicts,
    format_number,
    deduplicate_list,
    filter_none_values
)

__all__ = [
    # Credentials
    'CredentialsError',
    'get_api_key',
    'validate_credentials',
    'get_credentials_from_env',
    'get_credentials_for_api',

    # HTTP Client
    'HTTPClient',
    'HTTPClientError',
    'RateLimitError',
    'get_fred_client',
    'get_alphavantage_client',
    'get_yahoo_client',

    # Validators
    'ValidationError',
    'validate_date',
    'validate_symbol',
    'validate_numeric',
    'validate_country_code',
    'validate_frequency',
    'validate_date_range',
    'validate_limit',

    # Helpers
    'calculate_growth_rate',
    'calculate_change',
    'safe_float',
    'safe_int',
    'parse_date',
    'get_date_range',
    'chunk_list',
    'flatten_dict',
    'merge_dicts',
    'format_number',
    'deduplicate_list',
    'filter_none_values',
]
