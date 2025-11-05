"""
Database Models - MBS Schema (README ERD 기준)
데이터 흐름: IN (입수) → PROC (가공) → CALC (계산) → RCMD (추천)

명명 규칙:
- MBS_IN_{}   : 입수 (크롤러)
- MBS_PROC_{} : 가공 (ML/요약)
- MBS_CALC_{} : 계산 (메트릭)
- MBS_RCMD_{} : 추천 (결과)
"""
from datetime import datetime, date
from typing import List, Optional
from sqlalchemy import (
    Column, String, Text, Integer, Float, DateTime, Date, Boolean,
    ForeignKey, Index, UniqueConstraint, create_engine, DECIMAL
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
from sqlalchemy.dialects.postgresql import UUID
import uuid

Base = declarative_base()


# =============================================================================
# IN Layer: 입수 (크롤러가 넣는 원본 데이터)
# =============================================================================

class MBS_IN_ARTICLE(Base):
    """
    입수 - 뉴스 기사 원본
    크롤러가 수집한 raw 데이터
    """
    __tablename__ = 'mbs_in_article'

    news_id = Column(String(50), primary_key=True)
    base_ymd = Column(Date, nullable=False, index=True)
    source_cd = Column(String(50), nullable=False, index=True)  # 출판사/뉴스 출처
    title = Column(Text, nullable=False)
    content = Column(Text)
    publish_dt = Column(DateTime, index=True)
    ingest_batch_id = Column(String(50), index=True)  # 동일 입수 배치 식별자

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    processed_articles = relationship("MBS_PROC_ARTICLE", back_populates="source_article")

    __table_args__ = (
        Index('idx_in_article_base_ymd', 'base_ymd'),
        Index('idx_in_article_source', 'source_cd', 'base_ymd'),
        Index('idx_in_article_batch', 'ingest_batch_id'),
    )

    def to_dict(self) -> dict:
        return {
            'news_id': self.news_id,
            'base_ymd': self.base_ymd.isoformat() if self.base_ymd else None,
            'source_cd': self.source_cd,
            'title': self.title,
            'content': self.content,
            'publish_dt': self.publish_dt.isoformat() if self.publish_dt else None,
            'ingest_batch_id': self.ingest_batch_id
        }


class MBS_IN_STK_STBD(Base):
    """
    입수 - 주식 상태판
    크롤러가 수집한 주식 가격 데이터
    """
    __tablename__ = 'mbs_in_stk_stbd'

    id = Column(Integer, primary_key=True, autoincrement=True)
    stk_cd = Column(String(20), nullable=False, index=True)
    stk_nm = Column(String(100))
    sector = Column(String(100), index=True)
    curr = Column(String(10), default='USD')
    close_price = Column(DECIMAL(20, 4))
    change_rate = Column(DECIMAL(10, 4))
    base_ymd = Column(Date, nullable=False, index=True)
    ingest_batch_id = Column(String(50), index=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('stk_cd', 'base_ymd', name='uq_stk_date'),
        Index('idx_in_stk_base_ymd', 'base_ymd'),
        Index('idx_in_stk_cd_date', 'stk_cd', 'base_ymd'),
    )

    def to_dict(self) -> dict:
        return {
            'stk_cd': self.stk_cd,
            'stk_nm': self.stk_nm,
            'sector': self.sector,
            'curr': self.curr,
            'close_price': float(self.close_price) if self.close_price else None,
            'change_rate': float(self.change_rate) if self.change_rate else None,
            'base_ymd': self.base_ymd.isoformat() if self.base_ymd else None
        }


class MBS_IN_ETF_STBD(Base):
    """
    입수 - ETF 상태판
    크롤러가 수집한 ETF 가격 데이터
    """
    __tablename__ = 'mbs_in_etf_stbd'

    id = Column(Integer, primary_key=True, autoincrement=True)
    etf_cd = Column(String(20), nullable=False, index=True)
    etf_nm = Column(String(100))
    sector = Column(String(100), index=True)
    curr = Column(String(10), default='USD')
    close_price = Column(DECIMAL(20, 4))
    change_rate = Column(DECIMAL(10, 4))
    base_ymd = Column(Date, nullable=False, index=True)
    ingest_batch_id = Column(String(50), index=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('etf_cd', 'base_ymd', name='uq_etf_date'),
        Index('idx_in_etf_base_ymd', 'base_ymd'),
        Index('idx_in_etf_cd_date', 'etf_cd', 'base_ymd'),
    )

    def to_dict(self) -> dict:
        return {
            'etf_cd': self.etf_cd,
            'etf_nm': self.etf_nm,
            'sector': self.sector,
            'curr': self.curr,
            'close_price': float(self.close_price) if self.close_price else None,
            'change_rate': float(self.change_rate) if self.change_rate else None,
            'base_ymd': self.base_ymd.isoformat() if self.base_ymd else None
        }


# =============================================================================
# PROC Layer: 가공 (ML/요약 처리)
# =============================================================================

class MBS_PROC_ARTICLE(Base):
    """
    가공 - 기사 분석 결과
    ML을 통한 요약, 감성분석, 종목 매칭 결과
    """
    __tablename__ = 'mbs_proc_article'

    proc_id = Column(String(50), primary_key=True)
    news_id = Column(String(50), ForeignKey('mbs_in_article.news_id'), nullable=False, index=True)
    stk_cd = Column(String(20), index=True)  # 매칭된 종목 코드

    summary_text = Column(Text)  # ML 요약
    match_score = Column(DECIMAL(10, 4))  # 기사-종목 연관도 (0-1)
    price_impact = Column(DECIMAL(10, 4))  # 기사에 따른 가격 영향도
    sentiment_score = Column(DECIMAL(10, 4))  # 감성 점수 (-1 ~ 1)
    price = Column(DECIMAL(20, 4))  # 기사 시점 가격

    base_ymd = Column(Date, nullable=False, index=True)
    source_batch_id = Column(String(50), index=True)  # MBS_IN의 INGEST_BATCH_ID 참조

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    source_article = relationship("MBS_IN_ARTICLE", back_populates="processed_articles")
    calc_metrics = relationship("MBS_CALC_METRIC", back_populates="source_proc")

    __table_args__ = (
        Index('idx_proc_base_ymd', 'base_ymd'),
        Index('idx_proc_news_id', 'news_id'),
        Index('idx_proc_stk_cd', 'stk_cd', 'base_ymd'),
        Index('idx_proc_sentiment', 'sentiment_score', 'base_ymd'),
    )

    def to_dict(self) -> dict:
        return {
            'proc_id': self.proc_id,
            'news_id': self.news_id,
            'stk_cd': self.stk_cd,
            'summary_text': self.summary_text,
            'match_score': float(self.match_score) if self.match_score else None,
            'price_impact': float(self.price_impact) if self.price_impact else None,
            'sentiment_score': float(self.sentiment_score) if self.sentiment_score else None,
            'price': float(self.price) if self.price else None,
            'base_ymd': self.base_ymd.isoformat() if self.base_ymd else None
        }


# =============================================================================
# CALC Layer: 계산 (메트릭 계산)
# =============================================================================

class MBS_CALC_METRIC(Base):
    """
    계산 - 메트릭 계산 결과
    RISK, DELTA, VEGA 등의 계산된 메트릭
    """
    __tablename__ = 'mbs_calc_metric'

    calc_id = Column(String(50), primary_key=True)
    stk_cd = Column(String(20), nullable=False, index=True)
    base_ymd = Column(Date, nullable=False, index=True)

    metric_type = Column(String(20), nullable=False, index=True)  # RISK / DELTA / VEGA / IV / BETA
    metric_val = Column(DECIMAL(20, 8))  # 메트릭 값

    source_proc_id = Column(String(50), ForeignKey('mbs_proc_article.proc_id'), index=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    source_proc = relationship("MBS_PROC_ARTICLE", back_populates="calc_metrics")
    recommendations = relationship("MBS_RCMD_RESULT", back_populates="source_calc")

    __table_args__ = (
        Index('idx_calc_base_ymd', 'base_ymd'),
        Index('idx_calc_stk_cd', 'stk_cd', 'base_ymd'),
        Index('idx_calc_metric_type', 'metric_type', 'base_ymd'),
        Index('idx_calc_source_proc', 'source_proc_id'),
    )

    def to_dict(self) -> dict:
        return {
            'calc_id': self.calc_id,
            'stk_cd': self.stk_cd,
            'base_ymd': self.base_ymd.isoformat() if self.base_ymd else None,
            'metric_type': self.metric_type,
            'metric_val': float(self.metric_val) if self.metric_val else None,
            'source_proc_id': self.source_proc_id
        }


# =============================================================================
# RCMD Layer: 추천 / 결과 (Spring에서 사용)
# =============================================================================

class MBS_RCMD_RESULT(Base):
    """
    추천 - 추천 결과
    NEWS / STOCK / PORTFOLIO 추천 결과
    """
    __tablename__ = 'mbs_rcmd_result'

    rcmd_id = Column(String(50), primary_key=True)

    # 참조 (nullable, 추천 타입에 따라 다름)
    ref_news_id = Column(String(50), ForeignKey('mbs_in_article.news_id'), index=True)
    ref_stk_cd = Column(String(20), index=True)
    ref_calc_id = Column(String(50), ForeignKey('mbs_calc_metric.calc_id'), index=True)

    rcmd_type = Column(String(20), nullable=False, index=True)  # NEWS / STOCK / PORTFOLIO
    score = Column(DECIMAL(10, 4))  # 추천 점수
    reason = Column(Text)  # 추천 이유

    base_ymd = Column(Date, nullable=False, index=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    source_calc = relationship("MBS_CALC_METRIC", back_populates="recommendations", foreign_keys=[ref_calc_id])

    __table_args__ = (
        Index('idx_rcmd_base_ymd', 'base_ymd'),
        Index('idx_rcmd_type', 'rcmd_type', 'base_ymd'),
        Index('idx_rcmd_stk_cd', 'ref_stk_cd', 'base_ymd'),
        Index('idx_rcmd_score', 'score', 'base_ymd'),
    )

    def to_dict(self) -> dict:
        return {
            'rcmd_id': self.rcmd_id,
            'ref_news_id': self.ref_news_id,
            'ref_stk_cd': self.ref_stk_cd,
            'rcmd_type': self.rcmd_type,
            'score': float(self.score) if self.score else None,
            'reason': self.reason,
            'base_ymd': self.base_ymd.isoformat() if self.base_ymd else None
        }


# =============================================================================
# Legacy Tables (기존 테이블 - 호환성 유지, 향후 마이그레이션 예정)
# =============================================================================

class Ticker(Base):
    """종목 마스터 테이블 - 외부 API 데이터 캐싱"""
    __tablename__ = 'tickers'

    symbol = Column(String(20), primary_key=True)
    name = Column(Text, nullable=False)
    exchange = Column(String(20), index=True)
    asset_type = Column(String(20), index=True, nullable=False)
    sector = Column(String(100), index=True)
    industry = Column(String(100))
    currency = Column(String(10), default='USD')
    country = Column(String(50))
    data_source = Column(String(50))
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    price_history = relationship("TickerPrice", back_populates="ticker", cascade="all, delete-orphan")

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


class TickerPrice(Base):
    """일별 종목 가격 데이터"""
    __tablename__ = 'ticker_prices'

    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column(String(20), ForeignKey('tickers.symbol', ondelete='CASCADE'), nullable=False)
    base_ymd = Column(Date, nullable=False, index=True)
    open = Column(Float)
    high = Column(Float)
    low = Column(Float)
    close = Column(Float)
    prev_close = Column(Float)
    volume = Column(Float)
    change = Column(Float)
    change_pct = Column(Float)
    data_source = Column(String(50), default='yfinance')
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    ticker = relationship("Ticker", back_populates="price_history")

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



# =============================================================================
# Removed Legacy Tables
# =============================================================================
# The following Legacy tables have been removed (replaced by MBS pipeline):
# - NewsArticle → MBS_IN_ARTICLE + MBS_PROC_ARTICLE
# - NewsTicker → MBS_PROC_ARTICLE (stk_cd field)
# - MarketSummary → Not used
# =============================================================================


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


# =============================================================================
# Helper Functions
# =============================================================================

def generate_id(prefix: str = '') -> str:
    """ID 생성 헬퍼 함수"""
    return f"{prefix}{uuid.uuid4().hex[:16]}"


def generate_batch_id() -> str:
    """배치 ID 생성 (YYYYMMDD-HHMMSS-UUID)"""
    from datetime import datetime
    now = datetime.now()
    timestamp = now.strftime('%Y%m%d-%H%M%S')
    short_uuid = uuid.uuid4().hex[:8]
    return f"{timestamp}-{short_uuid}"
