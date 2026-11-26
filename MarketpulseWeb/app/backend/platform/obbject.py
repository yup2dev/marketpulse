"""
OBBject

모든 API 응답을 감싸는 표준 결과 래퍼.
OpenBB의 OBBject 패턴을 따릅니다.
"""
from __future__ import annotations

from typing import Any, Dict, Generic, List, Optional, TYPE_CHECKING

from pydantic import BaseModel, Field
from typing_extensions import TypeVar

from data_fetcher.abstract_provider.abstract.annotated_result import metadata_of_result, unwrap_result
from data_fetcher.core.warnings import WarningsCollector

if TYPE_CHECKING:
    from app.backend.platform.query import Query

# results 의 타입. 지정하지 않으면 List[Any] — 기존 `-> OBBject` 라우트의 OpenAPI 스키마가 그대로다.
# 라우트가 `-> OBBject[List[Row]]` 로 적으면 results 가 Row 목록으로 검증되고 스키마에 Row 가 나온다.
T = TypeVar("T", default=List[Any])


# OpenBB OBBject[T] 와 같은 제네릭. docstring 은 OpenAPI 스키마의 description 으로 나가므로 바꾸지 않는다
# (tests/test_response_envelope.py 가 타입 없는 OBBject 스키마가 그대로인지 본다).
class OBBject(BaseModel, Generic[T]):
    """
    표준 API 응답 객체

    Attributes:
        results:  직렬화된 데이터 리스트
        provider: 데이터 제공자 이름 (예: "fmp", "yahoo")
        warnings: 실행 중 수집된 경고 메시지 (미지원 파라미터 등)
        metadata: 추가 메타데이터 (모델, 파라미터, AnnotatedResult 정보)
    """

    results: T = Field(default_factory=list)   # 지정하지 않으면 List[Any]
    provider: Optional[str] = None
    warnings: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    model_config = {"arbitrary_types_allowed": True}

    # ── fetcher 결과 다루기 — AnnotatedResult 는 여기서만 안다 ────────────────
    # fetcher 는 List[Data] 또는 AnnotatedResult(result, metadata) 를 돌려준다.
    # 라우트 · 서비스는 isinstance(raw, AnnotatedResult) 를 직접 보지 않고 아래 둘 중 하나를 쓴다.

    @staticmethod
    def unwrap(raw: Any) -> Any:
        """fetcher 결과에서 데이터만 — AnnotatedResult 면 .result, 아니면 그대로. 직렬화하지 않는다.

        모델 객체(속성 · 날짜 타입)를 그대로 써야 하는 서비스 계산용. 응답을 만들 때는 from_result.
        """
        return unwrap_result(raw)

    @staticmethod
    def metadata_of(raw: Any) -> Dict[str, Any]:
        """fetcher 결과의 metadata — AnnotatedResult 가 아니면 빈 dict. unwrap 과 짝."""
        return metadata_of_result(raw)

    @classmethod
    def from_result(
        cls,
        raw: Any,
        provider: Optional[str] = None,
        *,
        metadata: Optional[Dict[str, Any]] = None,
        warnings: Optional[List[str]] = None,
    ) -> "OBBject":
        """fetcher 결과 → OBBject (OpenBB OBBject.from_query 의 결과 처리부).

          - AnnotatedResult  → result 추출 + metadata 보존 (넘긴 metadata 위에 덮는다)
          - List[DataModel]  → model_dump(mode='json') 직렬화
          - List[dict]       → 그대로
          - dict · 모델 하나 → 한 행짜리 목록 (스냅샷)
          - None             → 빈 목록
        """
        merged: Dict[str, Any] = dict(metadata or {})
        merged.update(metadata_of_result(raw))
        raw = unwrap_result(raw)

        items = raw if isinstance(raw, list) else ([raw] if raw is not None else [])
        results = [
            item.model_dump(mode="json") if hasattr(item, "model_dump") else item
            for item in items
        ]
        return cls(results=results, provider=provider, warnings=list(warnings or []), metadata=merged)

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

        return cls.from_result(
            raw,
            query.provider,
            metadata={"model": query.model, "params": query.params},
            warnings=collected_warnings,
        )
