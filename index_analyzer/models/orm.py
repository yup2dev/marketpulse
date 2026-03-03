"""
ORM Models - MBS Schema (README ERD 기준)
데이터 흐름: IN (입수) → PROC (가공) → CALC (계산) → RCMD (추천)

명명 규칙:
- MBS_IN_{}   : 입수 (크롤러)
- MBS_PROC_{} : 가공 (ML/요약)
- MBS_CALC_{} : 계산 (메트릭)
- MBS_RCMD_{} : 추천 (결과)
"""
from datetime import datetime, date
from sqlalchemy import (
    Column, String, Text, Integer, Float, DateTime, Date, Boolean,
    ForeignKey, Index, UniqueConstraint, create_engine, DECIMAL
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
import uuid

Base = declarative_base()


# =============================================================================
# IN Layer: 입수 (크롤러가 넣는 원본 데이터)
# =============================================================================

class MBS_IN_STBD_MST(Base):
    """입수 - 상태판 마스터"""
    __tablename__ = 'mbs_in_stbd_mst'

    ticker_cd = Column(String(20), primary_key=True)
    ticker_nm = Column(String(200), nullable=False)
    asset_type = Column(String(20), nullable=False, index=True)

    sector = Column(String(100), index=True)
    industry = Column(String(100))
    exchange = Column(String(50))
    country = Column(String(50))
    curr = Column(String(10), default='USD')

    bond_type = Column(String(50))
    maturity = Column(String(20))

    data_source = Column(String(50))
    is_active = Column(Boolean, default=True, index=True)
    start_date = Column(Date, index=True)
    end_date = Column(Date)
    remarks = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index('idx_stbd_mst_asset_type', 'asset_type'),
        Index('idx_stbd_mst_sector', 'sector'),
        Index('idx_stbd_mst_active', 'is_active'),
        Index('idx_stbd_mst_start_date', 'start_date'),
    )

    def to_dict(self) -> dict:
        return {
            'ticker_cd': self.ticker_cd,
            'ticker_nm': self.ticker_nm,
            'asset_type': self.asset_type,
            'sector': self.sector,
            'industry': self.industry,
            'exchange': self.exchange,
            'country': self.country,
            'curr': self.curr,
            'bond_type': self.bond_type,
            'maturity': self.maturity,
            'data_source': self.data_source,
            'is_active': self.is_active,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'remarks': self.remarks
        }


class MBS_IN_INDX_STBD(Base):
    """입수 - 지수 상태판 마스터"""
    __tablename__ = 'mbs_in_indx_stbd'

    indx_cd = Column(String(50), primary_key=True)
    indx_nm = Column(String(200), nullable=False)
    indx_type = Column(String(20), nullable=False, index=True)

    fmp_endpoint = Column(String(100))
    api_symbol = Column(String(20))

    description = Column(Text)
    category = Column(String(50))
    region = Column(String(50), default='US')

    is_active = Column(Boolean, default=True, index=True)
    display_order = Column(Integer, default=0)
    remarks = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index('idx_indx_type', 'indx_type'),
        Index('idx_indx_active', 'is_active'),
        Index('idx_indx_order', 'display_order'),
    )

    def to_dict(self) -> dict:
        return {
            'indx_cd': self.indx_cd,
            'indx_nm': self.indx_nm,
            'indx_type': self.indx_type,
            'fmp_endpoint': self.fmp_endpoint,
            'api_symbol': self.api_symbol,
            'description': self.description,
            'category': self.category,
            'region': self.region,
            'is_active': self.is_active,
            'display_order': self.display_order,
            'remarks': self.remarks
        }


class MBS_IN_ARTICLE(Base):
    """입수 - 뉴스 기사 원본"""
    __tablename__ = 'mbs_in_article'

    news_id = Column(String(50), primary_key=True)
    base_ymd = Column(Date, nullable=False, index=True)
    source_cd = Column(String(50), nullable=False, index=True)
    url = Column(Text)
    title = Column(Text, nullable=False)
    content = Column(Text)
    publish_dt = Column(DateTime, index=True)
    ingest_batch_id = Column(String(50), index=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

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
    """입수 - 주식 상태판"""
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
    """입수 - ETF 상태판"""
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


class MBS_IN_BOND_STBD(Base):
    """입수 - 채권 상태판"""
    __tablename__ = 'mbs_in_bond_stbd'

    id = Column(Integer, primary_key=True, autoincrement=True)
    bond_cd = Column(String(20), nullable=False, index=True)
    bond_nm = Column(String(100))
    bond_type = Column(String(50), index=True)
    maturity = Column(String(20))
    curr = Column(String(10), default='USD')
    close_price = Column(DECIMAL(20, 4))
    yield_rate = Column(DECIMAL(10, 4))
    change_rate = Column(DECIMAL(10, 4))
    base_ymd = Column(Date, nullable=False, index=True)
    ingest_batch_id = Column(String(50), index=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('bond_cd', 'base_ymd', name='uq_bond_date'),
        Index('idx_in_bond_base_ymd', 'base_ymd'),
        Index('idx_in_bond_cd_date', 'bond_cd', 'base_ymd'),
        Index('idx_in_bond_type', 'bond_type'),
    )

    def to_dict(self) -> dict:
        return {
            'bond_cd': self.bond_cd,
            'bond_nm': self.bond_nm,
            'bond_type': self.bond_type,
            'maturity': self.maturity,
            'curr': self.curr,
            'close_price': float(self.close_price) if self.close_price else None,
            'yield_rate': float(self.yield_rate) if self.yield_rate else None,
            'change_rate': float(self.change_rate) if self.change_rate else None,
            'base_ymd': self.base_ymd.isoformat() if self.base_ymd else None
        }


class MBS_IN_CMDTY_STBD(Base):
    """입수 - 원자재 상태판"""
    __tablename__ = 'mbs_in_cmdty_stbd'

    id = Column(Integer, primary_key=True, autoincrement=True)
    cmdty_cd = Column(String(20), nullable=False, index=True)
    cmdty_nm = Column(String(100))
    sector = Column(String(100), index=True)
    exchange = Column(String(50))
    curr = Column(String(10), default='USD')
    close_price = Column(DECIMAL(20, 4))
    change_rate = Column(DECIMAL(10, 4))
    base_ymd = Column(Date, nullable=False, index=True)
    ingest_batch_id = Column(String(50), index=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('cmdty_cd', 'base_ymd', name='uq_cmdty_date'),
        Index('idx_in_cmdty_base_ymd', 'base_ymd'),
        Index('idx_in_cmdty_cd_date', 'cmdty_cd', 'base_ymd'),
        Index('idx_in_cmdty_sector', 'sector'),
    )

    def to_dict(self) -> dict:
        return {
            'cmdty_cd': self.cmdty_cd,
            'cmdty_nm': self.cmdty_nm,
            'sector': self.sector,
            'exchange': self.exchange,
            'curr': self.curr,
            'close_price': float(self.close_price) if self.close_price else None,
            'change_rate': float(self.change_rate) if self.change_rate else None,
            'base_ymd': self.base_ymd.isoformat() if self.base_ymd else None
        }


class MBS_IN_FINANCIAL_METRICS(Base):
    """입수 - 기업 재무지표"""
    __tablename__ = 'mbs_in_financial_metrics'

    id = Column(Integer, primary_key=True, autoincrement=True)
    stk_cd = Column(String(20), nullable=False, index=True)
    stk_nm = Column(String(100))

    debt_to_asset = Column(DECIMAL(10, 4))
    debt_to_equity = Column(DECIMAL(10, 4))
    current_ratio = Column(DECIMAL(10, 4))
    quick_ratio = Column(DECIMAL(10, 4))

    roe = Column(DECIMAL(10, 4))
    roa = Column(DECIMAL(10, 4))
    profit_margin = Column(DECIMAL(10, 4))

    pe_ratio = Column(DECIMAL(10, 4))
    pb_ratio = Column(DECIMAL(10, 4))
    market_cap = Column(DECIMAL(20, 2))

    fiscal_period = Column(String(20))
    base_ymd = Column(Date, nullable=False, index=True)
    ingest_batch_id = Column(String(50), index=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('stk_cd', 'base_ymd', 'fiscal_period', name='uq_financial_date'),
        Index('idx_in_financial_base_ymd', 'base_ymd'),
        Index('idx_in_financial_stk_cd', 'stk_cd', 'base_ymd'),
    )

    def to_dict(self) -> dict:
        return {
            'stk_cd': self.stk_cd,
            'stk_nm': self.stk_nm,
            'debt_to_asset': float(self.debt_to_asset) if self.debt_to_asset else None,
            'debt_to_equity': float(self.debt_to_equity) if self.debt_to_equity else None,
            'current_ratio': float(self.current_ratio) if self.current_ratio else None,
            'quick_ratio': float(self.quick_ratio) if self.quick_ratio else None,
            'roe': float(self.roe) if self.roe else None,
            'roa': float(self.roa) if self.roa else None,
            'profit_margin': float(self.profit_margin) if self.profit_margin else None,
            'pe_ratio': float(self.pe_ratio) if self.pe_ratio else None,
            'pb_ratio': float(self.pb_ratio) if self.pb_ratio else None,
            'market_cap': float(self.market_cap) if self.market_cap else None,
            'fiscal_period': self.fiscal_period,
            'base_ymd': self.base_ymd.isoformat() if self.base_ymd else None
        }


class MBS_IN_STK_PROFILE(Base):
    """입수 - 종목 상세 프로필"""
    __tablename__ = 'mbs_in_stk_profile'

    stk_cd = Column(String(20), primary_key=True)
    stk_nm = Column(String(200))
    sector = Column(String(100), index=True)
    industry = Column(String(100), index=True)
    description = Column(Text)
    website = Column(String(300))
    ceo = Column(String(100))
    employees = Column(Integer)
    country = Column(String(50))
    exchange = Column(String(50))
    currency = Column(String(10), default='USD')
    ipo_date = Column(Date)
    image_url = Column(String(500))

    market_cap = Column(DECIMAL(20, 2))
    price = Column(DECIMAL(20, 4))
    beta = Column(DECIMAL(10, 4))

    in_sp500 = Column(Boolean, default=False, index=True)
    in_nasdaq100 = Column(Boolean, default=False)
    in_dow30 = Column(Boolean, default=False)

    data_source = Column(String(50))
    last_updated = Column(DateTime)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index('idx_stk_profile_sector', 'sector'),
        Index('idx_stk_profile_industry', 'industry'),
        Index('idx_stk_profile_sp500', 'in_sp500'),
    )

    def to_dict(self) -> dict:
        return {
            'stk_cd': self.stk_cd,
            'stk_nm': self.stk_nm,
            'sector': self.sector,
            'industry': self.industry,
            'description': self.description,
            'website': self.website,
            'ceo': self.ceo,
            'employees': self.employees,
            'country': self.country,
            'exchange': self.exchange,
            'currency': self.currency,
            'ipo_date': self.ipo_date.isoformat() if self.ipo_date else None,
            'image_url': self.image_url,
            'market_cap': float(self.market_cap) if self.market_cap else None,
            'price': float(self.price) if self.price else None,
            'beta': float(self.beta) if self.beta else None,
            'in_sp500': self.in_sp500,
            'in_nasdaq100': self.in_nasdaq100,
            'in_dow30': self.in_dow30,
            'data_source': self.data_source,
            'last_updated': self.last_updated.isoformat() if self.last_updated else None,
        }


class MBS_IN_STK_RELATIONS(Base):
    """입수 - 종목 관계"""
    __tablename__ = 'mbs_in_stk_relations'

    id = Column(Integer, primary_key=True, autoincrement=True)
    stk_cd = Column(String(20), nullable=False, index=True)
    related_cd = Column(String(20), nullable=False, index=True)
    relation_type = Column(String(30), nullable=False, index=True)

    related_nm = Column(String(200))
    detail = Column(Text)
    confidence = Column(DECIMAL(5, 4), default=1.0)
    data_source = Column(String(50))

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('stk_cd', 'related_cd', 'relation_type', name='uq_stk_relation'),
        Index('idx_stk_relations_stk', 'stk_cd'),
        Index('idx_stk_relations_type', 'stk_cd', 'relation_type'),
    )

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'stk_cd': self.stk_cd,
            'related_cd': self.related_cd,
            'relation_type': self.relation_type,
            'related_nm': self.related_nm,
            'detail': self.detail,
            'confidence': float(self.confidence) if self.confidence else None,
            'data_source': self.data_source,
        }


class MBS_IN_INDX_MEMBER(Base):
    """입수 - 지수 구성종목"""
    __tablename__ = 'mbs_in_indx_member'

    id = Column(Integer, primary_key=True, autoincrement=True)
    indx_cd = Column(String(50), nullable=False, index=True)
    stk_cd = Column(String(20), nullable=False, index=True)
    stk_nm = Column(String(200))
    sector = Column(String(100))
    sub_sector = Column(String(100))

    date_added = Column(Date)
    date_removed = Column(Date)
    is_current = Column(Boolean, default=True, index=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('indx_cd', 'stk_cd', name='uq_indx_member'),
        Index('idx_indx_member_indx', 'indx_cd', 'is_current'),
        Index('idx_indx_member_stk', 'stk_cd'),
    )

    def to_dict(self) -> dict:
        return {
            'indx_cd': self.indx_cd,
            'stk_cd': self.stk_cd,
            'stk_nm': self.stk_nm,
            'sector': self.sector,
            'sub_sector': self.sub_sector,
            'date_added': self.date_added.isoformat() if self.date_added else None,
            'date_removed': self.date_removed.isoformat() if self.date_removed else None,
            'is_current': self.is_current,
        }


class MBS_IN_BOND_ISSUANCE(Base):
    """입수 - 기업채권 발행량"""
    __tablename__ = 'mbs_in_bond_issuance'

    id = Column(Integer, primary_key=True, autoincrement=True)
    issuer_cd = Column(String(20), index=True)
    issuer_nm = Column(String(200))

    bond_type = Column(String(50), index=True)
    issuance_amount = Column(DECIMAL(20, 2))
    maturity_date = Column(Date)
    coupon_rate = Column(DECIMAL(10, 4))

    issue_date = Column(Date, nullable=False, index=True)
    base_ymd = Column(Date, nullable=False, index=True)
    ingest_batch_id = Column(String(50), index=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index('idx_in_bond_issuance_issue_date', 'issue_date'),
        Index('idx_in_bond_issuance_issuer', 'issuer_cd', 'issue_date'),
        Index('idx_in_bond_issuance_type', 'bond_type', 'issue_date'),
    )

    def to_dict(self) -> dict:
        return {
            'issuer_cd': self.issuer_cd,
            'issuer_nm': self.issuer_nm,
            'bond_type': self.bond_type,
            'issuance_amount': float(self.issuance_amount) if self.issuance_amount else None,
            'maturity_date': self.maturity_date.isoformat() if self.maturity_date else None,
            'coupon_rate': float(self.coupon_rate) if self.coupon_rate else None,
            'issue_date': self.issue_date.isoformat() if self.issue_date else None,
            'base_ymd': self.base_ymd.isoformat() if self.base_ymd else None
        }


# =============================================================================
# USER & PORTFOLIO Layer
# =============================================================================

class User(Base):
    """사용자 계정 정보"""
    __tablename__ = 'users'

    user_id = Column(String(50), primary_key=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)

    full_name = Column(String(200))
    is_active = Column(Boolean, default=True, index=True)
    is_verified = Column(Boolean, default=False)
    role = Column(String(20), default='user')

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = Column(DateTime)

    portfolios = relationship("Portfolio", back_populates="user", cascade="all, delete-orphan")
    watchlists = relationship("Watchlist", back_populates="user", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="user", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_user_email', 'email'),
        Index('idx_user_username', 'username'),
        Index('idx_user_active', 'is_active'),
    )

    def to_dict(self) -> dict:
        return {
            'user_id': self.user_id,
            'email': self.email,
            'username': self.username,
            'full_name': self.full_name,
            'is_active': self.is_active,
            'is_verified': self.is_verified,
            'role': self.role,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None
        }


class Portfolio(Base):
    """사용자 포트폴리오"""
    __tablename__ = 'portfolios'

    portfolio_id = Column(String(50), primary_key=True)
    user_id = Column(String(50), ForeignKey('users.user_id'), nullable=False, index=True)

    name = Column(String(200), nullable=False)
    description = Column(Text)
    currency = Column(String(10), default='USD')
    is_default = Column(Boolean, default=False)

    benchmark = Column(String(20))
    rebalance_frequency = Column(String(20))

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="portfolios")
    holdings = relationship("Holding", back_populates="portfolio", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="portfolio", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_portfolio_user', 'user_id'),
        Index('idx_portfolio_default', 'user_id', 'is_default'),
    )

    def to_dict(self) -> dict:
        return {
            'portfolio_id': self.portfolio_id,
            'user_id': self.user_id,
            'name': self.name,
            'description': self.description,
            'currency': self.currency,
            'is_default': self.is_default,
            'benchmark': self.benchmark,
            'rebalance_frequency': self.rebalance_frequency,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class Transaction(Base):
    """거래 기록"""
    __tablename__ = 'transactions'

    transaction_id = Column(String(50), primary_key=True)
    portfolio_id = Column(String(50), ForeignKey('portfolios.portfolio_id'), nullable=False, index=True)

    ticker_cd = Column(String(20), nullable=False, index=True)
    transaction_type = Column(String(20), nullable=False)
    quantity = Column(DECIMAL(20, 8), nullable=False)
    price = Column(DECIMAL(20, 4), nullable=False)
    commission = Column(DECIMAL(20, 4), default=0)
    tax = Column(DECIMAL(20, 4), default=0)
    total_amount = Column(DECIMAL(20, 4))

    transaction_date = Column(DateTime, nullable=False, index=True)
    notes = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    portfolio = relationship("Portfolio", back_populates="transactions")

    __table_args__ = (
        Index('idx_transaction_portfolio', 'portfolio_id'),
        Index('idx_transaction_ticker', 'ticker_cd'),
        Index('idx_transaction_date', 'transaction_date'),
        Index('idx_transaction_type', 'transaction_type'),
    )

    def to_dict(self) -> dict:
        return {
            'transaction_id': self.transaction_id,
            'portfolio_id': self.portfolio_id,
            'ticker_cd': self.ticker_cd,
            'transaction_type': self.transaction_type,
            'quantity': float(self.quantity) if self.quantity else None,
            'price': float(self.price) if self.price else None,
            'commission': float(self.commission) if self.commission else None,
            'tax': float(self.tax) if self.tax else None,
            'total_amount': float(self.total_amount) if self.total_amount else None,
            'transaction_date': self.transaction_date.isoformat() if self.transaction_date else None,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Holding(Base):
    """현재 보유 종목"""
    __tablename__ = 'holdings'

    holding_id = Column(String(50), primary_key=True)
    portfolio_id = Column(String(50), ForeignKey('portfolios.portfolio_id'), nullable=False, index=True)

    ticker_cd = Column(String(20), nullable=False, index=True)
    quantity = Column(DECIMAL(20, 8), nullable=False)
    avg_cost = Column(DECIMAL(20, 4), nullable=False)
    current_price = Column(DECIMAL(20, 4))

    total_cost = Column(DECIMAL(20, 4))
    market_value = Column(DECIMAL(20, 4))
    unrealized_pnl = Column(DECIMAL(20, 4))
    unrealized_pnl_pct = Column(DECIMAL(10, 4))

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    portfolio = relationship("Portfolio", back_populates="holdings")

    __table_args__ = (
        UniqueConstraint('portfolio_id', 'ticker_cd', name='uq_portfolio_ticker'),
        Index('idx_holding_portfolio', 'portfolio_id'),
        Index('idx_holding_ticker', 'ticker_cd'),
    )

    def to_dict(self) -> dict:
        return {
            'holding_id': self.holding_id,
            'portfolio_id': self.portfolio_id,
            'ticker_cd': self.ticker_cd,
            'quantity': float(self.quantity) if self.quantity else None,
            'avg_cost': float(self.avg_cost) if self.avg_cost else None,
            'current_price': float(self.current_price) if self.current_price else None,
            'total_cost': float(self.total_cost) if self.total_cost else None,
            'market_value': float(self.market_value) if self.market_value else None,
            'unrealized_pnl': float(self.unrealized_pnl) if self.unrealized_pnl else None,
            'unrealized_pnl_pct': float(self.unrealized_pnl_pct) if self.unrealized_pnl_pct else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class Watchlist(Base):
    """관심 종목 리스트"""
    __tablename__ = 'watchlists'

    watchlist_id = Column(String(50), primary_key=True)
    user_id = Column(String(50), ForeignKey('users.user_id'), nullable=False, index=True)

    name = Column(String(200), nullable=False, default='기본 관심종목')
    description = Column(Text)
    tickers = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="watchlists")
    items = relationship(
        "WatchlistItem", back_populates="watchlist",
        cascade="all, delete-orphan", order_by="WatchlistItem.sort_order"
    )

    __table_args__ = (
        Index('idx_watchlist_user', 'user_id'),
    )

    def to_dict(self) -> dict:
        import json
        tickers_list = []
        if self.items:
            tickers_list = [item.ticker_cd for item in self.items]
        elif self.tickers:
            tickers_list = json.loads(self.tickers)
        return {
            'watchlist_id': self.watchlist_id,
            'user_id': self.user_id,
            'name': self.name,
            'description': self.description,
            'tickers': tickers_list,
            'items': [item.to_dict() for item in self.items] if self.items else [],
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class WatchlistItem(Base):
    """관심 종목 항목"""
    __tablename__ = 'watchlist_items'

    item_id = Column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    watchlist_id = Column(String(50), ForeignKey('watchlists.watchlist_id'), nullable=False, index=True)
    ticker_cd = Column(String(20), nullable=False, index=True)

    sort_order = Column(Integer, default=0, index=True)
    notes = Column(Text)
    added_at = Column(DateTime, default=datetime.utcnow)

    watchlist = relationship("Watchlist", back_populates="items")

    __table_args__ = (
        UniqueConstraint('watchlist_id', 'ticker_cd', name='uq_watchlist_ticker'),
        Index('idx_watchlist_items_watchlist', 'watchlist_id', 'sort_order'),
        Index('idx_watchlist_items_ticker', 'ticker_cd'),
    )

    def to_dict(self) -> dict:
        return {
            'item_id': self.item_id,
            'watchlist_id': self.watchlist_id,
            'ticker_cd': self.ticker_cd,
            'sort_order': self.sort_order,
            'notes': self.notes,
            'added_at': self.added_at.isoformat() if self.added_at else None
        }


class Alert(Base):
    """가격/뉴스 알림"""
    __tablename__ = 'alerts'

    alert_id = Column(String(50), primary_key=True)
    user_id = Column(String(50), ForeignKey('users.user_id'), nullable=False, index=True)

    alert_type = Column(String(20), nullable=False, index=True)
    ticker_cd = Column(String(20), index=True)

    condition_type = Column(String(20))
    threshold_value = Column(DECIMAL(20, 4))

    is_active = Column(Boolean, default=True, index=True)
    notification_method = Column(String(50), default='email')
    message = Column(Text)

    last_triggered = Column(DateTime)
    trigger_count = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="alerts")

    __table_args__ = (
        Index('idx_alert_user', 'user_id'),
        Index('idx_alert_type', 'alert_type'),
        Index('idx_alert_ticker', 'ticker_cd'),
        Index('idx_alert_active', 'is_active'),
    )

    def to_dict(self) -> dict:
        return {
            'alert_id': self.alert_id,
            'user_id': self.user_id,
            'alert_type': self.alert_type,
            'ticker_cd': self.ticker_cd,
            'condition_type': self.condition_type,
            'threshold_value': float(self.threshold_value) if self.threshold_value else None,
            'is_active': self.is_active,
            'notification_method': self.notification_method,
            'message': self.message,
            'last_triggered': self.last_triggered.isoformat() if self.last_triggered else None,
            'trigger_count': self.trigger_count,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class AlertHistory(Base):
    """알림 발생 이력"""
    __tablename__ = 'alert_history'

    history_id = Column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    alert_id = Column(String(50), ForeignKey('alerts.alert_id'), nullable=False, index=True)

    triggered_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    triggered_value = Column(DECIMAL(20, 4))
    message = Column(Text)
    is_sent = Column(Boolean, default=False)

    __table_args__ = (
        Index('idx_alert_history_alert', 'alert_id'),
        Index('idx_alert_history_triggered', 'triggered_at'),
    )

    def to_dict(self) -> dict:
        return {
            'history_id': self.history_id,
            'alert_id': self.alert_id,
            'triggered_at': self.triggered_at.isoformat() if self.triggered_at else None,
            'triggered_value': float(self.triggered_value) if self.triggered_value else None,
            'message': self.message,
            'is_sent': self.is_sent
        }


class SavedScreener(Base):
    """저장된 스크리너 조건"""
    __tablename__ = 'saved_screeners'

    screener_id = Column(String(50), primary_key=True)
    user_id = Column(String(50), ForeignKey('users.user_id'), nullable=False, index=True)

    name = Column(String(200), nullable=False)
    description = Column(Text)
    filters = Column(Text, nullable=False)

    is_active = Column(Boolean, default=True)
    run_frequency = Column(String(20))

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_run = Column(DateTime)

    __table_args__ = (
        Index('idx_screener_user', 'user_id'),
        Index('idx_screener_active', 'is_active'),
    )

    def to_dict(self) -> dict:
        import json
        return {
            'screener_id': self.screener_id,
            'user_id': self.user_id,
            'name': self.name,
            'description': self.description,
            'filters': json.loads(self.filters) if self.filters else {},
            'is_active': self.is_active,
            'run_frequency': self.run_frequency,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_run': self.last_run.isoformat() if self.last_run else None
        }


# =============================================================================
# PROC Layer: 가공
# =============================================================================

class MBS_PROC_ARTICLE(Base):
    """가공 - 기사 분석 결과"""
    __tablename__ = 'mbs_proc_article'

    proc_id = Column(String(50), primary_key=True)
    news_id = Column(String(50), ForeignKey('mbs_in_article.news_id'), nullable=False, index=True)
    stk_cd = Column(String(20), index=True)

    summary_text = Column(Text)
    match_score = Column(DECIMAL(10, 4))
    price_impact = Column(DECIMAL(10, 4))
    sentiment_score = Column(DECIMAL(10, 4))
    price = Column(DECIMAL(20, 4))

    base_ymd = Column(Date, nullable=False, index=True)
    source_batch_id = Column(String(50), index=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

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
# CALC Layer: 계산
# =============================================================================

class MBS_CALC_METRIC(Base):
    """계산 - 메트릭 계산 결과"""
    __tablename__ = 'mbs_calc_metric'

    calc_id = Column(String(50), primary_key=True)
    stk_cd = Column(String(20), nullable=False, index=True)
    base_ymd = Column(Date, nullable=False, index=True)

    metric_type = Column(String(20), nullable=False, index=True)
    metric_val = Column(DECIMAL(20, 8))

    source_proc_id = Column(String(50), ForeignKey('mbs_proc_article.proc_id'), index=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

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
# RCMD Layer: 추천
# =============================================================================

class MBS_RCMD_RESULT(Base):
    """추천 - 추천 결과"""
    __tablename__ = 'mbs_rcmd_result'

    rcmd_id = Column(String(50), primary_key=True)

    ref_news_id = Column(String(50), ForeignKey('mbs_in_article.news_id'), index=True)
    ref_stk_cd = Column(String(20), index=True)
    ref_calc_id = Column(String(50), ForeignKey('mbs_calc_metric.calc_id'), index=True)

    rcmd_type = Column(String(20), nullable=False, index=True)
    score = Column(DECIMAL(10, 4))
    reason = Column(Text)

    base_ymd = Column(Date, nullable=False, index=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

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


class UserWorkspace(Base):
    """사용자 워크스페이스 레이아웃 저장"""
    __tablename__ = 'user_workspaces'

    id = Column(String(50), primary_key=True)
    user_id = Column(String(50), ForeignKey('users.user_id'), nullable=False, index=True)
    screen = Column(String(50), nullable=False)
    name = Column(String(200), nullable=False)
    is_default = Column(Boolean, default=False)
    layout = Column(Text)   # JSON: react-grid-layout positions
    widgets = Column(Text)  # JSON: widget configs + state

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")

    __table_args__ = (
        Index('idx_workspace_user_screen', 'user_id', 'screen'),
    )

    def to_dict(self) -> dict:
        import json
        return {
            'id': self.id,
            'user_id': self.user_id,
            'screen': self.screen,
            'name': self.name,
            'is_default': self.is_default,
            'layout': json.loads(self.layout) if self.layout else [],
            'widgets': json.loads(self.widgets) if self.widgets else [],
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


# =============================================================================
# Backward-compatible re-exports from utils.db
# =============================================================================
from ..utils.db import (
    Database,
    get_sqlite_db,
    get_postgresql_db,
    generate_id,
    generate_batch_id,
    default_db,
    engine,
    SessionLocal,
)
