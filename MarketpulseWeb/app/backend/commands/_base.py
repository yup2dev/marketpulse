"""command 공용 — 출처(Source)를 QueryExecutor 로 부르고 행(dict)으로 받는다."""
import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Mapping, Optional, Sequence, Tuple, Union

from data_fetcher.core.obbject import OBBject
from data_fetcher.query_executor import QueryExecutor

log = logging.getLogger(__name__)

Rows = List[Dict[str, Any]]


@dataclass(frozen=True)
class Source:
    """불러올 데이터 하나 — provider · model · 고정 파라미터. 라우트가 만들어 command 에 넘긴다."""

    provider: str
    model: str
    params: Mapping[str, Any] = field(default_factory=dict)

    def with_params(self, **extra: Any) -> "Source":
        merged = {**self.params, **{k: v for k, v in extra.items() if v is not None}}
        return Source(self.provider, self.model, merged)


async def fetch_rows(src: Source) -> Rows:
    """출처 하나 → 행 목록. 모델 객체는 dict 로 (날짜는 date 타입 그대로)."""
    raw = OBBject.unwrap(await QueryExecutor.fetch(src.provider, src.model, dict(src.params)))
    items = raw if isinstance(raw, list) else ([raw] if raw is not None else [])
    return [r.model_dump() if hasattr(r, "model_dump") else dict(r) for r in items]


async def fetch_many(sources: Sequence[Source]) -> List[Union[Rows, BaseException]]:
    """여러 출처를 병렬로 — 하나가 실패해도 나머지는 받는다 (실패 자리에는 예외)."""
    return await asyncio.gather(*[fetch_rows(s) for s in sources], return_exceptions=True)


def raise_if_all_failed(found: Sequence[Union[Rows, BaseException]], label: str) -> None:
    """전부 실패면 첫 오류를 그대로 올린다 — 키 미등록(424) · Fetcher 미접속(503) 안내가 화면까지 가게.

    일부만 실패하면 경고만 남긴다 (그 항목만 빠진다).
    """
    errors = [r for r in found if isinstance(r, BaseException)]
    if errors and len(errors) == len(found):
        raise errors[0]
    for e in errors:
        log.warning("[%s] %s", label, e)


def pct_change(cur: Optional[float], prev: Optional[float]) -> Optional[float]:
    """직전 대비 변화율 (%). 값이 없거나 직전이 0 이면 None."""
    if cur is None or prev is None or prev == 0:
        return None
    return (cur - prev) / prev * 100


def latest_two(rows: Rows, date_key: str = "date") -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
    """날짜 순으로 최신 · 직전 행. fetcher 마다 정렬 방향이 달라도 날짜로 고른다."""
    dated = sorted((r for r in rows if r.get(date_key) is not None), key=lambda r: str(r[date_key]))
    if not dated:
        return None, None
    return dated[-1], (dated[-2] if len(dated) > 1 else None)
