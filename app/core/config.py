"""
Configuration Management
환경 변수 및 애플리케이션 설정 관리
"""
import os
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """애플리케이션 설정"""

    # ===== Application =====
    APP_NAME: str = "MarketPulse"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = Field(default=True, description="디버그 모드")

    # ===== API Server =====
    API_HOST: str = Field(default="0.0.0.0", description="API 서버 호스트")
    API_PORT: int = Field(default=8000, description="API 서버 포트")

    # ===== Database =====
    DATABASE_URL: Optional[str] = Field(
        default=None,
        description="PostgreSQL 연결 문자열 (예: postgresql://user:pass@localhost:5432/db)"
    )
    DB_POOL_SIZE: int = Field(default=5, description="DB 연결 풀 크기")
    DB_MAX_OVERFLOW: int = Field(default=10, description="DB 연결 최대 오버플로우")

    # SQLite (개발용 폴백)
    SQLITE_PATH: str = Field(
        default=str(Path(__file__).parent.parent.parent / "data" / "marketpulse.db"),
        description="SQLite 데이터베이스 경로"
    )

    # ===== Redis =====
    REDIS_URL: Optional[str] = Field(
        default=None,
        description="Redis 연결 문자열 (예: redis://:password@localhost:6379/0)"
    )
    REDIS_HOST: str = Field(default="localhost", description="Redis 호스트")
    REDIS_PORT: int = Field(default=6379, description="Redis 포트")
    REDIS_PASSWORD: Optional[str] = Field(default=None, description="Redis 비밀번호")
    REDIS_DB: int = Field(default=0, description="Redis DB 번호")

    # ===== Message Queue =====
    QUEUE_ENABLED: bool = Field(default=True, description="Redis Queue Consumer 활성화")
    REDIS_QUEUE_NAME: str = Field(default="marketpulse:commands", description="Redis Queue 이름 (Spring → Python)")

    # ===== Redis Channels =====
    REDIS_STATUS_CHANNEL: str = Field(default="marketpulse:status", description="상태 Pub/Sub 채널 (Python → Spring)")
    REDIS_STREAM_ARTICLES: str = Field(default="stream:new_articles", description="신규 기사 Stream (Crawler → Analyzer)")

    # ===== Scheduler Settings =====
    SCHEDULER_ENABLED: bool = Field(default=True, description="스케줄러 활성화 여부")
    MARKET_DATA_INTERVAL_HOURS: int = Field(default=6, description="시장 데이터 동기화 주기 (시간)")
    CRAWL_INTERVAL_HOURS: int = Field(default=1, description="크롤링 주기 (시간)")
    SENTIMENT_INTERVAL_HOURS: int = Field(default=2, description="감성 분석 주기 (시간) - 레거시")

    # ===== API Keys =====
    OPENAI_API_KEY: Optional[str] = Field(default=None, description="OpenAI API 키")

    # ===== Crawler Settings =====
    CRAWLER_MAX_WORKERS: int = Field(default=5, description="크롤러 최대 워커 수")
    CRAWLER_TIMEOUT: int = Field(default=30, description="HTTP 요청 타임아웃 (초)")
    CRAWLER_MAX_RETRIES: int = Field(default=3, description="최대 재시도 횟수")

    # ===== NLP/ML Settings =====
    USE_TRANSFORMERS: bool = Field(default=False, description="Transformers (FinBERT) 사용 여부")
    MODEL_CACHE_DIR: Optional[str] = Field(
        default=str(Path(__file__).parent.parent.parent / "models"),
        description="ML 모델 캐시 디렉토리"
    )

    # ===== Summarization Settings =====
    SUMMARIZATION_MODEL: str = Field(
        default="sshleifer/distilbart-cnn-12-6",
        description="요약 모델 (distilbart-cnn-12-6, facebook/bart-large-cnn, t5-small, eenzeenee/t5-base-korean-summarization)"
    )
    SUMMARY_MAX_LENGTH: int = Field(default=150, description="요약 최대 길이 (토큰)")
    SUMMARY_MIN_LENGTH: int = Field(default=50, description="요약 최소 길이 (토큰)")

    # ===== Logging =====
    LOG_LEVEL: str = Field(default="INFO", description="로그 레벨")
    LOG_FILE: str = Field(
        default=str(Path(__file__).parent.parent.parent / "logs" / "app.log"),
        description="로그 파일 경로"
    )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True

    @property
    def db_url(self) -> str:
        """데이터베이스 URL 반환 (PostgreSQL > SQLite)"""
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return f"sqlite:///{self.SQLITE_PATH}"

    @property
    def redis_url_computed(self) -> Optional[str]:
        """Redis URL 계산 (명시적 URL > 개별 설정)"""
        if self.REDIS_URL:
            return self.REDIS_URL

        if self.REDIS_PASSWORD:
            return f"redis://:{self.REDIS_PASSWORD}@{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    def is_postgres(self) -> bool:
        """PostgreSQL 사용 여부"""
        return self.db_url.startswith("postgresql")

    def is_sqlite(self) -> bool:
        """SQLite 사용 여부"""
        return self.db_url.startswith("sqlite")


# ===== Global Settings Instance =====
settings = Settings()


def get_settings() -> Settings:
    """설정 인스턴스 반환 (FastAPI Depends용)"""
    return settings


# ===== Ensure directories exist =====
def ensure_directories():
    """필요한 디렉토리 생성"""
    Path(settings.SQLITE_PATH).parent.mkdir(parents=True, exist_ok=True)
    Path(settings.LOG_FILE).parent.mkdir(parents=True, exist_ok=True)
    if settings.MODEL_CACHE_DIR:
        Path(settings.MODEL_CACHE_DIR).mkdir(parents=True, exist_ok=True)


ensure_directories()
