"""
Application settings via pydantic-settings
"""
from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict
from typing import Annotated, List, Optional


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
    # 사용자 API 키 암호화 전용 시크릿(미지정 시 SECRET_KEY에서 파생).
    # 운영에서는 고정값으로 지정해야 SECRET_KEY 교체 시에도 기존 키 복호화가 유지된다.
    API_KEY_ENC_SECRET: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    # 사용자 PC Fetcher 워커(/ws/fetcher) 전용 장수명 토큰. 브라우저가 닫혀 있어도
    # 워커가 유지되도록 access(30분)보다 길게 둔다. API/refresh로는 쓸 수 없다(type=fetcher).
    FETCHER_TOKEN_EXPIRE_DAYS: int = 30

    # CORS — comma-separated in env: CORS_ORIGINS=https://example.com,http://localhost:5173
    CORS_ORIGINS: Annotated[List[str], NoDecode] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:3000",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _split_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    # Database
    SQLITE_PATH: str = "data/marketpulse.db"

    # Redis / Queue
    REDIS_URL: str = "redis://localhost:6379/0"
    QUEUE_ENABLED: bool = False
    SCHEDULER_ENABLED: bool = False

    # Fetcher(exe) 위임 — Backend가 provider를 직접 호출하지 않고 Fetcher로 위임
    FETCHER_REMOTE_ENABLED: bool = True              # True면 모든 조회를 Fetcher로 위임
    FETCHER_URL: str = "http://127.0.0.1:8765"        # Fetcher REST 주소 (HTTP/pull 모드)
    FETCHER_TOKEN: str = ""                            # Fetcher와 공유하는 인증 토큰
    FETCHER_TIMEOUT: float = 90.0   # batch_quotes 등 수백 종목 일괄 조회는 30s를 초과할 수 있음
    # True: 사용자 PC의 Fetcher가 /ws/fetcher 로 outbound 접속해 위임받는 워커 풀 모드(push).
    # NAT/방화벽 뒤의 PC도 동작 가능. False(기본): 위 FETCHER_URL로 직접 호출(pull, HTTP).
    FETCHER_WORKER_MODE: bool = False

    # Crawler
    CRAWLER_MAX_WORKERS: int = 5
    CRAWLER_TIMEOUT: int = 30
    CRAWLER_MAX_RETRIES: int = 3
    USE_TRANSFORMERS: bool = False
    MARKET_DATA_INTERVAL_HOURS: int = 6

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "logs/app.log"

    # Copilot (AI 어시스턴트) — 키는 'API 키 관리'(사용자별 DB)가 우선, 아래는 서버 폴백.
    ANTHROPIC_API_KEY: Optional[str] = None
    COPILOT_MODEL: str = "claude-opus-4-8"
    GEMINI_API_KEY: Optional[str] = None            # 무료 티어: aistudio.google.com
    COPILOT_GEMINI_MODEL: str = "gemini-2.5-flash"
    OPENAI_API_KEY: Optional[str] = None
    COPILOT_OPENAI_MODEL: str = "gpt-4o-mini"

    # API Keys
    FRED_API_KEY: Optional[str] = None
    ALPHA_VANTAGE_API_KEY: Optional[str] = None
    POLYGON_API_KEY: Optional[str] = None
    FMP_API_KEY: Optional[str] = None


settings = Settings()
