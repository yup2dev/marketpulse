"""
Application settings via pydantic-settings
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_ignore_empty=True,
        extra="ignore",
        case_sensitive=False,
    )

    # App
    APP_VERSION: str = "1.0.0"
    APP_NAME: str = "MarketPulse"
    DEBUG: bool = False

    # Security
    SECRET_KEY: str = "dev-only-key-override-in-env"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS — comma-separated in env: CORS_ORIGINS=https://example.com,http://localhost:5173
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:3000",
    ]

    # Database
    SQLITE_PATH: str = "data/marketpulse.db"

    # Redis / Queue
    REDIS_URL: str = "redis://localhost:6379/0"
    QUEUE_ENABLED: bool = False
    SCHEDULER_ENABLED: bool = False

    # Fetcher(exe) 위임 — Backend가 provider를 직접 호출하지 않고 로컬 Fetcher REST로 위임
    FETCHER_REMOTE_ENABLED: bool = True              # True면 모든 조회를 Fetcher로 위임
    FETCHER_URL: str = "http://127.0.0.1:8765"        # Fetcher REST 주소
    FETCHER_TOKEN: str = ""                            # (선택) Bearer 인증 토큰
    FETCHER_TIMEOUT: float = 30.0

    # Crawler
    CRAWLER_MAX_WORKERS: int = 5
    CRAWLER_TIMEOUT: int = 30
    CRAWLER_MAX_RETRIES: int = 3
    USE_TRANSFORMERS: bool = False
    MARKET_DATA_INTERVAL_HOURS: int = 6

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "logs/app.log"

    # API Keys
    FRED_API_KEY: Optional[str] = None
    ALPHA_VANTAGE_API_KEY: Optional[str] = None
    POLYGON_API_KEY: Optional[str] = None
    FMP_API_KEY: Optional[str] = None


settings = Settings()
