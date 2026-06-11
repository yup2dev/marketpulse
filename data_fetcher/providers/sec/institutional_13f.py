"""
SEC 13F Institutional Holdings — QueryParams + Data + Fetcher
Clean implementation using Base Fetcher pattern and SEC official data
"""
import logging
import time
from typing import Any, Dict, List, Optional
import requests
from bs4 import BeautifulSoup
import xml.etree.ElementTree as ET

from pydantic import Field

from data_fetcher.abstract_provider.abstract import BaseQueryParams, BaseData
from data_fetcher.abstract_provider.abstract.fetcher import Fetcher
from data_fetcher.utils.cusip_mapper import cusip_to_ticker
from data_fetcher.providers.sec.institutions_list import SECInstitutionsListFetcher


# ── QueryParams / Data ────────────────────────────────────────────────────────

class InstitutionalHoldingsQueryParams(BaseQueryParams):
    """기관 보유 현황 조회 파라미터"""
    institution_key: str = Field(description="기관 식별자 (예: 'berkshire', 'bridgewater')")
    limit: Optional[int] = Field(default=50, description="최대 보유 종목 수")
    summary_only: bool = Field(default=False, description="True이면 종목 목록 없이 요약 데이터만 반환")


class HoldingData(BaseData):
    """개별 보유 종목 데이터"""
    ticker: Optional[str] = Field(default=None, description="종목 심볼")
    cusip: Optional[str] = Field(default=None, description="CUSIP")
    name: Optional[str] = Field(default=None, description="종목명")
    shares: Optional[int] = Field(default=None, description="보유 주식 수")
    value: Optional[float] = Field(default=None, description="보유 가치 ($천)")
    percentage: Optional[float] = Field(default=None, description="포트폴리오 비중 (%)")
    change_shares: Optional[int] = Field(default=None, description="전분기 대비 주식 수 변화")
    change_pct: Optional[float] = Field(default=None, description="전분기 대비 변화율 (%)")
    action: Optional[str] = Field(default=None, description="변화 유형 (New, Add, Reduce, Sell)")


class InstitutionInfo(BaseData):
    """기관 기본 정보"""
    key: Optional[str] = Field(default=None, description="기관 식별자")
    name: Optional[str] = Field(default=None, description="기관명")
    manager: Optional[str] = Field(default=None, description="운용 책임자")
    cik: Optional[str] = Field(default=None, description="SEC CIK")


class InstitutionalHoldingsData(BaseData):
    """기관 보유 현황 데이터"""
    institution: Optional[InstitutionInfo] = Field(default=None, description="기관 정보")
    period: Optional[str] = Field(default=None, description="보고 분기 (YYYY-MM-DD)")
    total_value: Optional[float] = Field(default=None, description="총 보유 가치 ($천)")
    total_holdings: Optional[int] = Field(default=None, description="총 보유 종목 수")
    holdings: List[HoldingData] = Field(default_factory=list, description="보유 종목 목록")
    prev_holdings: List[HoldingData] = Field(default_factory=list, description="전분기 보유 목록")

log = logging.getLogger(__name__)


# Major institutions tracked
INSTITUTIONS = {
    # Legendary Investors
    "berkshire": {
        "cik": "0001067983",
        "name": "Berkshire Hathaway Inc.",
        "manager": "Warren Buffett"
    },
    "soros": {
        "cik": "0001029160",
        "name": "Soros Fund Management LLC",
        "manager": "George Soros"
    },
    "bridgewater": {
        "cik": "0001350694",
        "name": "Bridgewater Associates LP",
        "manager": "Ray Dalio"
    },
    "renaissance": {
        "cik": "0001037389",
        "name": "Renaissance Technologies LLC",
        "manager": "Jim Simons"
    },

    # Modern Icons
    "ark": {
        "cik": "0001649339",
        "name": "ARK Investment Management LLC",
        "manager": "Cathie Wood"
    },
    "pershing": {
        "cik": "0001336528",
        "name": "Pershing Square Capital Management",
        "manager": "Bill Ackman"
    },
    "tiger": {
        "cik": "0001167483",
        "name": "Tiger Global Management LLC",
        "manager": "Chase Coleman"
    },
    "citadel": {
        "cik": "0001423053",
        "name": "Citadel Advisors LLC",
        "manager": "Ken Griffin"
    },

    # Major Asset Managers
    "vanguard": {
        "cik": "0000102909",
        "name": "Vanguard Group Inc.",
        "manager": "Vanguard"
    },
    "blackrock": {
        "cik": "0001086364",
        "name": "BlackRock Inc.",
        "manager": "BlackRock"
    },
    "statestreet": {
        "cik": "0000093751",
        "name": "State Street Corporation",
        "manager": "State Street"
    },
    "fidelity": {
        "cik": "0000315066",
        "name": "FMR LLC (Fidelity)",
        "manager": "Fidelity"
    },

    # Prominent Hedge Funds
    "millennium": {
        "cik": "0001099219",
        "name": "Millennium Management LLC",
        "manager": "Israel Englander"
    },
    "twosigma": {
        "cik": "0001413581",
        "name": "Two Sigma Investments",
        "manager": "Two Sigma"
    },
    "viking": {
        "cik": "0001103804",
        "name": "Viking Global Investors",
        "manager": "Andreas Halvorsen"
    },
    "baupost": {
        "cik": "0001061768",
        "name": "Baupost Group LLC",
        "manager": "Seth Klarman"
    },
    "thirdpoint": {
        "cik": "0001040273",
        "name": "Third Point LLC",
        "manager": "Daniel Loeb"
    },
    "appaloosa": {
        "cik": "0001418814",
        "name": "Appaloosa Management LP",
        "manager": "David Tepper"
    },
    "greenlight": {
        "cik": "0001079114",
        "name": "Greenlight Capital Inc",
        "manager": "David Einhorn"
    },
    "pointstate": {
        "cik": "0001603466",
        "name": "Point72 Asset Management",
        "manager": "Steve Cohen"
    }
}


class SEC13FFetcher(Fetcher[InstitutionalHoldingsQueryParams, InstitutionalHoldingsData]):
    """SEC 13F Holdings Fetcher using official SEC EDGAR data"""

    require_credentials = False  # SEC data is free

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> InstitutionalHoldingsQueryParams:
        """Transform query parameters"""
        return InstitutionalHoldingsQueryParams(**params)

    @staticmethod
    def extract_data(
        query: InstitutionalHoldingsQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        """
        Extract 13F data from SEC EDGAR

        Args:
            query: Query parameters with institution_key
            credentials: Not required for SEC data
            **kwargs: Additional parameters

        Returns:
            Raw data dictionary with holdings and metadata
        """
        institution_key = query.institution_key

        if institution_key not in INSTITUTIONS:
            raise ValueError(f"Unknown institution: {institution_key}")

        inst_info = INSTITUTIONS[institution_key]
        cik = inst_info['cik']

        log.info(f"Fetching 13F for {inst_info['name']} (CIK: {cik})")

        # SEC EDGAR requires User-Agent
        headers = {
            'User-Agent': 'MarketPulse research@marketpulse.com',
            'Accept-Encoding': 'gzip, deflate',
            'Host': 'www.sec.gov'
        }

        try:
            result = SEC13FFetcher._get_latest_filing(cik, headers)
            if not result:
                log.error(f"No 13F filing found for {inst_info['name']}")
                return {'institution': inst_info, 'holdings': [], 'filing_date': None}

            filing_url, date_from_list = result
            log.info(f"Found filing at {filing_url}")

            holdings, filing_date = SEC13FFetcher._parse_filing(filing_url, headers)
            if not filing_date:
                filing_date = date_from_list

            return {
                'institution': inst_info,
                'holdings': holdings,
                'filing_date': filing_date
            }

        except Exception as e:
            log.error(f"Error fetching 13F data: {e}")
            raise

    @staticmethod
    def _get_latest_filing(cik: str, headers: Dict) -> Optional[tuple]:
        """Get (url, filing_date) of latest 13F-HR filing"""
        results = SEC13FFetcher._get_filing_urls(cik, headers, count=1)
        return results[0] if results else None

    @staticmethod
    def _get_filing_urls(cik: str, headers: Dict, count: int = 2) -> List[tuple]:
        """Get URLs and filing dates of the most recent 13F-HR filings.

        Returns:
            List of (filing_url, filing_date) tuples, most recent first
        """
        url = "https://www.sec.gov/cgi-bin/browse-edgar"
        params = {
            'action': 'getcompany',
            'CIK': cik,
            'type': '13F-HR',
            'dateb': '',
            'owner': 'exclude',
            'count': str(count)
        }

        results = []
        try:
            time.sleep(0.15)
            response = requests.get(url, params=params, headers=headers, timeout=30)
            response.raise_for_status()

            soup = BeautifulSoup(response.text, 'html.parser')
            for row in soup.find_all('tr')[1:]:
                cols = row.find_all('td')
                if len(cols) >= 4 and cols[0].text.strip() == '13F-HR':
                    doc_link = cols[1].find('a')
                    if doc_link:
                        filing_date = cols[3].text.strip()  # 검색결과 페이지의 날짜 (신뢰도 높음)
                        results.append(("https://www.sec.gov" + doc_link['href'], filing_date))
                        if len(results) >= count:
                            break

        except Exception as e:
            log.error(f"Error getting filing URLs: {e}")

        return results

    @staticmethod
    def _parse_filing(filing_url: str, headers: Dict) -> tuple[List[Dict], Optional[str]]:
        """Parse holdings from 13F filing, with retry on 503"""
        holdings = []
        filing_date = None

        max_retries = 3
        for attempt in range(max_retries):
            try:
                # Brief delay to respect SEC rate limits (10 req/s max)
                if attempt > 0:
                    time.sleep(2 ** attempt)  # 2s, 4s backoff

                response = requests.get(filing_url, headers=headers, timeout=30)

                if response.status_code == 503 and attempt < max_retries - 1:
                    log.warning(f"SEC 503 on filing index (attempt {attempt + 1}), retrying...")
                    continue

                response.raise_for_status()

                soup = BeautifulSoup(response.text, 'html.parser')

                # Extract filing date
                filing_date_elem = soup.find('div', string=lambda t: t and 'Filing Date' in t)
                if filing_date_elem:
                    date_text = filing_date_elem.text.split(':')[-1].strip()
                    filing_date = date_text

                # Find information table XML
                xml_url = SEC13FFetcher._find_info_table_url(soup, filing_url)
                if not xml_url:
                    log.warning("Could not find information table XML")
                    return holdings, filing_date

                # Parse XML holdings
                holdings = SEC13FFetcher._parse_xml_holdings(xml_url, headers)
                break

            except Exception as e:
                if attempt < max_retries - 1:
                    log.warning(f"Error parsing filing (attempt {attempt + 1}): {e}, retrying...")
                else:
                    log.error(f"Error parsing filing: {e}")

        return holdings, filing_date

    @staticmethod
    def _parse_filing_summary(filing_url: str, headers: Dict) -> tuple:
        """커버페이지 XML만 파싱해 요약 통계 반환 (infotable 다운로드 없음)."""
        summary = {'total_value': 0, 'num_holdings': 0}
        filing_date = None

        for attempt in range(3):
            try:
                if attempt > 0:
                    time.sleep(2 ** attempt)
                response = requests.get(filing_url, headers=headers, timeout=30)
                if response.status_code == 503 and attempt < 2:
                    continue
                response.raise_for_status()

                soup = BeautifulSoup(response.text, 'html.parser')

                filing_date_elem = soup.find('div', string=lambda t: t and 'Filing Date' in t)
                if filing_date_elem:
                    filing_date = filing_date_elem.text.split(':')[-1].strip()

                # 커버페이지 XML (primary-doc.xml) 찾기
                cover_url = None
                for row in soup.find_all('tr'):
                    cols = row.find_all('td')
                    if len(cols) >= 4:
                        doc_name = cols[2].text.strip()
                        doc_type = cols[3].text.strip().lower()
                        if ('13f-hr' in doc_type or 'primary' in doc_name.lower()) and doc_name.endswith('.xml'):
                            link = cols[2].find('a')
                            if link:
                                cover_url = 'https://www.sec.gov' + link['href']
                                break

                if cover_url:
                    try:
                        cr = requests.get(cover_url, headers=headers, timeout=30)
                        cr.raise_for_status()
                        csoup = BeautifulSoup(cr.content, 'xml')
                        tv = csoup.find('tableValueTotal')
                        te = csoup.find('tableEntryTotal')
                        if tv:
                            summary['total_value'] = int(float(tv.text)) * 1000
                        if te:
                            summary['num_holdings'] = int(te.text)
                    except Exception as e:
                        log.warning(f"Cover page parse failed: {e}")
                break
            except Exception as e:
                if attempt < 2:
                    log.warning(f"Summary parse attempt {attempt+1}: {e}")
                else:
                    log.error(f"Summary parse failed: {e}")

        return summary, filing_date

    @staticmethod
    def _find_info_table_url(soup: BeautifulSoup, base_url: str) -> Optional[str]:
        """Find information table XML URL in filing (raw XML, not rendered)"""
        table_rows = soup.find_all('tr')

        # Look for the actual .xml file (not rendered HTML version)
        for row in table_rows:
            cols = row.find_all('td')
            if len(cols) >= 4:
                doc_name = cols[2].text.strip()
                doc_type = cols[3].text.strip().lower()

                # Must be "information table" and actual .xml file
                if 'information table' in doc_type and doc_name.endswith('.xml'):
                    doc_link = cols[2].find('a')
                    if doc_link:
                        url = "https://www.sec.gov" + doc_link['href']
                        log.info(f"Found information table XML: {url}")
                        return url

        # Fallback: look for any .xml file with "info" or "table" in the href
        for row in table_rows:
            cols = row.find_all('td')
            if len(cols) >= 3:
                doc_link = cols[2].find('a')
                if doc_link:
                    href = doc_link['href']
                    if href.endswith('.xml') and ('info' in href.lower() or 'table' in href.lower()):
                        url = "https://www.sec.gov" + href
                        log.info(f"Found XML file (fallback): {url}")
                        return url

        return None

    @staticmethod
    def _parse_xml_holdings(xml_url: str, headers: Dict) -> List[Dict]:
        """Parse XML to extract holdings using BeautifulSoup for robust parsing"""
        holdings = []

        try:
            response = requests.get(xml_url, headers=headers, timeout=30)
            response.raise_for_status()

            # Use BeautifulSoup with xml parser (more forgiving than ET)
            soup = BeautifulSoup(response.content, 'xml')

            # Find all infoTable entries
            info_tables = soup.find_all('infoTable')

            for info_table in info_tables:
                try:
                    name_elem = info_table.find('nameOfIssuer')
                    cusip_elem = info_table.find('cusip')
                    value_elem = info_table.find('value')
                    shares_elem = info_table.find('sshPrnamt')
                    share_type_elem = info_table.find('sshPrnamtType')

                    if name_elem and value_elem and value_elem.text:
                        cusip = cusip_elem.text.strip() if cusip_elem and cusip_elem.text else ''
                        ticker = cusip_to_ticker(cusip) if cusip else ''

                        try:
                            value = int(float(value_elem.text)) * 1000  # Convert from thousands
                        except (ValueError, TypeError):
                            continue

                        try:
                            shares = int(float(shares_elem.text)) if shares_elem and shares_elem.text else 0
                        except (ValueError, TypeError):
                            shares = 0

                        holding = {
                            'symbol': ticker,
                            'name': name_elem.text.strip() if name_elem.text else '',
                            'cusip': cusip,
                            'value': value,
                            'shares': shares,
                            'share_type': share_type_elem.text.strip() if share_type_elem and share_type_elem.text else 'SH'
                        }

                        holdings.append(holding)

                except Exception as e:
                    log.debug(f"Error parsing individual holding: {e}")
                    continue

            log.info(f"Parsed {len(holdings)} holdings from XML")

        except Exception as e:
            log.error(f"Error parsing XML: {e}")
            import traceback
            traceback.print_exc()

        return holdings

    @staticmethod
    def transform_data(
        query: InstitutionalHoldingsQueryParams,
        data: Dict[str, Any],
        **kwargs: Any
    ) -> List[InstitutionalHoldingsData]:
        """
        Transform raw SEC data to standardized model

        Args:
            query: Query parameters
            data: Raw data from extract_data
            **kwargs: Additional parameters

        Returns:
            List with single InstitutionalHoldingsData object
        """
        inst_info = data['institution']
        holdings = data['holdings']
        filing_date = data.get('filing_date', '2025-12-31')

        if not holdings:
            log.warning(f"No holdings found for {inst_info['name']}")
            return []

        # Calculate total value
        total_value = sum(h['value'] for h in holdings if h.get('share_type') == 'SH')

        # Sort by value and get top holdings
        holdings_sorted = sorted(holdings, key=lambda x: x['value'], reverse=True)

        # Convert to HoldingData models
        stock_holdings = []
        for holding in holdings_sorted[:query.limit]:
            if holding.get('share_type') == 'SH':  # Only common shares
                weight = (holding['value'] / total_value * 100) if total_value > 0 else 0

                stock_holdings.append(HoldingData(
                    symbol=holding['symbol'] or holding['cusip'][:6],
                    name=holding['name'],
                    cusip=holding['cusip'],
                    value=holding['value'],
                    shares=holding['shares'],
                    weight=round(weight, 2),
                    share_type=holding['share_type']
                ))

        # Create portfolio data
        portfolio = InstitutionalHoldingsData(
            id=f"13f_{query.institution_key}",
            institution_key=query.institution_key,
            name=inst_info['name'],
            manager=inst_info['manager'],
            description=f"13F Holdings - {inst_info['name']}",
            category='13f',
            source='SEC EDGAR',
            filing_date=filing_date or '2025-12-31',
            period_end=filing_date or '2025-12-31',
            total_value=total_value,
            num_holdings=len([h for h in holdings if h.get('share_type') == 'SH']),
            stocks=stock_holdings
        )

        log.info(f"Transformed {len(stock_holdings)} holdings for {inst_info['name']}")

        return [portfolio]

    @staticmethod
    def get_institutions_list(use_dynamic: bool = True, limit: int = 100) -> List[InstitutionInfo]:
        """
        Get list of institutions that file 13F reports

        Args:
            use_dynamic: If True, fetch from SEC dynamically. If False, use hardcoded featured list.
            limit: Maximum number of institutions to return (only for dynamic)

        Returns:
            List of InstitutionInfo objects
        """
        if not use_dynamic:
            # Return hardcoded featured institutions
            return [
                InstitutionInfo(
                    key=key,
                    name=data['name'],
                    cik=data['cik'],
                    manager=data['manager'],
                    description=f"{data['manager']}'s investment firm"
                )
                for key, data in INSTITUTIONS.items()
            ]

        try:
            # Fetch dynamically from SEC
            log.info(f"Fetching institutions list dynamically (limit={limit})")
            institutions_list = SECInstitutionsListFetcher.fetch_data_sync(
                params={'limit': limit},
                credentials=None
            )

            # Create a mapping of CIK to hardcoded key for known institutions
            cik_to_key = {data['cik']: key for key, data in INSTITUTIONS.items()}

            # Update keys for known institutions
            for inst in institutions_list:
                if inst.cik in cik_to_key:
                    inst.key = cik_to_key[inst.cik]

            log.info(f"Fetched {len(institutions_list)} institutions dynamically")
            return institutions_list

        except Exception as e:
            log.error(f"Error fetching dynamic institutions list: {e}")
            # Fallback to hardcoded list
            log.info("Falling back to hardcoded institutions list")
            return [
                InstitutionInfo(
                    key=key,
                    name=data['name'],
                    cik=data['cik'],
                    manager=data['manager'],
                    description=f"{data['manager']}'s investment firm"
                )
                for key, data in INSTITUTIONS.items()
            ]
