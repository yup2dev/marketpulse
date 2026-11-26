"""모델별 캐시 TTL(초) — 서버 실행 계층(core/execution/executor.py)이 쓴다. 0 = 캐시 안 함.

fetcher 패키지는 캐시를 모른다 (OpenBB QueryExecutor 와 같다). 키는 모델 이름뿐이다 — 같은 모델 이름이면
provider 가 달라도 같은 TTL.
"""
from typing import Dict

# 모델별 기본 TTL(초).  0 = 캐시 안 함.
DEFAULT_TTL: Dict[str, int] = {
    # ── Real-time (30-60s) ───────────────────────────────────────────────────
    "stock_price":              60,
    "batch_quotes":             30,
    "orderbook":                30,
    # ── Semi-fresh (5-15min) ────────────────────────────────────────────────
    "news":                    300,
    "earnings":                600,
    "sentiment":               300,
    "calendar":                600,
    "options":                 300,
    "short_interest":          900,
    "technical_indicators":    300,
    "quote":                    60,   # alphavantage / fmp quote
    "most_actives":            120,
    "gainers":                 120,
    "losers":                  120,
    # ── Daily (30-60min) ────────────────────────────────────────────────────
    "financials":             1800,
    "balance_sheet":          1800,
    "estimates":              1800,
    "analyst_data":           1800,
    "analyst_estimates":      1800,
    "analyst_recommendations":1800,
    "holders":                1800,
    "insider_trading":        1800,
    "insider_trading_summary":1800,
    "insider_holders":        1800,
    "dividends":              3600,
    "splits":                 3600,
    "filings":                3600,
    "revenue_segments":       3600,
    "search":                 1800,
    "timeseries":             1800,
    "series":                 3600,
    "bond_prices":            3600,
    # ── FRED macro (1h) ─────────────────────────────────────────────────────
    "gdp":                          3600,
    "cpi":                          3600,
    "unemployment":                 3600,
    "interest_rate":                3600,
    "employment":                   3600,
    "industrial_production":        3600,
    "consumer_sentiment":           3600,
    "housing_starts":               3600,
    "retail_sales":                 3600,
    "nonfarm_payroll":              3600,
    # ── FRED composite / multi-series (1h) ─────────────────────────────────
    "fed_balance_sheet":            3600,
    "real_rates":                   3600,
    "pmi":                          3600,
    "yield_curve":                  1800,  # snapshot — intraday 변동
    "yield_curve_history":          3600,
    "initial_claims":               3600,
    "forex":                         900,
    # ── Yahoo quote (별칭 구분) ─────────────────────────────────────────────
    "quote":                          60,  # yahoo:quote (StockQuoteFetcher)
    # ── Mostly static (1h+) ─────────────────────────────────────────────────
    "company_info":           3600,
    "company_peers":          86400,  # 유사종목 — 거의 변하지 않음
    "key_metrics":            3600,
    "management":             3600,
    "company_profile":        3600,
    "income_statement":       3600,
    "index_constituents":     7200,
    "stock_list":             7200,
    "stock_ranking":           300,  # 일별 시계열로 계산 — 적재는 하루 한 번
    "listing":               21600,  # universe (nasdaqtrader/krx) — 일 갱신, 6h 캐시
    "bond":                  21600,  # KR 국고채 벤치마크 (krx) — 일 갱신
    "institutional_holdings": 3600,
    "institutions_summary":   3600,  # 배치 적재 요약 — 일 1회 sync 로만 바뀐다
    "institutions_list":      7200,
    "institutional_13f":      7200,
    "13f_institutions":       7200,
    "13f_filings":           21600,
    # 분기 공시 기반 + 다중 분기 파싱(요청당 N개 필링) — 길게 잡는다
    "fund_performance":      21600,
    # ── No cache — computed on-the-fly ──────────────────────────────────────
    "pricing":                   0,
}
