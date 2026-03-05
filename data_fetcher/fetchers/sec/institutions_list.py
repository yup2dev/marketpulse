"""
SEC Institutions List Fetcher
Dynamically fetches list of institutions that file 13F reports
"""
import logging
import requests
from typing import Any, Dict, List, Optional
from bs4 import BeautifulSoup
from datetime import datetime, timedelta

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.models.sec.institutional_holdings import InstitutionInfo

log = logging.getLogger(__name__)


class SECInstitutionsListQueryParams:
    """Query parameters for institutions list"""
    def __init__(self, min_aum: Optional[float] = None, limit: int = 100):
        self.min_aum = min_aum  # Minimum AUM in billions (optional filter)
        self.limit = limit


class SECInstitutionsListFetcher(Fetcher[SECInstitutionsListQueryParams, InstitutionInfo]):
    """Fetcher for getting list of institutions that file 13F reports"""

    require_credentials = False

    # Cache for institutions list (refreshed periodically)
    _cache = None
    _cache_time = None
    _cache_duration = timedelta(hours=24)  # Cache for 24 hours

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> SECInstitutionsListQueryParams:
        """Transform query parameters"""
        return SECInstitutionsListQueryParams(**params)

    @staticmethod
    def extract_data(
        query: SECInstitutionsListQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        """
        Extract list of institutions from SEC EDGAR

        Args:
            query: Query parameters
            credentials: Not required for SEC data
            **kwargs: Additional parameters

        Returns:
            Raw data with institutions list
        """
        # Check cache first
        if (SECInstitutionsListFetcher._cache is not None and
            SECInstitutionsListFetcher._cache_time is not None and
            datetime.now() - SECInstitutionsListFetcher._cache_time < SECInstitutionsListFetcher._cache_duration):
            log.info("Using cached institutions list")
            return SECInstitutionsListFetcher._cache

        log.info("Fetching institutions list from SEC EDGAR")

        headers = {
            'User-Agent': 'MarketPulse research@marketpulse.com',
            'Accept-Encoding': 'gzip, deflate',
            'Host': 'www.sec.gov'
        }

        institutions = []

        try:
            # Search for recent 13F-HR filings to find active institutions
            url = "https://www.sec.gov/cgi-bin/browse-edgar"
            params = {
                'action': 'getcompany',
                'type': '13F-HR',
                'dateb': '',
                'owner': 'exclude',
                'count': query.limit,
                'search_text': ''
            }

            response = requests.get(url, params=params, headers=headers, timeout=30)
            response.raise_for_status()

            soup = BeautifulSoup(response.text, 'html.parser')

            # Find the table with filings
            filing_table = soup.find('table', {'class': 'tableFile2'})

            if not filing_table:
                log.warning("Could not find filings table")
                return {'institutions': []}

            seen_ciks = set()
            rows = filing_table.find_all('tr')

            for row in rows[1:]:  # Skip header row
                cols = row.find_all('td')
                if len(cols) >= 4:
                    # Extract CIK and company name
                    company_cell = cols[1]
                    company_link = company_cell.find('a')

                    if company_link:
                        # Extract CIK from href
                        href = company_link.get('href', '')
                        if 'CIK=' in href:
                            cik = href.split('CIK=')[1].split('&')[0]
                            # Pad CIK to 10 digits
                            cik = cik.zfill(10)

                            if cik not in seen_ciks:
                                seen_ciks.add(cik)

                                company_name = company_link.text.strip()

                                # Extract manager name (usually the company name)
                                # Try to clean up common suffixes
                                manager = company_name
                                for suffix in [' INC', ' LLC', ' LP', ' LTD', ' CORP', ' CO']:
                                    if manager.upper().endswith(suffix):
                                        manager = manager[:-len(suffix)].strip()
                                        break

                                institutions.append({
                                    'cik': cik,
                                    'name': company_name,
                                    'manager': manager,
                                    'filing_date': cols[3].text.strip() if len(cols) > 3 else None
                                })

            log.info(f"Found {len(institutions)} institutions")

            # Cache the results
            cache_data = {'institutions': institutions}
            SECInstitutionsListFetcher._cache = cache_data
            SECInstitutionsListFetcher._cache_time = datetime.now()

            return cache_data

        except Exception as e:
            log.error(f"Error fetching institutions list: {e}")
            # Return empty list on error
            return {'institutions': []}

    @staticmethod
    def transform_data(
        query: SECInstitutionsListQueryParams,
        data: Dict[str, Any],
        **kwargs: Any
    ) -> List[InstitutionInfo]:
        """
        Transform raw SEC data to InstitutionInfo models

        Args:
            query: Query parameters
            data: Raw data from extract_data
            **kwargs: Additional parameters

        Returns:
            List of InstitutionInfo objects
        """
        institutions_data = data.get('institutions', [])

        institutions = []
        for idx, inst in enumerate(institutions_data):
            # Generate a key from the name
            key = SECInstitutionsListFetcher._generate_key(inst['name'])

            institutions.append(InstitutionInfo(
                key=key,
                name=inst['name'],
                cik=inst['cik'],
                manager=inst['manager'],
                description=f"13F Filer - {inst['manager']}"
            ))

        log.info(f"Transformed {len(institutions)} institutions")
        return institutions

    @staticmethod
    def _generate_key(name: str) -> str:
        """Generate a URL-friendly key from institution name"""
        # Remove common suffixes and clean up
        key = name.lower()

        # Remove common business entity types
        for suffix in [' inc', ' llc', ' lp', ' ltd', ' corp', ' co',
                      ' limited', ' corporation', ' management',
                      ' advisors', ' capital', ' partners']:
            key = key.replace(suffix, '')

        # Remove special characters and replace spaces with hyphens
        key = ''.join(c if c.isalnum() or c.isspace() else '' for c in key)
        key = '-'.join(key.split())

        # Truncate to reasonable length
        if len(key) > 30:
            key = key[:30]

        return key.strip('-')

    @classmethod
    def clear_cache(cls):
        """Clear the cached institutions list"""
        cls._cache = None
        cls._cache_time = None
        log.info("Institutions cache cleared")
