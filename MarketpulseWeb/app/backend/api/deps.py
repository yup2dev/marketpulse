"""
API Route Utilities — 라우트가 같이 쓰는 결과 감싸기 · 날짜 처리.

예외 → HTTP 응답 변환은 여기 없다. 라우트는 예외를 그냥 던지고 core/exception_handlers.py 가
전역에서 바꾼다 (ValueError → 400, 키 없음 → 424, Fetcher 꺼짐 · 서킷 OPEN → 503 …).
"""
from typing import Any

from data_fetcher.core.obbject import OBBject


def wrap_result(raw: Any, provider: str) -> OBBject:
    """fetcher 결과 → OBBject. AnnotatedResult 처리는 OBBject.from_result 가 맡는다."""
    return OBBject.from_result(raw, provider)


# ── 날짜가 있는 행 목록 공통 처리 (게이트웨이·전용 라우트 공용) ──────────────────

# 행 dict에서 날짜 필드로 인정하는 키 (우선순위 순)
from app.backend.services.model_schema import DATE_KEYS  # noqa: E402 — 날짜 필드 이름은 한 곳에


def row_date_key(rows: list) -> str | None:
    """행 목록의 날짜 필드 키. 첫 행 기준 우선순위 매칭, 없으면 *_date 아무거나."""
    if not rows or not isinstance(rows[0], dict):
        return None
    first = rows[0]
    for k in DATE_KEYS:
        if k in first:
            return k
    return next((k for k in first if k.endswith("_date")), None)


def filter_dated_rows(rows: list, start_date: Any, end_date: Any, key: str | None = None) -> list:
    """날짜 필드가 있는 행 목록의 공통 후처리.

    - start_date/end_date 가 주어지면 범위 밖 행 제거 (fetcher가 자체 지원하지 않는
      모델도 위젯의 기간 선택이 동작하도록 하는 범용 필터 - 이중 적용은 무해)
    - 날짜 desc 정렬 (최신이 위로)

    key 를 주면 그 필드로 거른다(예: 내부자 거래는 공시일보다 거래일). 행에 그 키가
    없으면 자동 감지로 돌아간다. 직렬화된 행(dict, 날짜는 ISO 문자열)을 전제로
    문자열 prefix(YYYY-MM-DD) 비교를 쓴다.
    """
    if key is None or not rows or not isinstance(rows[0], dict) or key not in rows[0]:
        key = row_date_key(rows)
    if key is None:
        return rows

    def day(row: dict) -> str | None:
        v = row.get(key)
        return str(v)[:10] if v not in (None, "") else None

    if start_date or end_date:
        lo = str(start_date)[:10] if start_date else None
        hi = str(end_date)[:10] if end_date else None
        rows = [
            r for r in rows
            if (d := day(r)) is not None and (lo is None or d >= lo) and (hi is None or d <= hi)
        ]
    return sorted(rows, key=lambda r: day(r) or "", reverse=True)


def period_start(period: str | None) -> str | None:
    """기간 토큰(1mo·1y·5y·max …) → 시작일 ISO 문자열. 'max'·빈 값은 None(제한 없음).

    data_fetcher 의 parse_period_to_dates 는 끝을 '오늘-3일'로 잡는다(경제지표 지연용).
    이벤트 목록(배당·공시 등)은 최근 며칠이 빠지면 안 되므로 시작일만 계산한다.
    """
    if not period:
        return None
    p = period.strip().lower()
    if p in ("max", "all"):
        return None
    from datetime import date, timedelta
    import re
    m = re.fullmatch(r"(\d+)(d|w|wk|mo|m|y)", p)
    if not m:
        raise ValueError(f"Unsupported period: {period}")
    n, unit = int(m.group(1)), m.group(2)
    days = {"d": 1, "w": 7, "wk": 7, "mo": 30, "m": 30, "y": 365}[unit] * n
    return (date.today() - timedelta(days=days)).isoformat()


def resolve_date_range(period: str | None, start_date: str | None, end_date: str | None):
    return (start_date or period_start(period)), end_date
