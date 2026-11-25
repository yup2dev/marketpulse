"""
Equity Fundamental Routes  (/api/v1/equity/fundamental/...)

등록 목록만 적는다 — 파라미터 · provider 선택지는 표준 모델에서 만든다 (data_fetcher/core/router.py).
provider 를 안 적으면 그 모델을 주는 provider 중 등록 순서 첫 번째가 기본값이다.
"""
from data_fetcher.core import Command, CommandRouter

# 등록 (api/routers.py 자동 탐색)
PREFIX = "/api/v1"
TAGS = ["equity-fundamental"]
router = CommandRouter(prefix="/equity/fundamental")

COMMANDS = [
    #        경로                         모델                        기본 provider
    Command("/income-statement",         "income_statement",         provider="fmp"),
    Command("/analyst-estimates",        "analyst_estimates"),
    Command("/analyst-recommendations",  "analyst_recommendations"),
    Command("/quote",                    "quote",                    provider="fmp"),
    Command("/company-profile",          "company_profile"),
]
router.add_commands(COMMANDS)
