"""
FetcherClient — 배포 WebServer(app.backend) → 로컬 Fetcher(exe) REST 위임 클라이언트.

데이터 흐름:  Frontend ──▶ Backend ──▶ Fetcher(exe) `/fetch` ──▶ 외부 provider

QueryExecutor에 RemoteTransport로 주입된다. 캐시 MISS 시 백엔드가 provider를
직접 호출하는 대신 이 클라이언트가 Fetcher REST `/fetch`로 조회를 넘긴다.
캐시/SWR/single-flight는 백엔드 QueryExecutor에 그대로 남는다.

Fetcher 응답({data, metadata})의 각 행은 DotDict로 복원해, Pydantic 모델을
받던 기존 서비스 코드(`item.symbol` / `item['symbol']`)가 그대로 동작하게 한다.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import httpx

from data_fetcher.abstract_provider.abstract.annotated_result import AnnotatedResult
from data_fetcher.query_executor import QueryExecutorError

log = logging.getLogger(__name__)


class DotDict(dict):
    """attribute 접근과 key 접근을 모두 지원하는 dict."""

    def __getattr__(self, name: str) -> Any:
        try:
            return self[name]
        except KeyError as exc:
            raise AttributeError(name) from exc

    def __setattr__(self, name: str, value: Any) -> None:
        self[name] = value


def _restore(rows: Any) -> Any:
    if isinstance(rows, list):
        return [DotDict(r) if isinstance(r, dict) else r for r in rows]
    return DotDict(rows) if isinstance(rows, dict) else rows


class FetcherClient:
    """RemoteTransport 구현 — Fetcher REST `/fetch` 호출."""

    def __init__(
        self,
        base_url: str,
        timeout: float = 30.0,
        token: Optional[str] = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        headers = {"Authorization": f"Bearer {token}"} if token else None
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=httpx.Timeout(timeout, connect=10.0),
            headers=headers,
            limits=httpx.Limits(max_connections=50, max_keepalive_connections=20),
        )

    async def fetch(
        self,
        provider: str,
        model: str,
        params: Dict[str, Any],
        credentials: Optional[Dict[str, str]] = None,  # 미사용: 키는 Fetcher가 보유
        **kwargs: Any,
    ) -> Any:
        payload: Dict[str, Any] = {"provider": provider, "model": model, "params": params}
        # QueryExecutor가 이미 캐싱하므로 Fetcher 측 캐시는 끈다(중복 방지)
        payload["ttl"] = 0
        try:
            resp = await self._client.post("/fetch", json=payload)
        except httpx.RequestError as exc:
            raise QueryExecutorError(
                f"Fetcher(exe) 연결 실패 ({self.base_url}): {exc}. "
                f"로컬 Fetcher가 실행 중이고 백엔드에서 접근 가능한지 확인하세요."
            ) from exc

        if resp.status_code >= 400:
            detail = _safe_detail(resp)
            raise QueryExecutorError(f"Fetcher /fetch {resp.status_code} ({provider}:{model}): {detail}")

        body = resp.json()
        rows = _restore(body.get("data"))
        metadata = body.get("metadata") or {}
        if metadata:
            return AnnotatedResult(result=rows, metadata=metadata)
        return rows if isinstance(rows, list) else [rows] if rows is not None else []

    async def health(self) -> bool:
        try:
            resp = await self._client.get("/health")
            return resp.status_code == 200
        except httpx.RequestError:
            return False

    async def aclose(self) -> None:
        await self._client.aclose()


def _safe_detail(resp: httpx.Response) -> str:
    try:
        return resp.json().get("detail", resp.text)
    except Exception:
        return resp.text[:300]
