"""
SEC 13F Filing Fetcher
Fetches institutional investment manager holdings from SEC 13F filings
"""
from typing import List, Dict, Optional
import requests
from datetime import datetime, timedelta
import re
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from data_fetcher.utils.cusip_mapper import cusip_to_ticker


class SEC13FFetcher:
    """Fetcher for SEC 13F institutional holdings data"""

    def __init__(self):
        """Initialize the SEC 13F fetcher"""
        self.base_url = "https://www.sec.gov"
        self.headers = {
            'User-Agent': 'MarketPulse Dashboard research@marketpulse.com',
            'Accept-Encoding': 'gzip, deflate',
            'Host': 'www.sec.gov'
        }

        # Major institutional investors with their CIK numbers
        self.institutions = {
            "berkshire": {
                "cik": "0001067983",
                "name": "Berkshire Hathaway Inc.",
                "description": "Warren Buffett's investment company"
            },
            "ark": {
                "cik": "0001649339",
                "name": "ARK Investment Management LLC",
                "description": "Cathie Wood's innovation-focused funds"
            },
            "bridgewater": {
                "cik": "0001350694",
                "name": "Bridgewater Associates LP",
                "description": "Ray Dalio's hedge fund"
            },
            "vanguard": {
                "cik": "0000102909",
                "name": "Vanguard Group Inc.",
                "description": "World's largest mutual fund provider"
            },
            "blackrock": {
                "cik": "0001086364",
                "name": "BlackRock Inc.",
                "description": "World's largest asset manager"
            },
            "citadel": {
                "cik": "0001423053",
                "name": "Citadel Advisors LLC",
                "description": "Ken Griffin's hedge fund"
            },
            "renaissance": {
                "cik": "0001037389",
                "name": "Renaissance Technologies LLC",
                "description": "Jim Simons' quantitative hedge fund"
            },
            "soros": {
                "cik": "0001029160",
                "name": "Soros Fund Management LLC",
                "description": "George Soros' investment fund"
            },
            "tiger": {
                "cik": "0001167483",
                "name": "Tiger Global Management LLC",
                "description": "Technology-focused hedge fund"
            },
            "pershing": {
                "cik": "0001336528",
                "name": "Pershing Square Capital Management LP",
                "description": "Bill Ackman's activist hedge fund"
            }
        }

    def get_cik_from_ticker(self, ticker: str) -> Optional[str]:
        """Get CIK number from company ticker"""
        try:
            url = f"{self.base_url}/cgi-bin/browse-edgar"
            params = {
                'action': 'getcompany',
                'company': ticker,
                'type': '13F',
                'dateb': '',
                'owner': 'exclude',
                'count': '1'
            }
            response = requests.get(url, params=params, headers=self.headers)
            if response.status_code == 200:
                match = re.search(r'CIK=(\d+)', response.text)
                if match:
                    return match.group(1).zfill(10)
        except Exception as e:
            print(f"Error getting CIK for {ticker}: {e}")
        return None

    def get_latest_13f_filings(self, institution_key: str = None, limit: int = 10) -> List[Dict]:
        """
        Get latest 13F filings for an institution or all tracked institutions

        Args:
            institution_key: Key for specific institution (e.g., 'berkshire', 'ark')
            limit: Number of filings to retrieve
        """
        filings = []

        if institution_key:
            institutions_to_fetch = {institution_key: self.institutions.get(institution_key)}
            if not institutions_to_fetch[institution_key]:
                return []
        else:
            institutions_to_fetch = self.institutions

        for key, inst_data in institutions_to_fetch.items():
            try:
                cik = inst_data['cik']
                url = f"{self.base_url}/cgi-bin/browse-edgar"
                params = {
                    'action': 'getcompany',
                    'CIK': cik,
                    'type': '13F-HR',
                    'dateb': '',
                    'owner': 'exclude',
                    'count': str(limit)
                }

                response = requests.get(url, params=params, headers=self.headers, timeout=10)
                if response.status_code == 200:
                    soup = BeautifulSoup(response.text, 'html.parser')
                    filing_rows = soup.find_all('tr')

                    for row in filing_rows[1:]:  # Skip header row
                        cols = row.find_all('td')
                        if len(cols) >= 4:
                            filing_type = cols[0].text.strip()
                            if filing_type == '13F-HR':
                                filing_date = cols[3].text.strip()
                                documents_link = cols[1].find('a')
                                if documents_link:
                                    filing_url = self.base_url + documents_link['href']

                                    filings.append({
                                        'institution_key': key,
                                        'institution_name': inst_data['name'],
                                        'institution_description': inst_data['description'],
                                        'cik': cik,
                                        'filing_date': filing_date,
                                        'filing_url': filing_url,
                                        'type': filing_type
                                    })
            except Exception as e:
                print(f"Error fetching 13F filings for {key}: {e}")
                continue

        return sorted(filings, key=lambda x: x['filing_date'], reverse=True)[:limit]

    def parse_13f_holdings(self, filing_url: str) -> List[Dict]:
        """
        Parse holdings from a 13F filing

        Args:
            filing_url: URL to the filing documents page
        """
        holdings = []

        try:
            # Get the filing documents page
            response = requests.get(filing_url, headers=self.headers, timeout=10)
            if response.status_code != 200:
                return holdings

            soup = BeautifulSoup(response.text, 'html.parser')

            # Find the information table (primary doc or XML)
            table_rows = soup.find_all('tr')
            info_table_url = None

            for row in table_rows:
                cols = row.find_all('td')
                if len(cols) >= 4:
                    doc_type = cols[3].text.strip().lower()
                    # Look for information table or primary document
                    if 'information table' in doc_type or 'infotable' in doc_type or 'primary_doc' in doc_type:
                        doc_link = cols[2].find('a')
                        if doc_link:
                            info_table_url = self.base_url + doc_link['href']
                            break

            if not info_table_url:
                # Try to find any XML file
                for row in table_rows:
                    cols = row.find_all('td')
                    if len(cols) >= 3:
                        doc_link = cols[2].find('a')
                        if doc_link and doc_link['href'].endswith('.xml'):
                            info_table_url = self.base_url + doc_link['href']
                            break

            if info_table_url:
                # Fetch and parse the information table
                holdings = self._parse_info_table(info_table_url)

        except Exception as e:
            print(f"Error parsing 13F holdings: {e}")

        return holdings

    def _parse_info_table(self, url: str) -> List[Dict]:
        """Parse the information table XML"""
        holdings = []

        try:
            response = requests.get(url, headers=self.headers, timeout=10)
            if response.status_code != 200:
                return holdings

            # Try parsing as XML
            try:
                root = ET.fromstring(response.content)

                # Find all infoTable entries
                for info_table in root.findall('.//{*}infoTable'):
                    holding = {}

                    # Get name of issuer
                    name_elem = info_table.find('.//{*}nameOfIssuer')
                    if name_elem is not None:
                        holding['name'] = name_elem.text.strip()

                    # Get title of class (usually COM for common stock)
                    title_elem = info_table.find('.//{*}titleOfClass')
                    if title_elem is not None:
                        holding['title'] = title_elem.text.strip()

                    # Get CUSIP
                    cusip_elem = info_table.find('.//{*}cusip')
                    if cusip_elem is not None:
                        holding['cusip'] = cusip_elem.text.strip()

                    # Get value (in thousands)
                    value_elem = info_table.find('.//{*}value')
                    if value_elem is not None:
                        holding['value'] = int(value_elem.text) * 1000  # Convert to dollars

                    # Get shares
                    shares_elem = info_table.find('.//{*}sshPrnamt')
                    if shares_elem is not None:
                        holding['shares'] = int(shares_elem.text)

                    # Get share type (SH for shares, PRN for principal amount)
                    share_type_elem = info_table.find('.//{*}sshPrnamtType')
                    if share_type_elem is not None:
                        holding['share_type'] = share_type_elem.text.strip()

                    # Get investment discretion
                    discretion_elem = info_table.find('.//{*}investmentDiscretion')
                    if discretion_elem is not None:
                        holding['discretion'] = discretion_elem.text.strip()

                    # Get voting authority
                    sole_elem = info_table.find('.//{*}Sole')
                    if sole_elem is not None:
                        holding['voting_sole'] = int(sole_elem.text) if sole_elem.text else 0

                    if holding.get('name') and holding.get('value'):
                        holdings.append(holding)

            except ET.ParseError:
                # If XML parsing fails, try HTML parsing
                soup = BeautifulSoup(response.content, 'html.parser')
                # This would require custom parsing based on HTML structure
                pass

        except Exception as e:
            print(f"Error parsing info table: {e}")

        return holdings

    def get_portfolio_from_13f(self, institution_key: str) -> Optional[Dict]:
        """
        Get the latest portfolio holdings for an institution

        Args:
            institution_key: Key for specific institution (e.g., 'berkshire', 'ark')
        """
        if institution_key not in self.institutions:
            return None

        # Get latest filing
        filings = self.get_latest_13f_filings(institution_key, limit=1)
        if not filings:
            return None

        latest_filing = filings[0]

        # Parse holdings
        holdings = self.parse_13f_holdings(latest_filing['filing_url'])

        if not holdings:
            return None

        # Calculate total portfolio value
        total_value = sum(h.get('value', 0) for h in holdings)

        # Sort by value and calculate weights
        holdings_sorted = sorted(holdings, key=lambda x: x.get('value', 0), reverse=True)

        stocks = []
        for holding in holdings_sorted[:50]:  # Top 50 holdings
            if holding.get('share_type') == 'SH':  # Only common shares
                weight = (holding['value'] / total_value * 100) if total_value > 0 else 0
                stocks.append({
                    'symbol': self._cusip_to_ticker(holding.get('cusip', '')),
                    'name': holding.get('name', ''),
                    'cusip': holding.get('cusip', ''),
                    'weight': round(weight, 2),
                    'value': holding.get('value', 0),
                    'shares': holding.get('shares', 0)
                })

        inst_data = self.institutions[institution_key]

        return {
            'id': f'13f_{institution_key}',
            'name': inst_data['name'],
            'description': inst_data['description'],
            'category': '13f',
            'source': 'SEC 13F Filing',
            'filing_date': latest_filing['filing_date'],
            'total_value': total_value,
            'num_holdings': len(holdings),
            'top_holdings': len(stocks),
            'stocks': stocks
        }

    def _cusip_to_ticker(self, cusip: str) -> str:
        """Convert CUSIP to ticker symbol"""
        return cusip_to_ticker(cusip)

    def get_all_institution_portfolios(self) -> List[Dict]:
        """Get portfolios for all tracked institutions"""
        portfolios = []

        for inst_key in self.institutions.keys():
            portfolio = self.get_portfolio_from_13f(inst_key)
            if portfolio:
                portfolios.append(portfolio)

        return portfolios

    def get_institutions_list(self) -> List[Dict]:
        """Get list of all tracked institutions"""
        return [
            {
                'key': key,
                'name': data['name'],
                'description': data['description'],
                'cik': data['cik']
            }
            for key, data in self.institutions.items()
        ]
