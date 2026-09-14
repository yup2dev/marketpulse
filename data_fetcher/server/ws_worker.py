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
토큰이 아직 없거나 거부된 동안에는 토큰 파일을 짧은 주기로 확인해, 새 토큰이 들어오는
즉시 접속한다. 접속 중 다른 계정으로 로그인하면(sub 변경) 끊고 새 계정으로 재접속한다.

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
from data_fetcher.server.auth import token_claims
from data_fetcher.server.serialize import serialize_result

log = logging.getLogger(__name__)

_RECONNECT_DELAY = 5.0
_WAIT_TOKEN_DELAY = 10.0  # 로그인 전(토큰 없음) 재확인 간격
_AUTH_FAIL_DELAY = 60.0  # 토큰 거부(401/403) 시 — 갱신 전엔 재시도해도 무의미하므로 길게 대기
_TOKEN_POLL_INTERVAL = 2.0  # 대기·접속 중 토큰 파일 변경 확인 주기 — 새 토큰을 곧바로 반영


def _ws_reject_status(exc) -> Optional[int]:
    """websockets 접속 거부 예외에서 HTTP 상태코드를 추출한다.
    websockets>=12: InvalidStatus(.response.status_code) / 이전: InvalidStatusCode(.status_code)."""
    resp = getattr(exc, "response", None)
    if resp is not None and getattr(resp, "status_code", None) is not None:
        return resp.status_code
    return getattr(exc, "status_code", None)


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


def _read_token(token_provider: Callable[[], Optional[str]]) -> str:
    return (token_provider() or "").strip()


def _token_subject(token: str) -> Optional[str]:
    claims = token_claims(token) if token else None
    return str(claims.get("sub")) if claims and claims.get("sub") else None


async def _wait_for_token_change(
    token_provider: Callable[[], Optional[str]], previous: str, timeout: float,
) -> None:
    """최대 timeout초 기다리되, 토큰 파일이 바뀌면 즉시 반환한다."""
    loop = asyncio.get_running_loop()
    deadline = loop.time() + timeout
    while (remaining := deadline - loop.time()) > 0:
        await asyncio.sleep(min(_TOKEN_POLL_INTERVAL, remaining))
        if _read_token(token_provider) != previous:
            return


async def _close_on_account_change(
    ws, token_provider: Callable[[], Optional[str]], token: str,
) -> None:
    """접속 중 토큰의 사용자(sub)가 바뀌거나 로그아웃되면 연결을 닫는다.

    같은 사용자의 토큰 갱신(주기적 refresh)은 무시한다 — 연결은 접속 시점에만 인증되므로
    끊을 이유가 없고, 끊으면 진행 중인 위임 요청이 실패한다.
    """
    subject = _token_subject(token)
    while True:
        await asyncio.sleep(_TOKEN_POLL_INTERVAL)
        current = _read_token(token_provider)
        if current != token and _token_subject(current) != subject:
            log.info("[fetcher-ws] 로그인 계정 변경 감지 — 새 토큰으로 재접속")
            await ws.close()
            return


async def run_ws_worker(
    base_url: str,
    token_provider: Callable[[], Optional[str]],
) -> None:
    """`base_url`(백엔드 /ws/fetcher)에 접속해 영구 실행되는 워커 루프.

    token_provider(): 접속 시점의 사용자 로그인 JWT를 반환(없으면 None/"").
    매 (재)접속마다 토큰을 새로 읽으므로, 갱신된 토큰이 자동 반영된다.
    """
    while True:
        token = _read_token(token_provider)
        if not token:
            # 아직 로그인 전 — 토큰이 생기면 바로 접속
            await _wait_for_token_change(token_provider, token, _WAIT_TOKEN_DELAY)
            continue

        sep = "&" if "?" in base_url else "?"
        url = f"{base_url}{sep}token={token}"
        ssl_ctx = _ssl_context() if url.startswith("wss://") else None
        watcher: Optional[asyncio.Task] = None
        try:
            async with websockets.connect(url, ssl=ssl_ctx, ping_interval=20, ping_timeout=20) as ws:
                log.info("[fetcher-ws] connected to backend")
                watcher = asyncio.create_task(_close_on_account_change(ws, token_provider, token))
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
            status = _ws_reject_status(exc)
            if status in (401, 403):
                # 토큰 만료/무효 — 같은 토큰으로 재시도해봐야 계속 거부된다. 웹 재로그인으로
                # 토큰 파일이 갱신되면 그 즉시 재접속하고, 아니면 길게 쉬며 대기한다.
                log.warning(
                    "[fetcher-ws] 인증 거부(HTTP %s) — 토큰 만료/무효. 웹에서 다시 로그인해 "
                    "Fetcher 토큰을 갱신하세요(갱신 즉시 재접속, 최대 %ds 대기)",
                    status, _AUTH_FAIL_DELAY,
                )
                await _wait_for_token_change(token_provider, token, _AUTH_FAIL_DELAY)
                continue
            log.warning("[fetcher-ws] connection error: %s — %ds 후 재시도", exc, _RECONNECT_DELAY)
        finally:
            if watcher:
                watcher.cancel()
        if _read_token(token_provider) != token:
            continue  # 계정 변경으로 닫은 연결 — 지체 없이 새 토큰으로 재접속
        await asyncio.sleep(_RECONNECT_DELAY)
