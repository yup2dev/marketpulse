"""
인증 서비스
"""
from datetime import datetime
from sqlalchemy.orm import Session
from typing import Optional
import uuid

from index_analyzer.models.orm import User
from app.backend.auth.security import verify_password, get_password_hash, create_access_token, create_refresh_token


class AuthService:
    """인증 관련 비즈니스 로직"""

    @staticmethod
    def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
        """
        사용자 인증
        """
        user = db.query(User).filter(User.email == email).first()
        if not user:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user

    @staticmethod
    def create_user(
        db: Session,
        email: str,
        username: str,
        password: str,
        full_name: Optional[str] = None
    ) -> User:
        """
        새로운 사용자 생성
        """
        # 이메일 중복 확인
        if db.query(User).filter(User.email == email).first():
            raise ValueError("Email already registered")

        # 사용자명 중복 확인
        if db.query(User).filter(User.username == username).first():
            raise ValueError("Username already taken")

        # 사용자 생성
        user = User(
            user_id=f"user_{uuid.uuid4().hex[:16]}",
            email=email,
            username=username,
            hashed_password=get_password_hash(password),
            full_name=full_name,
            is_active=True,
            is_verified=False,
            role='user'
        )

        db.add(user)
        db.commit()
        db.refresh(user)

        return user

    @staticmethod
    def update_last_login(db: Session, user: User) -> None:
        """
        마지막 로그인 시간 업데이트
        """
        user.last_login = datetime.utcnow()
        db.commit()

    @staticmethod
    def generate_tokens(user: User) -> dict:
        """
        Access Token과 Refresh Token 생성
        """
        access_token = create_access_token(data={"sub": user.user_id})
        refresh_token = create_refresh_token(data={"sub": user.user_id})

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer"
        }
