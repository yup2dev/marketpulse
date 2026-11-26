"""command 라우터 → FastAPI (OpenBB openbb_core.api.router.commands 의 add_command_map · build_api_wrapper).

app.backend.platform.Router 에 모인 command 를 APIRouter 로 만들 때 엔드포인트마다 API 래퍼를 씌운다.
래퍼가 오류를 한 곳에서 응답으로 바꾼다 — 키 미등록 424(missing_key) · Fetcher 미접속/서킷 503 ·
잘못된 값 400 · 외부 API 오류 (route_handler).
"""
from typing import Callable, Iterable, Tuple

from fastapi import FastAPI

from app.backend.platform import Router
from app.backend.api.deps import route_handler


def build_api_wrapper(endpoint: Callable) -> Callable:
    return route_handler(endpoint)


def add_command_map(app: FastAPI, routers: Iterable[Tuple[Router, str]]) -> None:
    """(Router, URL prefix) 들을 앱에 붙인다."""
    for router, prefix in routers:
        app.include_router(router.api_router(wrap=build_api_wrapper), prefix=prefix)
