"""PC Fetcher ↔ 웹 서버 WebSocket 메시지 계약 — 양쪽이 이 모듈 하나를 쓴다 (웹은 Web → Fetcher 방향으로 import).

    hello         PC → 서버   접속 직후 첫 메시지. 이 PC Fetcher 가 무엇을 실행할 수 있는지 알린다.
                              {"type", "fetcher_version", "protocol_version", "fetchers": [[provider, model], ...]}
    fetch         서버 → PC   {"type", "id", "provider", "model", "params"}  — 자격증명은 싣지 않는다
    fetch_result  PC → 서버   {"type", "id", "data", "metadata"}            — data 는 model_dump(mode="json") 행
    fetch_error   PC → 서버   {"type", "id", "detail"}

protocol_version 은 메시지 모양이 바뀔 때만 올린다. 서버는 버전이 다른 워커, hello 의 fetchers 에 없는
(provider, model) 에는 위임하지 않는다 (exe 업데이트 안내).
"""
from __future__ import annotations

from typing import Any, Dict, List, Tuple

PROTOCOL_VERSION = 1

HELLO = "hello"
FETCH = "fetch"
FETCH_RESULT = "fetch_result"
FETCH_ERROR = "fetch_error"


def hello_message() -> Dict[str, Any]:
    """이 PC Fetcher 의 hello — 버전과 실행할 수 있는 (provider, model)(target="local" fetcher)."""
    from data_fetcher import __version__
    from data_fetcher.server.runner import local_fetchers

    return {
        "type": HELLO,
        "fetcher_version": __version__,
        "protocol_version": PROTOCOL_VERSION,
        "fetchers": [list(pair) for pair in local_fetchers()],
    }


def parse_hello(msg: Dict[str, Any]) -> Tuple[str, int, List[Tuple[str, str]]]:
    """hello → (fetcher_version, protocol_version, [(provider, model)]). 모양이 틀리면 ValueError."""
    if msg.get("type") != HELLO:
        raise ValueError("not a hello message")
    pairs = [(str(p), str(m)) for p, m in (msg.get("fetchers") or [])]
    return str(msg.get("fetcher_version") or ""), int(msg.get("protocol_version") or 0), pairs
