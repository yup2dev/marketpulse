"""SEC EDGAR Provider Helpers."""
SEC_BASE_URL = "https://www.sec.gov/cgi-bin/browse-edgar"
EDGAR_SUBMISSIONS_URL = "https://data.sec.gov/submissions"
EDGAR_COMPANY_FACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts"

SEC_HEADERS = {
    "User-Agent": "MarketPulse research@example.com",
    "Accept-Encoding": "gzip, deflate",
    "Host": "data.sec.gov",
}
