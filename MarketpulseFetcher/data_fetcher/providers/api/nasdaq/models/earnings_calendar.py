"""Nasdaq Earnings Calendar Fetcher — 일자별 실적 발표 일정 (무료·공개)

api.nasdaq.com/api/calendar/earnings?date=YYYY-MM-DD 를 호출해
해당 일자에 실적을 발표하는 종목(시총·예상 EPS·전년 EPS·발표 시간대)을 입수한다.

- 키 불필요(credentials=[]). 단 User-Agent 헤더 없으면 차단되므로 필수.
- 소스가 발표 후 실제 EPS/서프라이즈는 제공하지 않는다 — 예상/전년 비교 중심.
"""
import logging
import re
from datetime import date as _date
from typing import Any, Dict, List, Optional

import requests
from pydantic import Field

from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams

log = logging.getLogger(__name__)

_URL = "https://api.nasdaq.com/api/calendar/earnings"
_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Accept": "application/json",
}

# 소스 time 코드 → 표시용
_TIME_LABELS = {
    "time-pre-market": "pre-market",
    "time-after-hours": "after-hours",
    "time-not-supplied": None,
}


def _money(text: Optional[str]) -> Optional[float]:
    """'$9,491,835,475' / '$0.24' / '($0.73)' → float. 괄호는 음수."""
    s = (text or "").strip()
    if not s or s.upper() == "N/A":
        return None
    negative = s.startswith("(") and s.endswith(")")
    s = re.sub(r"[^\d.\-]", "", s)
    if not s or s in ("-", "."):
        return None
    try:
        value = float(s)
    except ValueError:
        return None
    return -value if negative else value


# ── QueryParams / Data ────────────────────────────────────────────────────────

class NasdaqEarningsCalendarQueryParams(BaseQueryParams):
    date: Optional[str] = Field(
        default=None, description="조회 일자 YYYY-MM-DD (기본: 오늘)"
    )


class NasdaqEarningsCalendarData(BaseData):
    date: str = Field(description="발표 일자 YYYY-MM-DD")
    symbol: str = Field(description="티커")
    name: Optional[str] = Field(default=None, description="회사명")
    market_cap: Optional[float] = Field(default=None, description="시가총액 (USD)")
    eps_forecast: Optional[float] = Field(default=None, description="컨센서스 예상 EPS")
    num_estimates: Optional[int] = Field(default=None, description="추정치 수")
    last_year_eps: Optional[float] = Field(default=None, description="전년 동기 EPS")
    last_year_report_date: Optional[str] = Field(default=None, description="전년 발표일")
    time: Optional[str] = Field(default=None, description="발표 시간대 pre-market|after-hours (미공지 시 None)")
    fiscal_quarter_ending: Optional[str] = Field(default=None, description="회계분기 말 (예: May/2026)")


# ── Fetcher ───────────────────────────────────────────────────────────────────

class NasdaqEarningsCalendarFetcher(
    ApiFetcher[NasdaqEarningsCalendarQueryParams, NasdaqEarningsCalendarData]
):
    """일자별 실적 발표 캘린더 Fetcher (무료)"""

    require_credentials = False

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> NasdaqEarningsCalendarQueryParams:
        return NasdaqEarningsCalendarQueryParams(**params)

    @classmethod
    def extract_data(
        cls,
        query: NasdaqEarningsCalendarQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        day = query.date or _date.today().isoformat()
        resp = requests.get(_URL, params={"date": day}, headers=_HEADERS, timeout=30)
        resp.raise_for_status()
        rows = ((resp.json().get("data") or {}).get("rows")) or []
        log.info("[NasdaqCalendar] earnings %s: %d rows", day, len(rows))
        for r in rows:
            r["_query_date"] = day
        return rows

    @staticmethod
    def transform_data(
        query: NasdaqEarningsCalendarQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any,
    ) -> List[NasdaqEarningsCalendarData]:
        results: List[NasdaqEarningsCalendarData] = []
        for r in data:
            symbol = (r.get("symbol") or "").strip()
            if not symbol:
                continue
            num_ests = (r.get("noOfEsts") or "").strip()
            results.append(
                NasdaqEarningsCalendarData(
                    date=r.get("_query_date", ""),
                    symbol=symbol,
                    name=(r.get("name") or "").strip() or None,
                    market_cap=_money(r.get("marketCap")),
                    eps_forecast=_money(r.get("epsForecast")),
                    num_estimates=int(num_ests) if num_ests.isdigit() else None,
                    last_year_eps=_money(r.get("lastYearEPS")),
                    last_year_report_date=(r.get("lastYearRptDt") or "").strip().replace("N/A", "") or None,
                    time=_TIME_LABELS.get((r.get("time") or "").strip()),
                    fiscal_quarter_ending=(r.get("fiscalQuarterEnding") or "").strip() or None,
                )
            )
        # 시가총액 내림차순 기본 정렬 (스크린샷 UX: 시가총액순)
        results.sort(key=lambda d: d.market_cap or 0, reverse=True)
        return results
