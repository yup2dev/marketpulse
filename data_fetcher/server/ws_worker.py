"""백엔드 `/ws/fetcher`에 접속해 데이터 조회(fetch) 위임을 처리하는 워커.

사용자 PC에서 실행되는 Fetcher가 이 모듈을 통해 백엔드에 outbound로 접속한다.
NAT/방화벽 뒤에서도 동작한다 — 연결을 먼저 여는 쪽이 Fetcher이기 때문이다.

흐름:
    Fetcher → wss://.../ws/fetcher?token=<로그인 JWT> 로 접속
    백엔드  → {"type": "fetch", "id", "provider", "model", "params"}
    Fetcher → QueryExecutor.fetch(...) 로컬 실행 (Class A: yahoo/whalewisdom 등 keyless 스크래핑)
    Fetcher → {"type": "fetch_result"|"fetch_error", "id", ...}

토큰은 매 접속 시점에 token_provider()로 새로 읽는다. 데스크톱 앱이 로그인/갱신 때
토큰 파일을 갱신하면, 다음 (재)접속에서 최신 토큰을 사용한다(Fetcher 재시작 불필요).
토큰이 아직 없으면(로그인 전) 접속을 보류하고 주기적으로 재확인한다.

(API 키 관리는 백엔드 DB에서 처리되므로 워커는 데이터 조회만 담당한다.)
연결이 끊기면 자동 재연결한다.
"""
from __future__ import annotations

import asyncio
import json
import logging
import ssl
from typing import Callable, Optional

import websockets

from data_fetcher.query_executor import QueryExecutor, QueryExecutorError
from data_fetcher.server.serialize import serialize_result

log = logging.getLogger(__name__)

_RECONNECT_DELAY = 5.0
_WAIT_TOKEN_DELAY = 10.0  # 로그인 전(토큰 없음) 재확인 간격


def _ssl_context() -> Optional[ssl.SSLContext]:
    """wss 검증용 SSL 컨텍스트. 소스 실행(.venv) 시 시스템 CA를 못 찾아
    CERTIFICATE_VERIFY_FAILED가 나므로 certifi 번들을 명시적으로 사용한다."""
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:  # certifi 없으면 기본 컨텍스트
        return ssl.create_default_context()


async def _handle_fetch(ws, msg: dict) -> None:
    req_id = msg.get("id")
    provider = msg.get("provider")
    model = msg.get("model")
    try:
        raw = await QueryExecutor.fetch(
            provider=provider,
            model=model,
            params=msg.get("params") or {},
            ttl=msg.get("ttl"),
        )
        envelope = serialize_result(raw)
        await ws.send(json.dumps({"type": "fetch_result", "id": req_id, **envelope}))
    except QueryExecutorError as exc:
        await ws.send(json.dumps({"type": "fetch_error", "id": req_id, "detail": str(exc)}))
    except Exception as exc:
        log.warning("[fetcher-ws] fetch failed %s:%s — %s", provider, model, exc)
        await ws.send(json.dumps({
            "type": "fetch_error", "id": req_id, "detail": f"upstream error: {exc}",
        }))


async def run_ws_worker(
    base_url: str,
    token_provider: Callable[[], Optional[str]],
) -> None:
    """`base_url`(백엔드 /ws/fetcher)에 접속해 영구 실행되는 워커 루프.

    token_provider(): 접속 시점의 사용자 로그인 JWT를 반환(없으면 None/"").
    매 (재)접속마다 토큰을 새로 읽으므로, 갱신된 토큰이 자동 반영된다.
    """
    while True:
        token = (token_provider() or "").strip()
        if not token:
            # 아직 로그인 전 — 토큰이 생길 때까지 대기 후 재확인
            await asyncio.sleep(_WAIT_TOKEN_DELAY)
            continue

        sep = "&" if "?" in base_url else "?"
        url = f"{base_url}{sep}token={token}"
        ssl_ctx = _ssl_context() if url.startswith("wss://") else None
        try:
            async with websockets.connect(url, ssl=ssl_ctx, ping_interval=20, ping_timeout=20) as ws:
                log.info("[fetcher-ws] connected to backend")
                async for raw in ws:
                    try:
                        msg = json.loads(raw)
                    except json.JSONDecodeError:
                        continue
                    if msg.get("type") == "fetch":
                        asyncio.create_task(_handle_fetch(ws, msg))
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            log.warning("[fetcher-ws] connection error: %s — %ds 후 재시도", exc, _RECONNECT_DELAY)
        await asyncio.sleep(_RECONNECT_DELAY)
