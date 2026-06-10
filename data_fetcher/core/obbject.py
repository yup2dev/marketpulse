"""
OBBject

모든 API 응답을 감싸는 표준 결과 래퍼.
OpenBB의 OBBject 패턴을 따릅니다.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, TYPE_CHECKING

from pydantic import BaseModel, Field

from data_fetcher.abstract_provider.abstract.fetcher import AnnotatedResult
from data_fetcher.core.warnings import WarningsCollector

if TYPE_CHECKING:
    from data_fetcher.core.query import Query


class OBBject(BaseModel):
    """
    표준 API 응답 객체

    Attributes:
        results:  직렬화된 데이터 리스트
        provider: 데이터 제공자 이름 (예: "fmp", "yahoo")
        warnings: 실행 중 수집된 경고 메시지 (미지원 파라미터 등)
        metadata: 추가 메타데이터 (모델, 파라미터, AnnotatedResult 정보)
    """

    results: List[Any] = Field(default_factory=list)
    provider: Optional[str] = None
    warnings: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    model_config = {"arbitrary_types_allowed": True}

    # ── 팩토리 ──────────────────────────────────────────────────────────────
    @classmethod
    async def from_query(cls, query: "Query") -> "OBBject":
        """
        Query를 실행하고 결과를 OBBject로 감싸서 반환

        실행 중 발생한 경고는 WarningsCollector 로 자동 수집되어
        응답의 warnings 필드에 포함됩니다.

        Args:
            query: 실행할 Query 객체

        Returns:
            OBBject 인스턴스
        """
        with WarningsCollector() as wc:
            raw = await query.execute()
            collected_warnings = wc.warnings

        # AnnotatedResult 언래핑
        extra_metadata: Dict[str, Any] = {}
        if isinstance(raw, AnnotatedResult):
            extra_metadata = raw.metadata or {}
            raw = raw.result

        # Pydantic 모델 → dict 직렬화
        serialized: List[Any] = []
        for item in (raw or []):
            if hasattr(item, "model_dump"):
                serialized.append(item.model_dump(mode="json"))
            elif isinstance(item, dict):
                serialized.append(item)
            else:
                serialized.append(item)

        return cls(
            results=serialized,
            provider=query.provider,
            warnings=collected_warnings,
            metadata={
                "model": query.model,
                "params": query.params,
                **extra_metadata,
            },
        )
