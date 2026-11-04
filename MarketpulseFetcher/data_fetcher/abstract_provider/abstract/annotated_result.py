"""AnnotatedResult — 메타데이터 포함 결과 래퍼"""
from typing import Any, Dict, Generic, Optional, TypeVar

_T = TypeVar("_T")


class AnnotatedResult(Generic[_T]):
    """메타데이터를 포함한 결과 래퍼"""

    def __init__(self, result: _T, metadata: Optional[Dict[str, Any]] = None):
        self.result = result
        self.metadata = metadata or {}

    def __repr__(self) -> str:
        return f"AnnotatedResult(result={self.result}, metadata={self.metadata})"
