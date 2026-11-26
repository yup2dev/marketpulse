"""요청 범위 사용자 — 인증 미들웨어(auth_gate)가 넣고 실행 계층이 읽는다.

로컬 실행(fetcher target="local") 조회를 '그 사용자의 PC Fetcher' 로 위임하고, 키가 필요한 조회를 그 사용자의 키로 부를 때 쓴다.
배경 작업처럼 요청이 없으면 None — 로컬 전용 조회는 실패(RemoteUnavailableError), 키 조회는 운영자 키(env).
asyncio.to_thread · run_in_threadpool 은 contextvars 를 복사하므로 스레드로 넘어가도 값이 남는다.
"""
import time
from contextvars import ContextVar
from typing import Any, Dict, List, Optional

current_user_id: "ContextVar[Optional[str]]" = ContextVar("current_user_id", default=None)


# ── 실행 기록 — 응답 metadata(cached · duration_ms · row_count · executed_at)용 ────────────
# ServerExecutor.fetch 가 조회마다 남기고, OBBject 를 만드는 곳(OBBject.from_query · CommandRunner)이 모은다.
# 기록 통이 없으면(배경 작업 · 테스트에서 직접 부를 때) 조용히 버린다. 목록 객체를 공유하므로
# asyncio.gather 의 하위 태스크 기록도 모인다.

_execution_log: "ContextVar[Optional[List[Dict[str, Any]]]]" = ContextVar("execution_log", default=None)


def record_execution(provider: str, model: str, cached: bool, executed_at: str) -> None:
    bucket = _execution_log.get()
    if bucket is not None:
        bucket.append({"provider": provider, "model": model, "cached": cached, "executed_at": executed_at})


class ExecutionLog:
    """with ExecutionLog() as log: … → log.metadata(row_count) 로 응답 metadata 를 만든다."""

    def __enter__(self) -> "ExecutionLog":
        self.entries: List[Dict[str, Any]] = []
        self._started = time.perf_counter()
        self._token = _execution_log.set(self.entries)
        return self

    def __exit__(self, *exc: Any) -> None:
        self.duration_ms = round((time.perf_counter() - self._started) * 1000, 1)
        _execution_log.reset(self._token)

    def metadata(self, row_count: int) -> Dict[str, Any]:
        """cached: 모든 조회가 캐시에서 · executed_at: server | local | mixed (조회가 없으면 None)."""
        where = {e["executed_at"] for e in self.entries}
        return {
            "cached": bool(self.entries) and all(e["cached"] for e in self.entries),
            "duration_ms": getattr(self, "duration_ms", round((time.perf_counter() - self._started) * 1000, 1)),
            "row_count": row_count,
            "executed_at": where.pop() if len(where) == 1 else ("mixed" if where else None),
        }
