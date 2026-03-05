"""
CUSIP to Ticker Mapping Utility
Maps CUSIP numbers to stock ticker symbols
"""

# Common CUSIP to Ticker mappings
CUSIP_TO_TICKER = {
    # Tech Giants
    '037833100': 'AAPL',  # Apple Inc
    '594918104': 'MSFT',  # Microsoft Corporation
    '02079K305': 'GOOGL', # Alphabet Inc Class A
    '02079K107': 'GOOG',  # Alphabet Inc Class C
    '023135106': 'AMZN',  # Amazon.com Inc
    '88160R101': 'TSLA',  # Tesla Inc
    '30303M102': 'META',  # Meta Platforms Inc
    '67066G104': 'NVDA',  # NVIDIA Corporation
    '79466L302': 'SALESFORCE', # Salesforce Inc (old CUSIP)

    # Finance
    '46625H100': 'JPM',   # JPMorgan Chase & Co
    '060505104': 'BAC',   # Bank of America Corp
    '38141G104': 'GS',    # Goldman Sachs Group Inc
    '02005N100': 'MS',    # Morgan Stanley
    '172967424': 'C',     # Citigroup Inc
    '74460D109': 'WFC',   # Wells Fargo & Company
    '06652K103': 'BRK.B', # Berkshire Hathaway Inc Class B
    '06652K307': 'BRK.A', # Berkshire Hathaway Inc Class A

    # Payment/Fintech
    '92826C839': 'V',     # Visa Inc Class A
    '57636Q104': 'MA',    # Mastercard Inc Class A
    '638585104': 'NFLX',  # Netflix Inc
    '79466L302': 'CRM',   # Salesforce Inc
    '81762P102': 'SQ',    # Block Inc (Square)
    '30212P303': 'PYPL',  # PayPal Holdings Inc

    # Healthcare
    '478160104': 'JNJ',   # Johnson & Johnson
    '91324P102': 'UNH',   # UnitedHealth Group Inc
    '58933Y105': 'PFE',   # Pfizer Inc
    '002824100': 'ABT',   # Abbott Laboratories
    '00287Y109': 'ABBV',  # AbbVie Inc
    '58933Y105': 'MRK',   # Merck & Co Inc

    # Consumer
    '747525103': 'QQQ',   # Invesco QQQ Trust
    '78462F103': 'SPY',   # SPDR S&P 500 ETF Trust
    '191216100': 'KO',    # Coca-Cola Company
    '713448108': 'PEP',   # PepsiCo Inc
    '742718109': 'PG',    # Procter & Gamble Company
    '931142103': 'WMT',   # Walmart Inc
    '191098102': 'COST',  # Costco Wholesale Corporation
    '438516106': 'HD',    # Home Depot Inc
    '254687106': 'DIS',   # Walt Disney Company
    '580135101': 'MCD',   # McDonald's Corporation
    '654106103': 'NKE',   # Nike Inc Class B
    '878742103': 'SBUX',  # Starbucks Corporation

    # Energy
    '30231G102': 'XOM',   # Exxon Mobil Corporation
    '166764100': 'CVX',   # Chevron Corporation

    # Telecom
    '92343V104': 'VZ',    # Verizon Communications Inc
    '00206R102': 'T',     # AT&T Inc

    # Industrial
    '459200101': 'IBM',   # IBM Corporation
    '58933Y105': 'MMM',   # 3M Company
    '149123101': 'CAT',   # Caterpillar Inc

    # Retail
    '87612E106': 'TGT',   # Target Corporation
    '539439109': 'LOW',   # Lowe's Companies Inc

    # Semiconductor
    '459200101': 'INTC',  # Intel Corporation
    '02079K305': 'AMD',   # Advanced Micro Devices Inc
    '883556102': 'TXN',   # Texas Instruments Inc

    # Software/Cloud
    '00507V109': 'CRM',   # Salesforce Inc
    '01609W102': 'BABA',  # Alibaba Group Holding Ltd
    '00724F101': 'ADBE',  # Adobe Inc

    # Streaming/Media
    '64110L106': 'NFLX',  # Netflix Inc
    '74144T108': 'ROKU',  # Roku Inc
    '83001A102': 'SNOW',  # Snowflake Inc

    # Crypto/Blockchain
    '17275R102': 'COIN',  # Coinbase Global Inc

    # EV/Clean Energy
    '88160R101': 'TSLA',  # Tesla Inc
    '55087P104': 'LCID',  # Lucid Group Inc
    '68382L102': 'RIVN',  # Rivian Automotive Inc

    # E-commerce
    '911684102': 'SHOP',  # Shopify Inc
    '31428X106': 'ETSY',  # Etsy Inc

    # Travel/Hospitality
    '90261A104': 'UBER',  # Uber Technologies Inc
    '55087P104': 'LYFT',  # Lyft Inc Class A
    '02553E106': 'ABNB',  # Airbnb Inc Class A

    # Gaming
    '780283103': 'RBLX',  # Roblox Corporation Class A
    '826919100': 'EA',    # Electronic Arts Inc
    '718172109': 'TTWO',  # Take-Two Interactive Software Inc

    # Social Media
    '83088M102': 'SNAP',  # Snap Inc Class A
    '723787107': 'PINS',  # Pinterest Inc Class A

    # Communication/Collaboration
    '98980L101': 'ZM',    # Zoom Video Communications Inc
    '98980G102': 'TWLO',  # Twilio Inc Class A
    '26681W109': 'DOCU',  # DocuSign Inc
    '81141R100': 'TEAM',  # Atlassian Corporation Class A

    # Music/Audio
    '78487Q105': 'SPOT',  # Spotify Technology SA

    # Cybersecurity
    '22788C105': 'CRWD',  # CrowdStrike Holdings Inc Class A
    '68389X105': 'OKTA',  # Okta Inc Class A
    '90364P105': 'ZS',    # Zscaler Inc

    # Cloud Infrastructure
    '20030N101': 'NET',   # Cloudflare Inc Class A
    '81181C104': 'DDOG',  # Datadog Inc Class A

    # Investing/Trading
    '90138F102': 'PLTR',  # Palantir Technologies Inc Class A
    '46579P101': 'DKNG',  # DraftKings Inc Class A
    '17275R102': 'HOOD',  # Robinhood Markets Inc Class A

    # Semiconductors (Advanced)
    '88579Y101': 'TSM',   # Taiwan Semiconductor Manufacturing
    '87612E106': 'ASML',  # ASML Holding NV

    # China Tech
    '01609W102': 'BABA',  # Alibaba Group
    '98980L101': 'JD',    # JD.com Inc
    '70450Y103': 'PDD',   # Pinduoduo Inc

    # Healthcare Tech
    '29444U700': 'TDOC',  # Teladoc Health Inc
}


def cusip_to_ticker(cusip: str) -> str:
    """
    Convert CUSIP to ticker symbol

    Args:
        cusip: 9-character CUSIP identifier

    Returns:
        Stock ticker symbol or CUSIP if not found
    """
    if not cusip:
        return ''

    # Clean CUSIP (remove spaces, convert to uppercase)
    clean_cusip = cusip.strip().upper()

    # Look up in mapping
    ticker = CUSIP_TO_TICKER.get(clean_cusip)

    if ticker:
        return ticker

    # If not found, return the first 6 characters as a placeholder
    return clean_cusip[:6] if len(clean_cusip) >= 6 else clean_cusip


def ticker_to_cusip(ticker: str) -> str:
    """
    Convert ticker symbol to CUSIP (reverse lookup)

    Args:
        ticker: Stock ticker symbol

    Returns:
        CUSIP identifier or empty string if not found
    """
    if not ticker:
        return ''

    clean_ticker = ticker.strip().upper()

    # Reverse lookup
    for cusip, tick in CUSIP_TO_TICKER.items():
        if tick == clean_ticker:
            return cusip

    return ''


def add_cusip_mapping(cusip: str, ticker: str):
    """
    Add a new CUSIP to ticker mapping

    Args:
        cusip: 9-character CUSIP identifier
        ticker: Stock ticker symbol
    """
    CUSIP_TO_TICKER[cusip.strip().upper()] = ticker.strip().upper()
