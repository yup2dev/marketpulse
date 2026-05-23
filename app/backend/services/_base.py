"""
공통 서비스 유틸리티

모든 서비스 파일에서 공유하는 헬퍼 함수 모음.
QueryExecutor 결과(AnnotatedResult 또는 raw)를 일관되게 처리합니다.
"""
from typing import Any, List, Optional, TypeVar

from data_fetcher.fetchers.base import AnnotatedResult

T = TypeVar("T")


def unwrap(raw: Any) -> Any:
    """AnnotatedResult 또는 raw 데이터에서 결과 리스트를 추출합니다."""
    return raw.result if isinstance(raw, AnnotatedResult) else raw


def first(raw: Any) -> Optional[Any]:
    """첫 번째 항목을 반환합니다. 비어 있으면 None."""
    result = unwrap(raw)
    return result[0] if result else None


def limit_results(raw: Any, n: int) -> List[Any]:
    """결과를 최대 n개로 제한합니다."""
    return unwrap(raw)[:n]
