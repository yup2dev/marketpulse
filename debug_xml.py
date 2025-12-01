"""Debug SEC EDGAR XML structure"""
import requests
from bs4 import BeautifulSoup

# Test with Berkshire Hathaway
cik = "0001067983"
headers = {
    'User-Agent': 'MarketPulse research@marketpulse.com',
    'Accept-Encoding': 'gzip, deflate',
    'Host': 'www.sec.gov'
}

print("Fetching latest 13F filing...")
url = "https://www.sec.gov/cgi-bin/browse-edgar"
params = {
    'action': 'getcompany',
    'CIK': cik,
    'type': '13F-HR',
    'dateb': '',
    'owner': 'exclude',
    'count': '1'
}

response = requests.get(url, params=params, headers=headers, timeout=30)
soup = BeautifulSoup(response.text, 'html.parser')

filing_rows = soup.find_all('tr')
filing_url = None
for row in filing_rows[1:]:
    cols = row.find_all('td')
    if len(cols) >= 4 and cols[0].text.strip() == '13F-HR':
        doc_link = cols[1].find('a')
        if doc_link:
            filing_url = "https://www.sec.gov" + doc_link['href']
            break

if not filing_url:
    print("No filing found!")
    exit(1)

print(f"Filing URL: {filing_url}")

# Get filing page
response = requests.get(filing_url, headers=headers, timeout=30)
soup = BeautifulSoup(response.text, 'html.parser')

# Find all XML files
table_rows = soup.find_all('tr')
xml_url = None
print("\nAll documents in filing:")
for row in table_rows:
    cols = row.find_all('td')
    if len(cols) >= 4:
        doc_name = cols[2].text.strip()
        doc_type = cols[3].text.strip()
        doc_link = cols[2].find('a')
        if doc_link:
            url = "https://www.sec.gov" + doc_link['href']
            print(f"  {doc_type}: {doc_name} -> {url}")

            # Look for XML files (not rendered HTML)
            if doc_name.endswith('.xml') and 'information table' in doc_type.lower():
                xml_url = url
                print(f"  ^^ This looks like the actual XML file!")

if not xml_url:
    print("\nNo raw XML file found! Trying alternative approach...")
    # Try to find infotable.xml or similar
    for row in table_rows:
        cols = row.find_all('td')
        if len(cols) >= 3:
            doc_link = cols[2].find('a')
            if doc_link:
                href = doc_link['href']
                if href.endswith('.xml') and ('info' in href.lower() or 'table' in href.lower()):
                    xml_url = "https://www.sec.gov" + href
                    print(f"Found potential XML: {xml_url}")
                    break

if not xml_url:
    print("Still no XML found. Cannot proceed.")
    exit(1)

# Fetch XML
print(f"\nFetching XML from: {xml_url}")
response = requests.get(xml_url, headers=headers, timeout=30)

# Try to parse
soup_xml = BeautifulSoup(response.content, 'xml')

print(f"\nXML Preview (first 2000 chars):")
print("=" * 80)
print(response.text[:2000])
print("=" * 80)

# Check for infoTable tags
info_tables = soup_xml.find_all('infoTable')
print(f"\nFound {len(info_tables)} infoTable tags")

if len(info_tables) == 0:
    # Try different tag names
    print("\nSearching for alternative tag names...")
    for tag in ['informationTable', 'ns1:infoTable', 'holdings', 'holding', 'position']:
        found = soup_xml.find_all(tag)
        if found:
            print(f"  Found {len(found)} '{tag}' tags")

# Show first infoTable if exists
if info_tables:
    print(f"\nFirst infoTable structure:")
    print(info_tables[0].prettify()[:1000])
