"""사용자 API 키 대칭 암호화 (Fernet).

키 저장은 평문이 아니라 Fernet 암호문으로 한다. 암호화 키는 설정의 별도 시크릿
(API_KEY_ENC_SECRET)에서, 없으면 SECRET_KEY에서 파생한다. SECRET_KEY가 바뀌면
기존 암호문은 복호화 불가가 되므로 운영 시 API_KEY_ENC_SECRET를 고정 지정하는 것을 권장.
"""
from __future__ import annotations

import base64
import hashlib
import logging

from cryptography.fernet import Fernet, InvalidToken

from app.backend.core.config import settings

log = logging.getLogger(__name__)


def _fernet() -> Fernet:
    secret = (getattr(settings, "API_KEY_ENC_SECRET", "") or settings.SECRET_KEY).encode("utf-8")
    # Fernet 키는 32바이트 urlsafe-base64 — SECRET에서 SHA-256으로 파생
    key = base64.urlsafe_b64encode(hashlib.sha256(secret).digest())
    return Fernet(key)


def encrypt(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode("utf-8")).decode("ascii")


def decrypt(token: str) -> str:
    try:
        return _fernet().decrypt(token.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError) as exc:
        raise ValueError("API 키 복호화 실패 (암호화 시크릿이 바뀌었을 수 있음)") from exc
