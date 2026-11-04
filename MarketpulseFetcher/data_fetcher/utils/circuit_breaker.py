"""
Provider별 서킷브레이커

상태 전이:
    CLOSED  → 정상 운전. 실패 누적 시 OPEN으로 전환.
    OPEN    → 업스트림 호출 차단. recovery_timeout 후 HALF-OPEN 시도.
    HALF-OPEN → 프로브 1회. 성공 → CLOSED, 실패 → OPEN 재진입.

설계 원칙:
    - 순수 asyncio (외부 의존 없음)
    - data_fetcher 레이어에 위치 — app.backend를 import하지 않음
    - provider 이름을 키로 하는 프로세스 전역 레지스트리

사용법:
    cb = get_circuit_breaker("fmp")
    async with cb:
        result = await fetcher.fetch_data(...)
    # 또는
    await cb.call(coro)
"""
from __future__ import annotations

import asyncio
import logging
import time
from enum import Enum
from typing import Dict, Optional

log = logging.getLogger(__name__)


class State(Enum):
    CLOSED    = "closed"
    OPEN      = "open"
    HALF_OPEN = "half_open"


class CircuitBreakerOpen(Exception):
    """서킷이 OPEN 상태일 때 호출 시 발생."""
    def __init__(self, provider: str, retry_after: float):
        self.provider = provider
        self.retry_after = retry_after
        super().__init__(
            f"Circuit breaker OPEN for provider '{provider}'. "
            f"Retry after {retry_after:.1f}s."
        )


class CircuitBreaker:
    """
    단일 provider에 대한 서킷브레이커.

    Args:
        provider:         Provider 이름 (로그·에러 메시지용)
        failure_threshold: CLOSED→OPEN 전환에 필요한 연속 실패 횟수 (기본 5)
        recovery_timeout:  OPEN→HALF-OPEN 대기 시간(초) (기본 60)
        probe_timeout:     HALF-OPEN 프로브 최대 대기 시간(초) (기본 10)
        exceptions:        서킷 트리거 대상 예외 클래스 튜플
                           (기본: Exception 전체, 단 asyncio.CancelledError 제외)
    """

    def __init__(
        self,
        provider: str,
        failure_threshold: int = 5,
        recovery_timeout: float = 60.0,
        probe_timeout: float = 10.0,
        exceptions: tuple = (Exception,),
    ):
        self.provider = provider
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.probe_timeout = probe_timeout
        self.exceptions = exceptions

        self._state: State = State.CLOSED
        self._failure_count: int = 0
        self._opened_at: float = 0.0       # OPEN 진입 시각
        self._probe_lock = asyncio.Lock()   # HALF-OPEN 프로브를 한 번에 하나만

    # ── 공개 속성 ─────────────────────────────────────────────────────────────

    @property
    def state(self) -> State:
        self._maybe_transition_to_half_open()
        return self._state

    @property
    def failure_count(self) -> int:
        return self._failure_count

    def retry_after(self) -> float:
        """OPEN 상태에서 HALF-OPEN 전환까지 남은 초. 0이면 이미 전환 가능."""
        if self._state is not State.OPEN:
            return 0.0
        remaining = self.recovery_timeout - (time.monotonic() - self._opened_at)
        return max(remaining, 0.0)

    def is_open(self) -> bool:
        return self.state is State.OPEN

    # ── async with 지원 ───────────────────────────────────────────────────────

    async def __aenter__(self):
        await self._before_call()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if exc_type is None:
            self._on_success()
        elif exc_type is asyncio.CancelledError:
            pass  # 취소는 실패로 간주하지 않음
        elif issubclass(exc_type, self.exceptions):
            self._on_failure(exc_val)
        return False  # 예외 전파

    async def call(self, coro):
        """코루틴을 서킷브레이커로 감싸 실행."""
        async with self:
            return await coro

    # ── 내부 로직 ─────────────────────────────────────────────────────────────

    def _maybe_transition_to_half_open(self) -> None:
        if (
            self._state is State.OPEN
            and time.monotonic() - self._opened_at >= self.recovery_timeout
        ):
            self._state = State.HALF_OPEN
            log.info("[CB] %s: OPEN → HALF-OPEN (probe ready)", self.provider)

    async def _before_call(self) -> None:
        self._maybe_transition_to_half_open()

        if self._state is State.OPEN:
            raise CircuitBreakerOpen(self.provider, self.retry_after())

        if self._state is State.HALF_OPEN:
            # 프로브는 한 번에 하나만. 대기 중인 나머지는 OPEN 에러 반환.
            if self._probe_lock.locked():
                raise CircuitBreakerOpen(self.provider, self.probe_timeout)
            # 락 획득은 호출자가 __aexit__까지 유지해야 하므로 여기서 acquire.
            await self._probe_lock.acquire()

    def _on_success(self) -> None:
        if self._state is State.HALF_OPEN:
            self._probe_lock.release()
            self._state = State.CLOSED
            self._failure_count = 0
            log.info("[CB] %s: HALF-OPEN → CLOSED (recovered)", self.provider)
        elif self._state is State.CLOSED:
            self._failure_count = 0

    def _on_failure(self, exc: Exception) -> None:
        if self._state is State.HALF_OPEN:
            if self._probe_lock.locked():
                self._probe_lock.release()
            self._trip(exc)
            return

        self._failure_count += 1
        if self._failure_count >= self.failure_threshold:
            self._trip(exc)

    def _trip(self, exc: Exception) -> None:
        self._state = State.OPEN
        self._opened_at = time.monotonic()
        log.warning(
            "[CB] %s: tripped OPEN after %d failures (last: %s: %s). "
            "Retry in %.0fs.",
            self.provider, self._failure_count,
            type(exc).__name__, exc,
            self.recovery_timeout,
        )
        self._failure_count = 0  # 리셋 — CLOSED 복귀 후 다시 카운트

    def stats(self) -> dict:
        return {
            "provider": self.provider,
            "state": self.state.value,
            "failure_count": self._failure_count,
            "failure_threshold": self.failure_threshold,
            "recovery_timeout": self.recovery_timeout,
            "retry_after": round(self.retry_after(), 1),
        }


# ── 프로세스 전역 레지스트리 ──────────────────────────────────────────────────

_registry: Dict[str, CircuitBreaker] = {}

# provider별 기본 설정 오버라이드 (미등록 시 기본값 사용)
_PROVIDER_CONFIG: Dict[str, dict] = {
    "fmp":          {"failure_threshold": 5, "recovery_timeout": 60},
    "polygon":      {"failure_threshold": 5, "recovery_timeout": 60},
    "fred":         {"failure_threshold": 3, "recovery_timeout": 120},  # 공개 API — 더 보수적
    "alphavantage": {"failure_threshold": 3, "recovery_timeout": 120},  # 엄격한 rate limit
    "yahoo":        {"failure_threshold": 5, "recovery_timeout": 30},   # yfinance — 빠른 복구
    "sec":          {"failure_threshold": 3, "recovery_timeout": 180},  # SEC EDGAR rate limit
    "database":     {"failure_threshold": 2, "recovery_timeout": 30},
}


def get_circuit_breaker(provider: str) -> CircuitBreaker:
    """provider 이름으로 싱글톤 CircuitBreaker를 반환 (없으면 생성)."""
    if provider not in _registry:
        cfg = _PROVIDER_CONFIG.get(provider, {})
        _registry[provider] = CircuitBreaker(provider=provider, **cfg)
    return _registry[provider]


def all_stats() -> list[dict]:
    """모든 서킷브레이커 상태 반환 — /health 엔드포인트에서 활용."""
    return [cb.stats() for cb in _registry.values()]


def reset(provider: str) -> None:
    """수동 리셋 (관리자 API용). OPEN 서킷을 즉시 CLOSED로."""
    if provider in _registry:
        cb = _registry[provider]
        cb._state = State.CLOSED
        cb._failure_count = 0
        log.info("[CB] %s: manually reset to CLOSED", provider)
