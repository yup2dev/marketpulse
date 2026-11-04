"""사용자별 Fetcher(WS 워커) 연결 풀.

각 사용자 PC의 Fetcher가 자신의 로그인 JWT로 `/ws/fetcher`에 outbound 접속(push)하면
백엔드가 user_id별로 워커를 등록한다. 어떤 사용자의 요청은 '그 사용자의 워커'로만
위임되어, 그 사용자의 keystore에 저장된 API 키·쿼터가 사용된다.

위임 실패 종류 구분:
  - FetcherWorkerUnavailable: 해당 사용자의 워커가 없거나 도달 불가(타임아웃·연결 끊김).
    → 호출부(QueryExecutor)가 백엔드 직접 호출로 폴백한다.
  - FetcherRemoteError: 워커가 실제로 실행했으나 실패(예: 사용자 키 미설정).
    → 폴백하지 않고 원래 오류 메시지를 그대로 전파한다.
"""
from __future__ import annotations

import asyncio
import json
import logging
import uuid
from typing import Any, Dict, List, Optional

from fastapi import WebSocket

log = logging.getLogger(__name__)


class FetcherPoolError(Exception):
    """워커 풀 위임 실패 베이스."""


class FetcherWorkerUnavailable(FetcherPoolError):
    """해당 사용자의 워커 없음 / 응답 시간 초과 / 연결 끊김 → 백엔드 폴백 대상."""


class FetcherRemoteError(FetcherPoolError):
    """워커가 실행했으나 실패(원격 실행 오류) → 폴백하지 않고 그대로 전파."""


class _Worker:
    def __init__(self, ws: WebSocket, user_id: str) -> None:
        self.ws = ws
        self.user_id = user_id
        self.pending: Dict[str, "asyncio.Future[dict]"] = {}


class FetcherWorkerPool:
    """user_id별 Fetcher WS 워커 관리 + 사용자 단위 조회 위임."""

    def __init__(self) -> None:
        self._workers: Dict[str, _Worker] = {}            # worker_id → _Worker
        self._by_user: Dict[str, List[str]] = {}          # user_id → [worker_id]
        self._rr: Dict[str, int] = {}                     # user_id → 라운드로빈 인덱스

    def register(self, ws: WebSocket, user_id: str) -> str:
        worker_id = uuid.uuid4().hex
        self._workers[worker_id] = _Worker(ws, user_id)
        self._by_user.setdefault(user_id, []).append(worker_id)
        return worker_id

    def unregister(self, worker_id: str) -> None:
        worker = self._workers.pop(worker_id, None)
        if worker is None:
            return
        ids = self._by_user.get(worker.user_id)
        if ids and worker_id in ids:
            ids.remove(worker_id)
            if not ids:
                self._by_user.pop(worker.user_id, None)
        for fut in worker.pending.values():
            if not fut.done():
                fut.set_exception(FetcherWorkerUnavailable("Fetcher 워커 연결이 끊어졌습니다"))

    def count(self) -> int:
        return len(self._workers)

    def has_worker(self, user_id: Optional[str]) -> bool:
        return bool(user_id) and bool(self._by_user.get(user_id))

    def status(self) -> List[Dict[str, Any]]:
        return [
            {"user_id": uid, "workers": len(wids)}
            for uid, wids in self._by_user.items()
        ]

    async def handle_message(self, worker_id: str, msg: dict) -> None:
        """워커가 보낸 fetch_result/fetch_error를 대기 중인 Future에 전달."""
        worker = self._workers.get(worker_id)
        if worker is None:
            return
        req_id = msg.get("id")
        fut = worker.pending.pop(req_id, None) if req_id else None
        if fut is None or fut.done():
            return
        if str(msg.get("type", "")).endswith("_error"):
            # 워커가 실행 후 보고한 오류(fetch_error / keys_error 등) → 폴백 금지, 그대로 전파
            fut.set_exception(FetcherRemoteError(msg.get("detail") or "remote error"))
        else:
            fut.set_result(msg)

    def _pick_worker(self, user_id: str) -> _Worker:
        wids = self._by_user.get(user_id) or []
        if not wids:
            raise FetcherWorkerUnavailable(
                "데이터를 조회하려면 데스크톱 앱(Fetcher)을 실행하고 로그인하세요. "
                "(Fetcher 워커 미연결)"
            )
        idx = self._rr.get(user_id, 0) % len(wids)
        self._rr[user_id] = idx + 1
        return self._workers[wids[idx]]

    async def request(
        self,
        user_id: Optional[str],
        payload: dict,
        timeout: float = 90.0,
    ) -> dict:
        """user_id의 워커에 임의 메시지를 보내고 매칭 응답을 기다린다(요청/응답).

        payload에 "id"는 자동 부여된다. fetch / keys 관리 등 모든 위임이 이를 공유한다.
        워커 없음/타임아웃/끊김 → FetcherWorkerUnavailable (폴백 대상)
        워커 실행 실패(`*_error`) → FetcherRemoteError (전파)
        """
        if not user_id:
            raise FetcherWorkerUnavailable("요청에 사용자 컨텍스트가 없습니다")

        worker = self._pick_worker(user_id)
        req_id = uuid.uuid4().hex
        fut: asyncio.Future = asyncio.get_event_loop().create_future()
        worker.pending[req_id] = fut

        try:
            await worker.ws.send_text(json.dumps({**payload, "id": req_id}))
        except Exception as exc:
            worker.pending.pop(req_id, None)
            raise FetcherWorkerUnavailable(f"워커로 요청 전송 실패: {exc}") from exc

        try:
            return await asyncio.wait_for(fut, timeout=timeout)
        except asyncio.TimeoutError as exc:
            worker.pending.pop(req_id, None)
            raise FetcherWorkerUnavailable("Fetcher 워커 응답 시간 초과") from exc

    async def fetch(
        self,
        user_id: Optional[str],
        provider: str,
        model: str,
        params: dict,
        timeout: float = 90.0,
    ) -> dict:
        """user_id의 워커에 데이터 조회를 위임한다(request의 fetch 케이스)."""
        return await self.request(
            user_id,
            {"type": "fetch", "provider": provider, "model": model, "params": params},
            timeout=timeout,
        )


fetcher_pool = FetcherWorkerPool()
