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
