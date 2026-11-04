"""Fetcher REST 인증 토큰.

/fetch, /keys* 는 외부 provider API 키를 다루므로 토큰 없이 호출되면 안 된다.
FETCHER_TOKEN 환경변수로 지정하거나, 없으면 최초 실행 시 무작위로 생성해
로컬 설정 파일(keystore와 동일한 디렉터리)에 저장하고 재사용한다.

백엔드(app/backend)는 동일한 값을 FETCHER_TOKEN에 설정해 Authorization:
Bearer <token> 헤더로 호출한다 (FetcherClient가 이미 지원).
"""
from __future__ import annotations

import base64
import json
import os
import secrets
import time
from typing import Optional

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


def clear_user_token(expected: Optional[str] = None) -> bool:
    """로그아웃 시 토큰 파일 제거 → 워커가 접속을 보류한다.

    expected가 주어지면 저장된 토큰과 같을 때만 지운다. 오래된 탭의 강제 로그아웃이
    다른 세션이 방금 넣은 유효한 토큰까지 지워 워커를 끊는 것을 막는다.
    """
    path = _config_dir() / _USER_TOKEN_FILE
    if expected is not None and get_user_token() != expected.strip():
        return False
    try:
        path.unlink(missing_ok=True)
    except OSError:
        return False
    return True


def token_claims(token: str) -> Optional[dict]:
    """JWT payload를 서명 검증 없이 읽는다(서명 키는 백엔드만 보유).

    Fetcher는 진위를 판단할 수 없으므로, 명백히 쓸 수 없는 토큰을 거르는 데만 쓴다.
    """
    parts = (token or "").strip().split(".")
    if len(parts) != 3:
        return None
    try:
        claims = json.loads(base64.urlsafe_b64decode(parts[1] + "=" * (-len(parts[1]) % 4)))
    except ValueError:  # binascii.Error / JSONDecodeError / UnicodeDecodeError 모두 ValueError
        return None
    return claims if isinstance(claims, dict) else None


def user_token_problem(token: str) -> Optional[str]:
    """워커 접속에 쓸 수 없는 토큰이면 사유를, 쓸 만하면 None을 반환한다.

    만료·형식 오류 토큰을 저장하면 기존의 유효한 토큰을 덮어써 백엔드가 403으로
    거부한다(오래된 탭 localStorage의 토큰이 흘러드는 경우).
    """
    claims = token_claims(token)
    if claims is None:
        return "malformed token"
    if claims.get("type") not in ("fetcher", "access"):
        return f"unsupported token type: {claims.get('type')}"
    if not claims.get("sub"):
        return "token missing subject"
    exp = claims.get("exp")
    if isinstance(exp, (int, float)) and exp <= time.time():
        return "token expired"
    return None
