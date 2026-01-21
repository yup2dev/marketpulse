"""
인증 관련 API 엔드포인트
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional

try:
    from ...database.db_dependency import get_db
    from ...services.auth_service import AuthService
    from ...auth.dependencies import get_current_user, get_current_active_user
except ImportError:
    from database.db_dependency import get_db
    from services.auth_service import AuthService
    from auth.dependencies import get_current_user, get_current_active_user
from index_analyzer.models.database import User

router = APIRouter(prefix="/auth", tags=["Authentication"])
security = HTTPBearer()


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
    access_token: str
    refresh_token: str
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
def register(user_data: UserRegister, db: Session = Depends(get_db)):
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

        # 토큰 생성
        tokens = AuthService.generate_tokens(user)

        # 마지막 로그인 업데이트
        AuthService.update_last_login(db, user)

        return {
            **tokens,
            "user": user.to_dict()
        }

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/login", response_model=TokenResponse)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
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

    # 토큰 생성
    tokens = AuthService.generate_tokens(user)

    # 마지막 로그인 업데이트
    AuthService.update_last_login(db, user)

    return {
        **tokens,
        "user": user.to_dict()
    }


@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    """
    현재 로그인된 사용자 정보 조회
    """
    return current_user.to_dict()


@router.post("/logout")
def logout(current_user: User = Depends(get_current_active_user)):
    """
    로그아웃 (프론트엔드에서 토큰 삭제)
    """
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
