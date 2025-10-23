"""
Database Models - SQLAlchemy ORM
완전히 재설계된 스키마 (base_ymd 기준, 전일 종가 포함)
"""
from datetime import datetime, date
from typing import List, Optional
from sqlalchemy import (
    Column, String, Text, Integer, Float, DateTime, Date, Boolean,
    ForeignKey, Index, UniqueConstraint, create_engine
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
from sqlalchemy.dialects.postgresql import UUID
import uuid

Base = declarative_base()


# =============================================================================
# 1. Ticker Master Table (종목 마스터)
# =============================================================================
class Ticker(Base):
    """종목 마스터 테이블 - 외부 API 데이터 캐싱"""
    __tablename__ = 'tickers'

    symbol = Column(String(20), primary_key=True)  # AAPL, GC=F, BTC-USD
    name = Column(Text, nullable=False)
    exchange = Column(String(20), index=True)  # NASDAQ, NYSE, NYMEX, etc.

    # 분류
    asset_type = Column(String(20), index=True, nullable=False)  # stock, commodity, etf, crypto, index
    sector = Column(String(100), index=True)
    industry = Column(String(100))

    # 메타데이터
    currency = Column(String(10), default='USD')  # USD, EUR, etc.
    country = Column(String(50))

    # 동기화 정보
    data_source = Column(String(50))  # yfinance, wikipedia, manual
    is_active = Column(Boolean, default=True, index=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    price_history = relationship("TickerPrice", back_populates="ticker", cascade="all, delete-orphan")
    news_associations = relationship("NewsTicker", back_populates="ticker")

    # Indexes
    __table_args__ = (
        Index('idx_asset_active', 'asset_type', 'is_active'),
        Index('idx_sector_active', 'sector', 'is_active'),
    )

    def to_dict(self) -> dict:
        return {
            'symbol': self.symbol,
            'name': self.name,
            'exchange': self.exchange,
            'asset_type': self.asset_type,
            'sector': self.sector,
            'industry': self.industry,
            'currency': self.currency,
            'country': self.country,
            'is_active': self.is_active
        }


# =============================================================================
# 2. Ticker Price History (일별 가격 데이터)
# =============================================================================
class TickerPrice(Base):
    """
    일별 종목 가격 데이터
    base_ymd 기준으로 전일 종가(prev_close) 포함
    """
    __tablename__ = 'ticker_prices'

    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column(String(20), ForeignKey('tickers.symbol', ondelete='CASCADE'), nullable=False)
    base_ymd = Column(Date, nullable=False, index=True)  # 기준 날짜 (YYYY-MM-DD)

    # 가격 데이터
    open = Column(Float)
    high = Column(Float)
    low = Column(Float)
    close = Column(Float)
    prev_close = Column(Float)  # 전일 종가 (중요!)

    # 거래량
    volume = Column(Float)

    # 변동률 (자동 계산)
    change = Column(Float)  # close - prev_close
    change_pct = Column(Float)  # (close - prev_close) / prev_close * 100

    # 메타데이터
    data_source = Column(String(50), default='yfinance')
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    ticker = relationship("Ticker", back_populates="price_history")

    # Constraints
    __table_args__ = (
        UniqueConstraint('symbol', 'base_ymd', name='uq_ticker_date'),
        Index('idx_symbol_date', 'symbol', 'base_ymd'),
        Index('idx_date', 'base_ymd'),
    )

    def to_dict(self) -> dict:
        return {
            'symbol': self.symbol,
            'base_ymd': self.base_ymd.isoformat() if self.base_ymd else None,
            'open': self.open,
            'high': self.high,
            'low': self.low,
            'close': self.close,
            'prev_close': self.prev_close,
            'volume': self.volume,
            'change': self.change,
            'change_pct': self.change_pct,
            'data_source': self.data_source
        }

    def calculate_change(self):
        """변동률 자동 계산"""
        if self.close is not None and self.prev_close is not None and self.prev_close != 0:
            self.change = self.close - self.prev_close
            self.change_pct = (self.change / self.prev_close) * 100
        else:
            self.change = None
            self.change_pct = None


# =============================================================================
# 3. News Articles (뉴스 기사)
# =============================================================================
class NewsArticle(Base):
    """뉴스 기사 테이블"""
    __tablename__ = 'news_articles'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    url = Column(Text, unique=True, nullable=False, index=True)
    title = Column(Text, nullable=False)
    summary = Column(Text)
    content = Column(Text)
    source = Column(String(50), index=True)
    author = Column(String(255))

    # 날짜
    base_ymd = Column(Date, index=True)  # 기준 날짜 (published_at 기준)
    published_at = Column(DateTime, index=True)
    crawled_at = Column(DateTime, default=datetime.utcnow, index=True)

    # 감성 분석
    sentiment_score = Column(Float)  # -1.0 ~ 1.0
    sentiment_label = Column(String(20), index=True)  # positive/negative/neutral
    sentiment_confidence = Column(Float)

    # 메타데이터
    importance_score = Column(Float, index=True)  # 0.0 ~ 10.0
    category = Column(String(50), index=True)
    keywords = Column(Text)  # JSON array as string

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    tickers = relationship("NewsTicker", back_populates="article", cascade="all, delete-orphan")

    # Indexes
    __table_args__ = (
        Index('idx_base_ymd_sentiment', 'base_ymd', 'sentiment_score'),
        Index('idx_source_date', 'source', 'base_ymd'),
        Index('idx_published', 'published_at'),
    )

    def to_dict(self) -> dict:
        return {
            'id': str(self.id),
            'url': self.url,
            'title': self.title,
            'summary': self.summary,
            'content': self.content,
            'source': self.source,
            'author': self.author,
            'base_ymd': self.base_ymd.isoformat() if self.base_ymd else None,
            'published_at': self.published_at.isoformat() if self.published_at else None,
            'crawled_at': self.crawled_at.isoformat() if self.crawled_at else None,
            'sentiment': {
                'score': self.sentiment_score,
                'label': self.sentiment_label,
                'confidence': self.sentiment_confidence
            },
            'importance_score': self.importance_score,
            'category': self.category,
            'tickers': [t.to_dict() for t in self.tickers],
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


# =============================================================================
# 4. News-Ticker Association (뉴스-종목 관계)
# =============================================================================
class NewsTicker(Base):
    """뉴스-티커 관계 테이블"""
    __tablename__ = 'news_tickers'

    id = Column(Integer, primary_key=True, autoincrement=True)
    news_id = Column(UUID(as_uuid=True), ForeignKey('news_articles.id', ondelete='CASCADE'), nullable=False)
    ticker_symbol = Column(String(20), ForeignKey('tickers.symbol', ondelete='CASCADE'), nullable=False)

    # 추출 정보
    confidence = Column(Float)  # 0.0 ~ 1.0
    mention_count = Column(Integer)  # 기사 내 언급 횟수
    context_sentiment = Column(Float)  # 해당 티커에 대한 감성

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    article = relationship("NewsArticle", back_populates="tickers")
    ticker = relationship("Ticker", back_populates="news_associations")

    # Constraints
    __table_args__ = (
        UniqueConstraint('news_id', 'ticker_symbol', name='uq_news_ticker'),
        Index('idx_ticker_created', 'ticker_symbol', 'created_at'),
        Index('idx_news_created', 'news_id', 'created_at'),
    )

    def to_dict(self) -> dict:
        return {
            'symbol': self.ticker_symbol,
            'name': self.ticker.name if self.ticker else '',
            'exchange': self.ticker.exchange if self.ticker else '',
            'confidence': self.confidence,
            'mention_count': self.mention_count,
            'context_sentiment': self.context_sentiment
        }


# =============================================================================
# 5. Market Summary (시장 요약 - 일별)
# =============================================================================
class MarketSummary(Base):
    """
    일별 시장 요약 통계
    base_ymd 기준으로 주요 지표 집계
    """
    __tablename__ = 'market_summary'

    id = Column(Integer, primary_key=True, autoincrement=True)
    base_ymd = Column(Date, unique=True, nullable=False, index=True)

    # 뉴스 통계
    news_count = Column(Integer, default=0)
    positive_news_count = Column(Integer, default=0)
    negative_news_count = Column(Integer, default=0)
    neutral_news_count = Column(Integer, default=0)
    avg_sentiment = Column(Float)

    # 종목 통계
    active_tickers_count = Column(Integer, default=0)
    trending_ticker_symbol = Column(String(20))  # 가장 많이 언급된 종목
    trending_ticker_mentions = Column(Integer, default=0)

    # 시장 지표 (S&P 500, NASDAQ 등)
    sp500_close = Column(Float)
    sp500_change_pct = Column(Float)
    nasdaq_close = Column(Float)
    nasdaq_change_pct = Column(Float)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self) -> dict:
        return {
            'base_ymd': self.base_ymd.isoformat() if self.base_ymd else None,
            'news_stats': {
                'total': self.news_count,
                'positive': self.positive_news_count,
                'negative': self.negative_news_count,
                'neutral': self.neutral_news_count,
                'avg_sentiment': self.avg_sentiment
            },
            'ticker_stats': {
                'active_count': self.active_tickers_count,
                'trending': {
                    'symbol': self.trending_ticker_symbol,
                    'mentions': self.trending_ticker_mentions
                }
            },
            'market_indices': {
                'sp500': {
                    'close': self.sp500_close,
                    'change_pct': self.sp500_change_pct
                },
                'nasdaq': {
                    'close': self.nasdaq_close,
                    'change_pct': self.nasdaq_change_pct
                }
            }
        }


# =============================================================================
# Database Session 설정
# =============================================================================
class Database:
    """데이터베이스 관리 클래스"""

    def __init__(self, database_url: str):
        # SQLite는 pool_size, max_overflow 지원 안함
        if database_url.startswith('sqlite'):
            self.engine = create_engine(
                database_url,
                echo=False,
                connect_args={'check_same_thread': False}
            )
        else:
            # PostgreSQL, MySQL 등
            self.engine = create_engine(
                database_url,
                echo=False,
                pool_size=10,
                max_overflow=20
            )
        self.SessionLocal = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=self.engine
        )

    def create_tables(self):
        """테이블 생성"""
        Base.metadata.create_all(bind=self.engine)

    def drop_tables(self):
        """테이블 삭제 (주의!)"""
        Base.metadata.drop_all(bind=self.engine)

    def get_session(self):
        """세션 생성"""
        return self.SessionLocal()


# SQLite용 간단한 설정 (개발/테스트용)
def get_sqlite_db(db_path: str = "marketpulse.db"):
    """SQLite 데이터베이스 생성"""
    return Database(f"sqlite:///{db_path}")


# PostgreSQL용 설정 (프로덕션용)
def get_postgresql_db(
    host: str = "localhost",
    port: int = 5432,
    database: str = "marketpulse",
    user: str = "postgres",
    password: str = "password"
):
    """PostgreSQL 데이터베이스 생성"""
    url = f"postgresql://{user}:{password}@{host}:{port}/{database}"
    return Database(url)
