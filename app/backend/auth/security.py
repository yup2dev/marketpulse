"""
JWT 토큰 생성/검증 및 비밀번호 해싱
"""
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.backend.core.config import settings

# 비밀번호 해싱
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    비밀번호 검증
    bcrypt는 72바이트까지만 지원하므로 자동으로 잘라냅니다.
    """
    # Ensure password doesn't exceed bcrypt's 72-byte limit
    # Truncate character by character to avoid splitting UTF-8 sequences
    while len(plain_password.encode('utf-8')) > 72:
        plain_password = plain_password[:-1]
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """
    비밀번호 해싱
    bcrypt는 72바이트까지만 지원하므로 자동으로 잘라냅니다.
    """
    # Ensure password doesn't exceed bcrypt's 72-byte limit
    # Truncate character by character to avoid splitting UTF-8 sequences
    while len(password.encode('utf-8')) > 72:
        password = password[:-1]
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Access Token 생성
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """
    Refresh Token 생성
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> Optional[dict]:
    """
    토큰 디코딩 및 검증
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None
