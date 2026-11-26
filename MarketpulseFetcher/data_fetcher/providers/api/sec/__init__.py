"""SEC Provider"""
from data_fetcher.abstract_provider.abstract.provider import Provider
from data_fetcher.providers.api.sec.models.institutional_13f import (
    SEC13FFetcher, SEC13FFilingsFetcher, SEC13FInstitutionsFetcher,
)
from data_fetcher.providers.api.sec.models.institutions_list import SECInstitutionsListFetcher
from data_fetcher.providers.api.sec.models.balance_sheet import SecBalanceSheetFetcher
from data_fetcher.providers.api.sec.models.balance_sheet_growth import SecBalanceSheetGrowthFetcher
from data_fetcher.providers.api.sec.models.cash_flow import SecCashFlowStatementFetcher
from data_fetcher.providers.api.sec.models.cash_flow_growth import SecCashFlowStatementGrowthFetcher
from data_fetcher.providers.api.sec.models.cik_map import SecCikMapFetcher
from data_fetcher.providers.api.sec.models.company_filings import SecCompanyFilingsFetcher
from data_fetcher.providers.api.sec.models.compare_company_facts import SecCompareCompanyFactsFetcher
from data_fetcher.providers.api.sec.models.equity_ftd import SecEquityFtdFetcher
from data_fetcher.providers.api.sec.models.equity_search import SecEquitySearchFetcher
from data_fetcher.providers.api.sec.models.financials import SecFinancialsFetcher
from data_fetcher.providers.api.sec.models.form_13FHR import SecForm13FHRFetcher
from data_fetcher.providers.api.sec.models.htm_file import SecHtmFileFetcher
from data_fetcher.providers.api.sec.models.income_statement import SecIncomeStatementFetcher
from data_fetcher.providers.api.sec.models.income_statement_growth import SecIncomeStatementGrowthFetcher
from data_fetcher.providers.api.sec.models.insider_trading import SecInsiderTradingFetcher
from data_fetcher.providers.api.sec.models.institutions_search import SecInstitutionsSearchFetcher
from data_fetcher.providers.api.sec.models.latest_financial_reports import SecLatestFinancialReportsFetcher
from data_fetcher.providers.api.sec.models.management_discussion_analysis import SecManagementDiscussionAnalysisFetcher
from data_fetcher.providers.api.sec.models.nport_disclosure import SecNportDisclosureFetcher
from data_fetcher.providers.api.sec.models.rss_litigation import SecRssLitigationFetcher
from data_fetcher.providers.api.sec.models.schema_files import SecSchemaFilesFetcher
from data_fetcher.providers.api.sec.models.sec_filing import SecFilingFetcher
from data_fetcher.providers.api.sec.models.sic_search import SecSicSearchFetcher
from data_fetcher.providers.api.sec.models.symbol_map import SecSymbolMapFetcher


sec_provider = Provider(
    name="sec",
    description="SEC EDGAR — insider trading (Forms 3/4/5), 13F institutional holdings",
    website="https://www.sec.gov/edgar",
    credentials=[],  # EDGAR is keyless (requires only a User-Agent header)
    fetcher_dict={
        # 기존(프로젝트 자체 구현)
        # insider_trading: OpenBB 이식본(SecInsiderTradingFetcher)으로 통일.
        # 과거 자체 스텁(SECInsiderTradingFetcher)은 query.ticker 버그 + CIK 하드코딩으로
        # 깨져 있어 제거하고, Form 4 XML을 실제 파싱하는 이식본으로 대체했다.
        "insider_trading": SecInsiderTradingFetcher,
        "institutional_13f": SEC13FFetcher,
        "institutions_list": SECInstitutionsListFetcher,
        "13f_filings": SEC13FFilingsFetcher,
        "13f_institutions": SEC13FInstitutionsFetcher,
        "financials": SecFinancialsFetcher,
        "balance_sheet": SecBalanceSheetFetcher,
        "balance_sheet_growth": SecBalanceSheetGrowthFetcher,
        "cash_flow": SecCashFlowStatementFetcher,
        "cash_flow_growth": SecCashFlowStatementGrowthFetcher,
        "income_statement": SecIncomeStatementFetcher,
        "income_statement_growth": SecIncomeStatementGrowthFetcher,
        "cik_map": SecCikMapFetcher,
        # yahoo와 같은 model 키 — standard CompanyFilings 공유
        "filings": SecCompanyFilingsFetcher,
        "compare_company_facts": SecCompareCompanyFactsFetcher,
        "equity_ftd": SecEquityFtdFetcher,
        "equity_search": SecEquitySearchFetcher,
        "sec_filing": SecFilingFetcher,
        "htm_file": SecHtmFileFetcher,
        "form_13FHR": SecForm13FHRFetcher,
        "institutions_search": SecInstitutionsSearchFetcher,
        "latest_financial_reports": SecLatestFinancialReportsFetcher,
        "management_discussion_analysis": SecManagementDiscussionAnalysisFetcher,
        "nport_disclosure": SecNportDisclosureFetcher,
        "rss_litigation": SecRssLitigationFetcher,
        "schema_files": SecSchemaFilesFetcher,
        "sic_search": SecSicSearchFetcher,
        "symbol_map": SecSymbolMapFetcher,
    },
    metadata={
        "group": "stock",
        "rate_limit": "10 requests/second (fair-access policy)",
        "data_coverage": "US public company filings",
    },
)
