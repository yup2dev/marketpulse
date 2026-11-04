"""조회 결과 직렬화 — QueryExecutor 반환값을 브라우저로 보낼 JSON-safe 봉투로 변환."""
from __future__ import annotations

from typing import Any, Dict

from pydantic import BaseModel

from data_fetcher.abstract_provider.abstract.annotated_result import AnnotatedResult


def _row(obj: Any) -> Any:
    if isinstance(obj, BaseModel):
        # mode="json": datetime / Decimal / Enum 등을 JSON 원시값으로 변환
        return obj.model_dump(mode="json")
    return obj


def serialize_result(raw: Any) -> Dict[str, Any]:
    """List[BaseModel] / AnnotatedResult / scalar → {"data", "metadata"}.

    브라우저는 이 봉투를 받아 그대로 외부 WebServer /api/calc 로 전달할 수 있다.
    """
    if isinstance(raw, AnnotatedResult):
        result = raw.result
        data = [_row(r) for r in result] if isinstance(result, list) else _row(result)
        return {"data": data, "metadata": raw.metadata or {}}
    if isinstance(raw, list):
        return {"data": [_row(r) for r in raw], "metadata": {}}
    return {"data": _row(raw), "metadata": {}}
