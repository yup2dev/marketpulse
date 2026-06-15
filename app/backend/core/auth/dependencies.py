"""FastAPI auth dependencies."""
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.backend.core.db import get_db
from app.backend.core.auth.security import decode_token
from index_analyzer.models.orm import User


class HTTPBearer401(HTTPBearer):
    """기본 HTTPBearer는 Authorization 헤더가 없으면 403을 던진다.

    프론트 apiClient는 401에서만 refresh/forceLogout를 수행하므로, 자격증명
    누락도 401로 통일해 만료·미인증이 항상 로그인 리다이렉트로 이어지게 한다.
    """

    async def __call__(self, request: Request) -> Optional[HTTPAuthorizationCredentials]:
        try:
            return await super().__call__(request)
        except HTTPException as exc:
            if exc.status_code == status.HTTP_403_FORBIDDEN:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Not authenticated",
                    headers={"WWW-Authenticate": "Bearer"},
                ) from exc
            raise


security          = HTTPBearer401()
security_optional = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_token(credentials.credentials)
    if payload is None:
        raise exc
    # API 인증은 access 토큰만 허용 — refresh/fetcher 토큰으로는 API를 호출할 수 없다.
    if payload.get("type") != "access":
        raise exc
    user_id: str = payload.get("sub")
    if user_id is None:
        raise exc
    user = db.query(User).filter(User.user_id == user_id).first()
    if user is None:
        raise exc
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is inactive")
    return user


def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


def require_admin(current_user: User = Depends(get_current_active_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    return current_user


def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_optional),
    db: Session = Depends(get_db),
) -> Optional[User]:
    if credentials is None:
        return None
    try:
        return get_current_user(credentials, db)
    except HTTPException:
        return None
