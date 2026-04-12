"""
Query Warnings Collector

ContextVar 기반 경고 수집기. QueryExecutor 실행 중 발생하는 경고
(미지원 파라미터, deprecated 옵션 등)를 OBBject 응답에 모아 반환하기 위해 사용.

사용 패턴:
    async with WarningsCollector() as wc:
        results = await QueryExecutor.fetch(...)
    print(wc.warnings)  # ["Unsupported param 'foo' for fetcher X"]

내부 구현:
    QueryExecutor / Query 등이 add_warning("...") 호출하면
    ContextVar에 담긴 현재 수집기 리스트에 append 됨.
    수집기가 없으면 경고는 조용히 무시됨(라이브러리 직접 호출 시 안전).
"""
from __future__ import annotations

from contextvars import ContextVar
from typing import List, Optional

_warnings: ContextVar[Optional[List[str]]] = ContextVar(
    "query_warnings", default=None
)


def add_warning(msg: str) -> None:
    """활성 수집기에 경고 추가. 수집기가 없으면 무시."""
    bucket = _warnings.get()
    if bucket is not None:
        bucket.append(msg)


class WarningsCollector:
    """경고 수집 컨텍스트 매니저

    with 블록 내에서 add_warning()으로 쌓인 메시지를 self.warnings로 회수.
    중첩 사용해도 각 스코프가 자신의 버킷을 가짐.
    """

    def __init__(self) -> None:
        self._bucket: List[str] = []
        self._token = None

    def __enter__(self) -> "WarningsCollector":
        self._token = _warnings.set(self._bucket)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        if self._token is not None:
            _warnings.reset(self._token)

    @property
    def warnings(self) -> List[str]:
        return list(self._bucket)
