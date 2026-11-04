"""JWT token creation/validation and password hashing."""
from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.backend.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    # bcrypt supports up to 72 bytes; truncate to avoid silent mismatch
    while len(plain_password.encode("utf-8")) > 72:
        plain_password = plain_password[:-1]
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    while len(password.encode("utf-8")) > 72:
        password = password[:-1]
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_fetcher_token(data: dict) -> str:
    """사용자 PC Fetcher 워커(/ws/fetcher) 전용 장수명 토큰.

    type="fetcher"로 발급되어 워커 등록에만 쓰인다. API 인증(get_current_user)이나
    /auth/refresh는 type을 검사해 이 토큰을 거부하므로, 유출돼도 권한이 워커 한정이다.
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.FETCHER_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "fetcher"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None
