"""
인증 관련 API 엔드포인트

refresh token 은 **응답 본문이 아니라 httpOnly 쿠키**로 내린다. localStorage 에 두면
XSS 한 건으로 장기 세션(7일)이 통째로 탈취된다. access token(30분)만 본문으로 주고
프론트는 그것을 메모리에 들고 있는다.

구 프론트·기존 로그인 사용자를 위해 `/refresh` 는 당분간 본문의 refresh_token 도
받는다(쿠키 우선). 이 경로는 전환이 끝나면 제거한다.
"""
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional

from app.backend.core.config import settings
from app.backend.core.db import get_db
from app.backend.services.auth_service import AuthService
from app.backend.core.auth.dependencies import get_current_user, get_current_active_user
from index_analyzer.models.orm import User

router = APIRouter(prefix="/auth", tags=["Authentication"])
security = HTTPBearer()


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    """refresh token 을 httpOnly 쿠키로 내린다. 속성은 배포처에 따라 설정으로 조정한다."""
    response.set_cookie(
        key=settings.AUTH_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=settings.auth_cookie_secure,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        domain=settings.AUTH_COOKIE_DOMAIN,
        # refresh 이외의 요청에 실려 나가지 않도록 경로를 좁힌다.
        path="/api/auth",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600,
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.AUTH_COOKIE_NAME,
        domain=settings.AUTH_COOKIE_DOMAIN,
        path="/api/auth",
    )


def _issue(response: Response, user, db) -> dict:
    """토큰 발급 공통 경로 — refresh 는 쿠키로, 나머지는 본문으로."""
    tokens = AuthService.generate_tokens(user)
    _set_refresh_cookie(response, tokens["refresh_token"])
    AuthService.update_last_login(db, user)
    return {
        "access_token": tokens["access_token"],
        # Fetcher 워커 토큰은 로컬 Fetcher(loopback)에 전달해야 해서 JS 가 읽어야 한다 —
        # httpOnly 로 옮길 수 없다. 수명 단축은 '브라우저를 닫아도 워커 유지' 설계와
        # 충돌하므로 별도 판단이 필요하다.
        "fetcher_token": tokens["fetcher_token"],
        "token_type": tokens.get("token_type", "bearer"),
        "user": user.to_dict(),
    }


# Request/Response Models
class UserRegister(BaseModel):
    email: EmailStr
    username: str
    password: str
    full_name: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """refresh_token 은 본문에 넣지 않는다 — httpOnly 쿠키로 내려간다."""
    access_token: str
    fetcher_token: str
    token_type: str
    user: dict


class UserResponse(BaseModel):
    user_id: str
    email: str
    username: str
    full_name: Optional[str]
    is_active: bool
    is_verified: bool
    role: str
    created_at: str
    last_login: Optional[str]


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(user_data: UserRegister, response: Response, db: Session = Depends(get_db)):
    """
    새로운 사용자 등록
    """
    try:
        # 사용자 생성
        user = AuthService.create_user(
            db=db,
            email=user_data.email,
            username=user_data.username,
            password=user_data.password,
            full_name=user_data.full_name
        )

        return _issue(response, user, db)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/login", response_model=TokenResponse)
def login(credentials: UserLogin, response: Response, db: Session = Depends(get_db)):
    """
    로그인
    """
    # 사용자 인증
    user = AuthService.authenticate_user(
        db=db,
        email=credentials.email,
        password=credentials.password
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )

    return _issue(response, user, db)


@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    """
    현재 로그인된 사용자 정보 조회
    """
    return current_user.to_dict()


@router.post("/logout")
def logout(response: Response, current_user: User = Depends(get_current_active_user)):
    """
    로그아웃 — refresh 쿠키를 만료시킨다(access 토큰은 프론트가 메모리에서 버린다).
    """
    _clear_refresh_cookie(response)
    return {"message": "Successfully logged out"}


@router.get("/verify-token")
def verify_token(current_user: User = Depends(get_current_active_user)):
    """
    토큰 검증
    """
    return {
        "valid": True,
        "user": current_user.to_dict()
    }


class RefreshRequest(BaseModel):
    # 쿠키가 우선이다. 이 필드는 전환기 호환용 — 구 프론트와, localStorage 에
    # 예전 refresh token 을 들고 있는 기존 사용자가 쿠키로 갈아탈 수 있게 한다.
    refresh_token: Optional[str] = None


@router.post("/refresh")
def refresh_access_token(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    data: Optional[RefreshRequest] = None,
):
    """
    Refresh token으로 새 Access token 발급.
    프론트엔드 401 인터셉터에서 자동으로 호출됨.

    토큰은 httpOnly 쿠키에서 읽는다. 쿠키가 없으면 본문을 본다 — 전환기 호환 경로다
    (구 프론트, 그리고 localStorage 에 예전 토큰을 들고 있는 기존 사용자).
    어느 경로로 들어왔든 새 refresh token 은 쿠키로만 내려간다.
    """
    from app.backend.core.auth.security import decode_token

    token = request.cookies.get(settings.AUTH_COOKIE_NAME) or (data.refresh_token if data else None)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="refresh token이 없습니다")

    payload = decode_token(token)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="만료되거나 유효하지 않은 refresh token")

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="잘못된 token 타입")

    user_id: str = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    user = db.query(User).filter(User.user_id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="사용자를 찾을 수 없거나 비활성 계정")

    return _issue(response, user, db)
