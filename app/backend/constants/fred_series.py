"""
FRED Series ID Constants
Centralized location for all FRED series IDs to prevent typos

Note: FRED series IDs from different sources may have inconsistent naming patterns.
For example, Atlanta Fed series:
- Sticky CPI: CORESTICKM159SFRBATL (no "CPI" in middle)
- Flexible CPI: COREFLEXCPIM159SFRBATL (has "CPI" in middle)
"""

# =============================================================================
# Atlanta Fed - Sticky/Flexible CPI
# =============================================================================
STICKY_CORE_CPI = 'CORESTICKM159SFRBATL'
"""Sticky Price Consumer Price Index less Food and Energy
Monthly, Seasonally Adjusted, Percent Change from Year Ago"""

FLEXIBLE_CORE_CPI = 'COREFLEXCPIM159SFRBATL'
"""Flexible Price Consumer Price Index less Food and Energy
Monthly, Seasonally Adjusted, Percent Change from Year Ago
Note: Has "CPI" in the middle unlike sticky series"""

# =============================================================================
# Inflation Expectations (Breakeven Rates)
# =============================================================================
BREAKEVEN_5Y = 'T5YIE'
"""5-Year Breakeven Inflation Rate
Daily, Not Seasonally Adjusted, Percent"""

BREAKEVEN_10Y = 'T10YIE'
"""10-Year Breakeven Inflation Rate
Daily, Not Seasonally Adjusted, Percent"""

# =============================================================================
# Core Inflation Measures
# =============================================================================
CORE_CPI = 'CPILFESL'
"""Consumer Price Index for All Urban Consumers: All Items Less Food and Energy
Monthly, Seasonally Adjusted, Index 1982-1984=100"""

# =============================================================================
# GDP and Economic Indicators
# =============================================================================
GDP = 'GDP'
"""Gross Domestic Product
Quarterly, Seasonally Adjusted Annual Rate, Billions of Dollars"""

UNEMPLOYMENT_RATE = 'UNRATE'
"""Unemployment Rate
Monthly, Seasonally Adjusted, Percent"""

# =============================================================================
# Federal Funds Rate
# =============================================================================
FED_FUNDS_RATE = 'FEDFUNDS'
"""Federal Funds Effective Rate
Monthly, Not Seasonally Adjusted, Percent"""

# =============================================================================
# Treasury Yields
# =============================================================================
TREASURY_10Y = 'DGS10'
"""10-Year Treasury Constant Maturity Rate
Daily, Not Seasonally Adjusted, Percent"""

TREASURY_2Y = 'DGS2'
"""2-Year Treasury Constant Maturity Rate
Daily, Not Seasonally Adjusted, Percent"""

# =============================================================================
# Employment Data
# =============================================================================
INITIAL_CLAIMS = 'ICSA'
"""Initial Claims
Weekly, Seasonally Adjusted, Number"""

CONTINUED_CLAIMS = 'CCSA'
"""Continued Claims (Insured Unemployment)
Weekly, Seasonally Adjusted, Number"""

PRIVATE_EMPLOYMENT = 'USPRIV'
"""All Employees, Total Private
Monthly, Seasonally Adjusted, Thousands of Persons"""

GOVERNMENT_EMPLOYMENT = 'USGOVT'
"""All Employees, Government
Monthly, Seasonally Adjusted, Thousands of Persons"""

NONFARM_PAYROLLS = 'PAYEMS'
"""All Employees, Total Nonfarm
Monthly, Seasonally Adjusted, Thousands of Persons"""

# =============================================================================
# GDP Forecasts / Nowcasts
# =============================================================================
GDP_NOWCAST_ATLANTA = 'GDPNOW'
"""Atlanta Fed GDPNow
Real GDP Forecast"""

REAL_GDP = 'GDPC1'
"""Real Gross Domestic Product
Quarterly, Seasonally Adjusted Annual Rate, Billions of Chained 2017 Dollars"""
