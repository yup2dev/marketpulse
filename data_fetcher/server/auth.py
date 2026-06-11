"""Fetcher REST 인증 토큰.

/fetch, /keys* 는 외부 provider API 키를 다루므로 토큰 없이 호출되면 안 된다.
FETCHER_TOKEN 환경변수로 지정하거나, 없으면 최초 실행 시 무작위로 생성해
로컬 설정 파일(keystore와 동일한 디렉터리)에 저장하고 재사용한다.

백엔드(app/backend)는 동일한 값을 FETCHER_TOKEN에 설정해 Authorization:
Bearer <token> 헤더로 호출한다 (FetcherClient가 이미 지원).
"""
from __future__ import annotations

import os
import secrets

from data_fetcher.server.keystore import _config_dir

_TOKEN_FILE = "token"
_USER_TOKEN_FILE = "user_token"  # 데스크톱 앱이 로그인 JWT를 기록 → 워커가 읽어 /ws/fetcher 접속


def get_or_create_token() -> str:
    env_token = os.getenv("FETCHER_TOKEN", "").strip()
    if env_token:
        return env_token

    path = _config_dir() / _TOKEN_FILE
    if path.exists():
        token = path.read_text(encoding="utf-8").strip()
        if token:
            return token

    token = secrets.token_urlsafe(32)
    path.write_text(token, encoding="utf-8")
    try:
        os.chmod(path, 0o600)  # 소유자만 읽기/쓰기 (POSIX)
    except OSError:
        pass
    return token


def get_user_token() -> str:
    """워커 풀 접속에 쓸 사용자 로그인 JWT.

    우선순위: FETCHER_USER_TOKEN 환경변수 → 토큰 파일(앱/웹이 로그인 시 기록).
    없으면 빈 문자열(아직 로그인 안 함 → 워커는 대기).
    """
    env_token = os.getenv("FETCHER_USER_TOKEN", "").strip()
    if env_token:
        return env_token

    path = _config_dir() / _USER_TOKEN_FILE
    if path.exists():
        try:
            return path.read_text(encoding="utf-8").strip()
        except OSError:
            return ""
    return ""


def write_user_token(token: str) -> None:
    """로그인 JWT를 토큰 파일에 기록(소유자 전용 600). 웹/데스크톱 공용."""
    path = _config_dir() / _USER_TOKEN_FILE
    path.write_text(token.strip(), encoding="utf-8")
    try:
        os.chmod(path, 0o600)
    except OSError:
        pass


def clear_user_token() -> None:
    """로그아웃 시 토큰 파일 제거 → 워커가 접속을 보류한다."""
    path = _config_dir() / _USER_TOKEN_FILE
    try:
        path.unlink(missing_ok=True)
    except OSError:
        pass
