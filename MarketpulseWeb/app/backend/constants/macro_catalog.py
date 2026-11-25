"""거시 화면의 지표 목록 — 어느 FRED 모델 · 시리즈를 쓰는지 (데이터만).

라우트가 이 목록으로 Source 를 만들어 command(app/backend/commands/macro.py)에 넘긴다.
"""

# 주요 지표 — 키 → (fred 모델, 이름, 단위, 고정 파라미터)
INDICATORS = {
    "gdp": ("gdp", "Gross Domestic Product", "Billions of Chained 2012 Dollars", {}),
    "unemployment": ("unemployment", "Unemployment Rate", "Percent", {}),
    "cpi": ("cpi", "Consumer Price Index", "Index", {}),
    "fed_funds_rate": ("interest_rate", "Federal Funds Effective Rate", "Percent", {"rate_type": "federal_funds"}),
    "retail_sales": ("retail_sales", "Advance Retail Sales", "Millions of Dollars", {}),
    "consumer_sentiment": ("consumer_sentiment", "University of Michigan Consumer Sentiment", "Index", {}),
}

# 추가 시리즈 — 키 → (FRED series id, 이름, 분류, 단위)
MACRO_SERIES = {
    "bank_loans": ("TOTLL", "Total Loans and Leases at Commercial Banks", "Banking", "Billions of Dollars"),
    "consumer_credit": ("TOTALSL", "Consumer Credit Outstanding", "Credit", "Billions of Dollars"),
    "money_supply_m1": ("M1SL", "M1 Money Supply", "Money Supply", "Billions of Dollars"),
    "money_supply_m2": ("M2SL", "M2 Money Supply", "Money Supply", "Billions of Dollars"),
    "treasury_10y": ("DGS10", "10-Year Treasury Constant Maturity Rate", "Interest Rates", "Percent"),
    "treasury_2y": ("DGS2", "2-Year Treasury Constant Maturity Rate", "Interest Rates", "Percent"),
    "trade_balance": ("BOPGSTB", "Trade Balance: Goods and Services", "Trade", "Millions of Dollars"),
    "case_shiller": ("CSUSHPISA", "S&P/Case-Shiller U.S. National Home Price Index", "Real Estate",
                     "Index Jan 2000=100"),
    "crude_oil_wti": ("DCOILWTICO", "Crude Oil Prices: West Texas Intermediate (WTI)", "Commodities",
                      "USD per Barrel"),
    "natural_gas": ("DHHNGSP", "Henry Hub Natural Gas Spot Price", "Commodities", "USD per Million Btu"),
    "copper": ("PCOPPUSDM", "Global Price of Copper", "Commodities", "USD per Metric Ton"),
}

# 주요 환율 — (기준 통화, 상대 통화, 이름)
FX_PAIRS = [
    ("EUR", "USD", "Euro to US Dollar"),
    ("USD", "JPY", "US Dollar to Japanese Yen"),
    ("GBP", "USD", "British Pound to US Dollar"),
    ("USD", "CNY", "US Dollar to Chinese Yuan"),
    ("AUD", "USD", "Australian Dollar to US Dollar"),
]
