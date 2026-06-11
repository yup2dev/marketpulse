"""WSFetcherTransport — '현재 사용자'의 PC Fetcher(WS 워커)로 위임하는 RemoteTransport.

QueryExecutor는 RemoteTransport.fetch(provider, model, params, credentials)만 호출하고
user_id는 모른다. 이 트랜스포트가 요청 범위 contextvar(current_user_id)를 읽어
'그 사용자의 워커'로 라우팅한다(사용자별 키 사용).

예외 매핑:
  - 워커 없음/타임아웃/끊김(FetcherWorkerUnavailable) → RemoteUnavailableError
    → QueryExecutor가 백엔드 직접 호출로 폴백.
  - 워커 실행 실패(FetcherRemoteError, 예: 사용자 키 미설정) → QueryExecutorError로 전파
    → 폴백하지 않고 '기존과 동일한 오류'를 사용자에게 보인다.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from app.backend.core.fetcher_client import _json_safe, _restore
from app.backend.core.fetcher_pool import (
    FetcherRemoteError,
    FetcherWorkerUnavailable,
    fetcher_pool,
)
from data_fetcher.abstract_provider.abstract.annotated_result import AnnotatedResult
from data_fetcher.query_executor import (
    QueryExecutorError,
    RemoteUnavailableError,
    current_user_id,
)

log = logging.getLogger(__name__)


class WSFetcherTransport:
    """RemoteTransport 구현 — 현재 사용자의 Fetcher 워커 풀에 위임."""

    def __init__(self, timeout: float = 90.0) -> None:
        self.timeout = timeout

    async def fetch(
        self,
        provider: str,
        model: str,
        params: Dict[str, Any],
        credentials: Optional[Dict[str, str]] = None,  # 미사용: 키는 사용자 Fetcher가 보유
        **kwargs: Any,
    ) -> Any:
        user_id = current_user_id.get()
        try:
            msg = await fetcher_pool.fetch(
                user_id, provider, model, _json_safe(params), timeout=self.timeout
            )
        except FetcherWorkerUnavailable as exc:
            # 폴백 대상 — 백엔드 직접 호출로 넘어가게 한다
            raise RemoteUnavailableError(str(exc)) from exc
        except FetcherRemoteError as exc:
            # 워커가 실행했으나 실패(사용자 키 미설정 등) → 그대로 전파(폴백 금지)
            raise QueryExecutorError(str(exc)) from exc

        rows = _restore(msg.get("data"))
        metadata = msg.get("metadata") or {}
        if metadata:
            return AnnotatedResult(result=rows, metadata=metadata)
        return rows if isinstance(rows, list) else [rows] if rows is not None else []

    async def aclose(self) -> None:
        """FetcherClient와 인터페이스를 맞추기 위한 no-op."""
