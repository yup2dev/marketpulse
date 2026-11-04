"""
Data Validation Utilities

Provides validation functions for common data types and formats.
"""
import logging
from datetime import date, datetime
from typing import Any, Optional, Union

log = logging.getLogger(__name__)


class ValidationError(Exception):
    """데이터 검증 오류"""
    pass


def validate_date(
    value: Union[str, date, datetime],
    allow_none: bool = False
) -> Optional[date]:
    """
    날짜 유효성 검증 및 변환

    Args:
        value: 검증할 날짜 (str, date, datetime)
        allow_none: None 허용 여부

    Returns:
        변환된 date 객체

    Raises:
        ValidationError: 잘못된 날짜 형식
    """
    if value is None:
        if allow_none:
            return None
        raise ValidationError("Date cannot be None")

    if isinstance(value, date):
        return value

    if isinstance(value, datetime):
        return value.date()

    if isinstance(value, str):
        # Try common date formats
        formats = [
            '%Y-%m-%d',
            '%Y/%m/%d',
            '%d-%m-%Y',
            '%d/%m/%Y',
            '%m-%d-%Y',
            '%m/%d/%Y'
        ]

        for fmt in formats:
            try:
                return datetime.strptime(value, fmt).date()
            except ValueError:
                continue

        raise ValidationError(f"Invalid date format: {value}")

    raise ValidationError(f"Unsupported date type: {type(value)}")


def validate_symbol(symbol: str) -> str:
    """
    주식 심볼 유효성 검증

    Args:
        symbol: 검증할 심볼

    Returns:
        정규화된 심볼 (대문자)

    Raises:
        ValidationError: 잘못된 심볼
    """
    if not symbol:
        raise ValidationError("Symbol cannot be empty")

    if not isinstance(symbol, str):
        raise ValidationError(f"Symbol must be string, got {type(symbol)}")

    # Remove whitespace and convert to uppercase
    symbol = symbol.strip().upper()

    # Basic validation
    if not symbol:
        raise ValidationError("Symbol cannot be whitespace only")

    if len(symbol) > 10:
        log.warning(f"Unusually long symbol: {symbol}")

    return symbol


def validate_numeric(
    value: Any,
    min_value: Optional[float] = None,
    max_value: Optional[float] = None,
    allow_none: bool = False
) -> Optional[float]:
    """
    숫자 유효성 검증

    Args:
        value: 검증할 값
        min_value: 최소값
        max_value: 최대값
        allow_none: None 허용 여부

    Returns:
        변환된 float 값

    Raises:
        ValidationError: 잘못된 값
    """
    if value is None:
        if allow_none:
            return None
        raise ValidationError("Value cannot be None")

    try:
        num = float(value)
    except (ValueError, TypeError):
        raise ValidationError(f"Cannot convert to numeric: {value}")

    if min_value is not None and num < min_value:
        raise ValidationError(f"Value {num} is less than minimum {min_value}")

    if max_value is not None and num > max_value:
        raise ValidationError(f"Value {num} is greater than maximum {max_value}")

    return num


def validate_country_code(
    country: str,
    valid_codes: Optional[list] = None
) -> str:
    """
    국가 코드 유효성 검증

    Args:
        country: 검증할 국가 코드
        valid_codes: 허용된 국가 코드 목록

    Returns:
        정규화된 국가 코드 (대문자)

    Raises:
        ValidationError: 잘못된 국가 코드
    """
    if not country:
        raise ValidationError("Country code cannot be empty")

    if not isinstance(country, str):
        raise ValidationError(f"Country code must be string, got {type(country)}")

    country = country.strip().upper()

    if valid_codes and country not in valid_codes:
        raise ValidationError(
            f"Invalid country code: {country}. "
            f"Valid codes: {', '.join(valid_codes)}"
        )

    return country


def validate_frequency(
    frequency: str,
    valid_frequencies: Optional[list] = None
) -> str:
    """
    데이터 빈도 유효성 검증

    Args:
        frequency: 검증할 빈도
        valid_frequencies: 허용된 빈도 목록

    Returns:
        정규화된 빈도 (소문자)

    Raises:
        ValidationError: 잘못된 빈도
    """
    if not frequency:
        raise ValidationError("Frequency cannot be empty")

    if not isinstance(frequency, str):
        raise ValidationError(f"Frequency must be string, got {type(frequency)}")

    frequency = frequency.strip().lower()

    if valid_frequencies and frequency not in valid_frequencies:
        raise ValidationError(
            f"Invalid frequency: {frequency}. "
            f"Valid frequencies: {', '.join(valid_frequencies)}"
        )

    return frequency


def validate_date_range(
    start_date: Optional[date],
    end_date: Optional[date]
) -> tuple[Optional[date], Optional[date]]:
    """
    날짜 범위 유효성 검증

    Args:
        start_date: 시작일
        end_date: 종료일

    Returns:
        (start_date, end_date) 튜플

    Raises:
        ValidationError: 잘못된 날짜 범위
    """
    if start_date and end_date:
        if start_date > end_date:
            raise ValidationError(
                f"Start date ({start_date}) cannot be after end date ({end_date})"
            )

    return start_date, end_date


def validate_limit(
    limit: Optional[int],
    min_limit: int = 1,
    max_limit: int = 10000
) -> Optional[int]:
    """
    조회 개수 제한 유효성 검증

    Args:
        limit: 검증할 제한 값
        min_limit: 최소 제한
        max_limit: 최대 제한

    Returns:
        검증된 제한 값

    Raises:
        ValidationError: 잘못된 제한 값
    """
    if limit is None:
        return None

    try:
        limit = int(limit)
    except (ValueError, TypeError):
        raise ValidationError(f"Limit must be integer, got {limit}")

    if limit < min_limit:
        raise ValidationError(f"Limit {limit} is less than minimum {min_limit}")

    if limit > max_limit:
        log.warning(f"Limit {limit} exceeds maximum {max_limit}, capping")
        return max_limit

    return limit
