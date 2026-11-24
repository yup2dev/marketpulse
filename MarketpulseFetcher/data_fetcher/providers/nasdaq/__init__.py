"""Nasdaq.com 공개 캘린더 API provider — 경제이벤트/실적 캘린더 (무료·키 불필요)"""
from data_fetcher.abstract_provider.abstract.provider import Provider
from data_fetcher.providers.nasdaq.models.earnings_calendar import NasdaqEarningsCalendarFetcher
from data_fetcher.providers.nasdaq.models.economic_calendar import NasdaqEconomicCalendarFetcher


nasdaq_provider = Provider(
    name="nasdaq",
    description="Nasdaq.com 공개 캘린더 API — 경제이벤트/실적 캘린더 (무료·키 불필요)",
    website="https://www.nasdaq.com/market-activity/earnings",
    credentials=[],
    fetcher_dict={
        "economic_calendar": NasdaqEconomicCalendarFetcher,
        "earnings_calendar": NasdaqEarningsCalendarFetcher,
    },
    metadata={
        "rate_limit": "명시 없음 (공개 API, User-Agent 필수)",
        "data_coverage": "글로벌 경제 이벤트 + US 실적 발표 일정, 일자별 조회",
    },
)
