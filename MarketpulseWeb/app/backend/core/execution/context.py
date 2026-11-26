"""요청 범위 사용자 — 인증 미들웨어(auth_gate)가 넣고 실행 계층이 읽는다.

로컬 실행(fetcher target="local") 조회를 '그 사용자의 PC Fetcher' 로 위임하고, 키가 필요한 조회를 그 사용자의 키로 부를 때 쓴다.
배경 작업처럼 요청이 없으면 None — 로컬 전용 조회는 실패(RemoteUnavailableError), 키 조회는 운영자 키(env).
asyncio.to_thread · run_in_threadpool 은 contextvars 를 복사하므로 스레드로 넘어가도 값이 남는다.
"""
from contextvars import ContextVar
from typing import Optional

current_user_id: "ContextVar[Optional[str]]" = ContextVar("current_user_id", default=None)
