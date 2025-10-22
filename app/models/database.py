"""
Database Models - SQLAlchemy ORM
"""
from datetime import datetime
from typing import List, Optional
from sqlalchemy import (
    Column, String, Text, Integer, Float, DateTime,
    ForeignKey, Index, UniqueConstraint, create_engine
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
from sqlalchemy.dialects.postgresql import UUID
import uuid

Base = declarative_base()


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
        Index('idx_published_sentiment', 'published_at', 'sentiment_score'),
        Index('idx_source_published', 'source', 'published_at'),
    )

    def to_dict(self) -> dict:
        """딕셔너리로 변환"""
        return {
            'id': str(self.id),
            'url': self.url,
            'title': self.title,
            'summary': self.summary,
            'content': self.content,
            'source': self.source,
            'author': self.author,
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


class Ticker(Base):
    """종목 티커 마스터 테이블"""
    __tablename__ = 'tickers'

    symbol = Column(String(10), primary_key=True)
    name = Column(Text, nullable=False)
    exchange = Column(String(20), index=True)  # NASDAQ, NYSE, etc.
    sector = Column(String(50), index=True)
    industry = Column(String(100))
    market_cap = Column(Float)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    news_associations = relationship("NewsTicker", back_populates="ticker")

    def to_dict(self) -> dict:
        return {
            'symbol': self.symbol,
            'name': self.name,
            'exchange': self.exchange,
            'sector': self.sector,
            'industry': self.industry,
            'market_cap': self.market_cap
        }


class NewsTicker(Base):
    """뉴스-티커 관계 테이블"""
    __tablename__ = 'news_tickers'

    id = Column(Integer, primary_key=True, autoincrement=True)
    news_id = Column(UUID(as_uuid=True), ForeignKey('news_articles.id', ondelete='CASCADE'), nullable=False)
    ticker_symbol = Column(String(10), ForeignKey('tickers.symbol', ondelete='CASCADE'), nullable=False)

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


# Database Session 설정
class Database:
    """데이터베이스 관리 클래스"""

    def __init__(self, database_url: str):
        # SQLite는 pool_size, max_overflow 지원 안함
        connect_args = {}
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
