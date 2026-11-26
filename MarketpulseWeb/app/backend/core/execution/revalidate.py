"""PC Fetcher 결과 재검증 — JSON 으로 건너오며 잃은 타입을 등록 fetcher 의 data_type 으로 되살린다.

서버 실행은 Pydantic Data 를, PC 실행은 JSON(→ DotDict)을 받던 차이를 없앤다. 이후 캐시 · 라우트 · command 는
실행 위치와 관계없이 같은 Data 타입을 받는다. fetcher 나 TET 를 다시 실행하는 일이 아니다.

실패 처리는 Partial + 격리:
  - 검증에 성공한 행만 결과에 넣는다. 실패한 행을 DotDict 로 섞어 두지 않는다.
  - 실패 행은 진단 로그로 격리하고(원문은 응답에 내보내지 않는다), 응답에는 validation_failed 경고와 건수를 싣는다.
  - metadata 는 받은 그대로 둔다.
"""
import logging
from typing import Any, List, Optional, Tuple

from pydantic import ValidationError

from data_fetcher.abstract_provider.abstract.annotated_result import (
    AnnotatedResult, metadata_of_result, unwrap_result,
)
from data_fetcher.core.warnings import add_warning

log = logging.getLogger(__name__)


def _data_type(provider: str, model: str) -> Optional[type]:
    from data_fetcher.query_executor import QueryExecutor

    ex = QueryExecutor()
    try:
        data_type = ex.get_fetcher(ex.get_provider(provider), model).data_type
    except Exception:  # noqa: BLE001 — 등록되지 않은 쌍이면 검증 없이 넘긴다
        return None
    return data_type if hasattr(data_type, "model_validate") else None


def _validate_rows(data_type: type, rows: List[Any]) -> Tuple[List[Any], int]:
    ok, failed = [], 0
    for row in rows:
        if not isinstance(row, dict):
            ok.append(row)                     # 스칼라 등 — 모델 행이 아니다
            continue
        try:
            ok.append(data_type.model_validate(dict(row)))
        except ValidationError as exc:
            failed += 1
            if failed <= 3:                    # 격리 — 로그에만 (원문 전체는 남기지 않는다)
                log.warning("[revalidate] %s 행 검증 실패 (%d개 오류): %s",
                            data_type.__name__, exc.error_count(), exc.errors()[0].get("msg"))
    return ok, failed


def revalidate(provider: str, model: str, raw: Any) -> Any:
    """PC Fetcher 결과(list · AnnotatedResult · 단일 dict) → 같은 모양, 행은 Pydantic Data 로."""
    data_type = _data_type(provider, model)
    if data_type is None:
        return raw

    payload = unwrap_result(raw)
    wrapped = payload is not raw                       # AnnotatedResult 였다
    single = not isinstance(payload, list)
    rows = [] if payload is None else ([payload] if single else payload)

    ok, failed = _validate_rows(data_type, rows)
    if failed:
        log.warning("[revalidate] %s/%s %d/%d행 제외", provider, model, failed, len(rows))
        add_warning(f"validation_failed: {provider}/{model} {failed}/{len(rows)}행 제외")

    result: Any = (ok[0] if ok else None) if single else ok
    if wrapped:
        return AnnotatedResult(result=result, metadata=metadata_of_result(raw))
    return result
