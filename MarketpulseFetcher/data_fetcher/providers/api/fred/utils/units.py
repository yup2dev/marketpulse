"""FRED units 로 받은 변환값을 원 시리즈 행에 붙인다 — 계산은 FRED 가 한다.

FRED observations API 의 units 파라미터 (https://fred.stlouisfed.org/docs/api/fred/series_observations.html):
    chg  직전 관측 대비 변화량        ch1  1년 전 대비 변화량
    pch  직전 관측 대비 변화율 (%)    pc1  1년 전 대비 변화율 (%)

fetcher 는 같은 시리즈를 units 마다 한 번씩 (병렬로) 받고, 여기서 날짜로 붙이기만 한다.
"""
from typing import Any, Dict, List, Mapping, Sequence, Union

Units = Mapping[str, str]          # 붙일 칸 이름 → FRED units (예: {"change_year": "pc1"})


def with_units(base: Mapping[str, Any], units: Units) -> List[Dict[str, Any]]:
    """요청 파라미터 목록 — [원 시리즈, 칸마다 units 를 붙인 같은 요청 …] (units 순서대로)."""
    return [dict(base)] + [{**base, "units": u} for u in units.values()]


def _rows(result: Any) -> List[Dict[str, Any]]:
    return [r.model_dump() if hasattr(r, "model_dump") else dict(r) for r in (result or [])]


def attach_units(results: Sequence[Union[List[Any], BaseException]], units: Units) -> List[Dict[str, Any]]:
    """with_units 순서로 받은 결과 → 원 시리즈 행에 units 칸을 날짜로 붙인 목록.

    원 시리즈가 실패하면 그 오류를 올린다. units 요청이 실패하면 그 칸만 비운다 (None).
    """
    base, *extras = results
    if isinstance(base, BaseException):
        raise base
    rows = _rows(base)
    for field, extra in zip(units, extras):
        by_date = {} if isinstance(extra, BaseException) else {r.get("date"): r.get("value") for r in _rows(extra)}
        for r in rows:
            r[field] = by_date.get(r.get("date"))
    return rows
