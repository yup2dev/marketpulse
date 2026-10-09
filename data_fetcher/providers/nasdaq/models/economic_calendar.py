"""Nasdaq Economic Calendar Fetcher — 일자별 경제지표 발표 일정 (무료·공개)

api.nasdaq.com/api/calendar/economicevents?date=YYYY-MM-DD 를 호출해
글로벌 경제 이벤트(발표시간·국가·이벤트명·실제/컨센서스/이전 값)를 입수한다.

- 키 불필요(credentials=[]). 단 User-Agent 헤더 없으면 차단되므로 필수.
- 소스에 중요도(별점)가 없어 이벤트명 키워드로 impact(high|medium|low)를 파생한다.
"""
import html
import logging
from datetime import date as _date
from typing import Any, Dict, List, Optional

import requests
from pydantic import Field

from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams

log = logging.getLogger(__name__)

_URL = "https://api.nasdaq.com/api/calendar/economicevents"
_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Accept": "application/json",
}

# 이벤트명 키워드 → 시장영향력. 소스가 중요도를 주지 않아 분류 규칙으로 파생.
_HIGH_KEYWORDS = (
    "fomc", "fed ", "federal funds", "interest rate", "rate decision",
    "nonfarm", "non-farm", "payroll", "unemployment rate",
    "cpi", "consumer price", "core inflation", "pce",
    "gdp", "ism", "pmi", "retail sales",
)
_MEDIUM_KEYWORDS = (
    "ppi", "producer price", "jobless", "claims", "confidence", "sentiment",
    "housing", "home sales", "building permits", "durable goods",
    "industrial production", "trade balance", "crude oil", "inventories",
    "employment", "wage", "export", "import",
)


def _clean(text: Optional[str]) -> Optional[str]:
    """'&nbsp;' 등 HTML 엔티티/비분리 공백을 정리하고 빈 값은 None."""
    s = html.unescape(text or "").replace("\xa0", " ").strip()
    return s or None


def _impact(event_name: str) -> str:
    name = (event_name or "").lower()
    if any(k in name for k in _HIGH_KEYWORDS):
        return "high"
    if any(k in name for k in _MEDIUM_KEYWORDS):
        return "medium"
    return "low"


# ── QueryParams / Data ────────────────────────────────────────────────────────

class NasdaqEconomicCalendarQueryParams(BaseQueryParams):
    date: Optional[str] = Field(
        default=None, description="조회 일자 YYYY-MM-DD (기본: 오늘)"
    )
    country: Optional[str] = Field(
        default=None, description="국가 필터 (예: 'United States') — 부분 일치, 대소문자 무시"
    )


class NasdaqEconomicCalendarData(BaseData):
    date: str = Field(description="이벤트 일자 YYYY-MM-DD")
    time: Optional[str] = Field(default=None, description="발표 시간 (GMT, HH:MM)")
    country: Optional[str] = Field(default=None, description="국가")
    event: str = Field(description="이벤트명")
    actual: Optional[str] = Field(default=None, description="실제 값 (미발표 시 None)")
    consensus: Optional[str] = Field(default=None, description="예측(컨센서스) 값")
    previous: Optional[str] = Field(default=None, description="이전 값")
    impact: str = Field(description="시장영향력 high|medium|low (이벤트명 기반 분류)")


# ── Fetcher ───────────────────────────────────────────────────────────────────

class NasdaqEconomicCalendarFetcher(
    ApiFetcher[NasdaqEconomicCalendarQueryParams, NasdaqEconomicCalendarData]
):
    """일자별 경제 이벤트 캘린더 Fetcher (무료)"""

    require_credentials = False

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> NasdaqEconomicCalendarQueryParams:
        return NasdaqEconomicCalendarQueryParams(**params)

    @classmethod
    def extract_data(
        cls,
        query: NasdaqEconomicCalendarQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        day = query.date or _date.today().isoformat()
        resp = requests.get(_URL, params={"date": day}, headers=_HEADERS, timeout=30)
        resp.raise_for_status()
        rows = ((resp.json().get("data") or {}).get("rows")) or []
        log.info("[NasdaqCalendar] economic events %s: %d rows", day, len(rows))
        for r in rows:
            r["_query_date"] = day
        return rows

    @staticmethod
    def transform_data(
        query: NasdaqEconomicCalendarQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any,
    ) -> List[NasdaqEconomicCalendarData]:
        want_country = (query.country or "").strip().lower()
        results: List[NasdaqEconomicCalendarData] = []
        for r in data:
            event = _clean(r.get("eventName"))
            if not event:
                continue
            country = _clean(r.get("country"))
            if want_country and want_country not in (country or "").lower():
                continue
            results.append(
                NasdaqEconomicCalendarData(
                    date=r.get("_query_date", ""),
                    time=_clean(r.get("gmt")),
                    country=country,
                    event=event,
                    actual=_clean(r.get("actual")),
                    consensus=_clean(r.get("consensus")),
                    previous=_clean(r.get("previous")),
                    impact=_impact(event),
                )
            )
        return results
