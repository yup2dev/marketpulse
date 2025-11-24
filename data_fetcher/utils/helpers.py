"""
Helper Utilities

Provides common helper functions for data transformation and processing.
"""
import logging
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Union

log = logging.getLogger(__name__)


def calculate_growth_rate(
    current: float,
    previous: float,
    as_percentage: bool = True
) -> Optional[float]:
    """
    성장률 계산

    Args:
        current: 현재 값
        previous: 이전 값
        as_percentage: 백분율로 반환 여부

    Returns:
        성장률 (percentage면 100 곱한 값)
    """
    if previous is None or previous == 0:
        return None

    if current is None:
        return None

    growth = (current - previous) / abs(previous)

    return growth * 100 if as_percentage else growth


def calculate_change(
    current: float,
    previous: float
) -> Optional[float]:
    """
    변화량 계산

    Args:
        current: 현재 값
        previous: 이전 값

    Returns:
        변화량 (current - previous)
    """
    if current is None or previous is None:
        return None

    return current - previous


def safe_float(
    value: Any,
    default: Optional[float] = None
) -> Optional[float]:
    """
    안전한 float 변환

    Args:
        value: 변환할 값
        default: 변환 실패 시 기본값

    Returns:
        변환된 float 또는 기본값
    """
    if value is None or value == '.' or value == '':
        return default

    try:
        return float(value)
    except (ValueError, TypeError):
        log.warning(f"Cannot convert to float: {value}, using default: {default}")
        return default


def safe_int(
    value: Any,
    default: Optional[int] = None
) -> Optional[int]:
    """
    안전한 int 변환

    Args:
        value: 변환할 값
        default: 변환 실패 시 기본값

    Returns:
        변환된 int 또는 기본값
    """
    if value is None or value == '.' or value == '':
        return default

    try:
        return int(float(value))  # Handle "123.0" strings
    except (ValueError, TypeError):
        log.warning(f"Cannot convert to int: {value}, using default: {default}")
        return default


def parse_date(
    value: Union[str, date, datetime],
    format: str = '%Y-%m-%d'
) -> Optional[date]:
    """
    날짜 파싱

    Args:
        value: 파싱할 날짜
        format: 날짜 형식

    Returns:
        파싱된 date 객체
    """
    if value is None:
        return None

    if isinstance(value, date):
        return value

    if isinstance(value, datetime):
        return value.date()

    if isinstance(value, str):
        try:
            return datetime.strptime(value, format).date()
        except ValueError as e:
            log.warning(f"Cannot parse date: {value}, format: {format}, error: {e}")
            return None

    return None


def get_date_range(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    default_days: int = 365
) -> tuple[date, date]:
    """
    날짜 범위 자동 생성

    Args:
        start_date: 시작일 (None이면 end_date - default_days)
        end_date: 종료일 (None이면 오늘)
        default_days: 기본 기간

    Returns:
        (start_date, end_date) 튜플
    """
    if end_date is None:
        end_date = date.today()

    if start_date is None:
        start_date = end_date - timedelta(days=default_days)

    return start_date, end_date


def chunk_list(
    items: List[Any],
    chunk_size: int
) -> List[List[Any]]:
    """
    리스트를 청크로 분할

    Args:
        items: 분할할 리스트
        chunk_size: 청크 크기

    Returns:
        청크 리스트
    """
    return [items[i:i + chunk_size] for i in range(0, len(items), chunk_size)]


def flatten_dict(
    d: Dict[str, Any],
    parent_key: str = '',
    sep: str = '_'
) -> Dict[str, Any]:
    """
    중첩된 딕셔너리를 평탄화

    Args:
        d: 평탄화할 딕셔너리
        parent_key: 부모 키 (재귀용)
        sep: 구분자

    Returns:
        평탄화된 딕셔너리
    """
    items = []
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key, sep=sep).items())
        else:
            items.append((new_key, v))
    return dict(items)


def merge_dicts(
    *dicts: Dict[str, Any],
    skip_none: bool = True
) -> Dict[str, Any]:
    """
    여러 딕셔너리를 병합

    Args:
        *dicts: 병합할 딕셔너리들
        skip_none: None 값 스킵 여부

    Returns:
        병합된 딕셔너리
    """
    result = {}
    for d in dicts:
        if d is None:
            continue
        for k, v in d.items():
            if skip_none and v is None:
                continue
            result[k] = v
    return result


def format_number(
    value: Optional[float],
    decimals: int = 2,
    with_sign: bool = False,
    suffix: str = ''
) -> str:
    """
    숫자 포맷팅

    Args:
        value: 포맷팅할 숫자
        decimals: 소수점 자릿수
        with_sign: 부호 표시 여부
        suffix: 접미사

    Returns:
        포맷팅된 문자열
    """
    if value is None:
        return 'N/A'

    sign = '+' if with_sign and value > 0 else ''
    return f"{sign}{value:,.{decimals}f}{suffix}"


def deduplicate_list(
    items: List[Any],
    key: Optional[str] = None
) -> List[Any]:
    """
    리스트 중복 제거

    Args:
        items: 중복 제거할 리스트
        key: 객체 리스트인 경우 비교할 속성명

    Returns:
        중복 제거된 리스트
    """
    if not items:
        return []

    if key is None:
        # Simple deduplication for primitives
        seen = set()
        result = []
        for item in items:
            if item not in seen:
                seen.add(item)
                result.append(item)
        return result
    else:
        # Deduplication for objects by key
        seen = set()
        result = []
        for item in items:
            item_key = getattr(item, key, None)
            if item_key not in seen:
                seen.add(item_key)
                result.append(item)
        return result


def filter_none_values(d: Dict[str, Any]) -> Dict[str, Any]:
    """
    딕셔너리에서 None 값 제거

    Args:
        d: 필터링할 딕셔너리

    Returns:
        None이 제거된 딕셔너리
    """
    return {k: v for k, v in d.items() if v is not None}
