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


def unwrap_result(raw: Any) -> Any:
    """AnnotatedResult 면 .result, 아니면 그대로 — 다른 fetcher 의 결과를 받아 쓰는 fetcher 용 (app 계층의 OBBject 를 쓰지 않는다)."""
    return raw.result if isinstance(raw, AnnotatedResult) else raw


def metadata_of_result(raw: Any) -> Dict[str, Any]:
    """AnnotatedResult 의 metadata — 아니면 빈 dict."""
    return dict(raw.metadata or {}) if isinstance(raw, AnnotatedResult) else {}
