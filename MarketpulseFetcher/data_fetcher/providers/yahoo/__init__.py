"""Yahoo Finance Provider"""
from data_fetcher.abstract_provider.abstract.provider import Provider
from data_fetcher.providers.yahoo.models.stock_price import YFinanceStockPriceFetcher
from data_fetcher.providers.yahoo.models.stock_quote import YFinanceQuoteFetcher
from data_fetcher.providers.yahoo.models.batch_quotes import YFinanceBatchQuotesFetcher
from data_fetcher.providers.yahoo.models.dividends import YFinanceDividendsFetcher
from data_fetcher.providers.yahoo.models.company_info import YFinanceCompanyInfoFetcher
from data_fetcher.providers.yahoo.models.financials import YFinanceFinancialsFetcher
from data_fetcher.providers.yahoo.models.balance_sheet import YFinanceBalanceSheetFetcher
from data_fetcher.providers.yahoo.models.key_metrics import YFinanceKeyMetricsFetcher
from data_fetcher.providers.yahoo.models.holders import YFinanceHoldersFetcher
from data_fetcher.providers.yahoo.models.calendar import YFinanceCalendarFetcher
from data_fetcher.providers.yahoo.models.splits import YFinanceSplitsFetcher
from data_fetcher.providers.yahoo.models.filings import YFinanceFilingsFetcher
from data_fetcher.providers.yahoo.models.estimates import YFinanceEstimatesFetcher
from data_fetcher.providers.yahoo.models.management import YFinanceManagementFetcher
from data_fetcher.providers.yahoo.models.insider_trading import (
    YFinanceInsiderTradingFetcher,
    YFinanceInsiderHoldersFetcher,
    YFinanceInsiderTradingSummaryFetcher,
)
from data_fetcher.providers.yahoo.models.company_peers import YFinanceCompanyPeersFetcher


yahoo_provider = Provider(
    name="yahoo",
    description="Yahoo Finance",
    website="https://finance.yahoo.com",
    credentials=[],  # No API key required
    fetcher_dict={
        "stock_price": YFinanceStockPriceFetcher,
        "quote":       YFinanceQuoteFetcher,
        "batch_quotes": YFinanceBatchQuotesFetcher,
        "dividends": YFinanceDividendsFetcher,
        "company_info": YFinanceCompanyInfoFetcher,
        "company_peers": YFinanceCompanyPeersFetcher,
        "financials": YFinanceFinancialsFetcher,
        "balance_sheet": YFinanceBalanceSheetFetcher,
        "key_metrics": YFinanceKeyMetricsFetcher,
        "holders": YFinanceHoldersFetcher,
        "calendar": YFinanceCalendarFetcher,
        "splits": YFinanceSplitsFetcher,
        "filings": YFinanceFilingsFetcher,
        "estimates": YFinanceEstimatesFetcher,
        "management": YFinanceManagementFetcher,
        "insider_trading": YFinanceInsiderTradingFetcher,
        "insider_trading_summary": YFinanceInsiderTradingSummaryFetcher,
        "insider_holders": YFinanceInsiderHoldersFetcher,
    },
    metadata={
        "rate_limit": "2000 requests/hour",
        "data_coverage": "Global stock market data",
    }
)
