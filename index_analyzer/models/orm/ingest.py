"""
IN Layer: 입수 (크롤러/수집기가 넣는 원본 데이터)

테이블 (MBS_IN_*):
- STBD_MST          : 상태판 마스터 (전 자산 공통 티커 마스터)   [활성]
- INDX_STBD         : 지수 상태판 마스터                       [활성]
- ARTICLE           : 뉴스 기사 원본                           [활성]
- STK_STBD          : 주식 상태판 (일별 시세)                  [활성]
- ETF_STBD          : ETF 상태판                              [활성]
- BOND_STBD         : 채권 상태판                              [활성]
- CMDTY_STBD        : 원자재 상태판                            [활성]
- FINANCIAL_METRICS : 기업 재무지표                            [활성]
- STK_PROFILE       : 종목 상세 프로필                         [활성]
- STK_RELATIONS     : 종목 관계 (peer/competitor)             [활성]
- INDX_MEMBER       : 지수 구성종목                            [활성]
- BOND_ISSUANCE     : 기업채권 발행량                          [미사용/제거 후보]

(상세 현황은 docs/ARCHITECTURE.md 의 "입수 데이터 정리표" 참고)
"""
from datetime import datetime, date
from sqlalchemy import (
    Column, String, Text, Integer, BigInteger, DateTime, Date, Boolean, Float, JSON,
    Index, UniqueConstraint, DECIMAL
)
from sqlalchemy.orm import relationship

from .base import Base


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
    volume = Column(BigInteger)
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
            'volume': int(self.volume) if self.volume else None,
            'base_ymd': self.base_ymd.isoformat() if self.base_ymd else None
        }


class MBS_IN_ETF_STBD(Base):
    """입수 - ETF 상태판 [미사용/제거 후보]"""
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
    """입수 - 채권 상태판 [미사용/제거 후보]"""
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
    """입수 - 원자재 상태판 [미사용/제거 후보]"""
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
    """입수 - 기업채권 발행량 [미사용/제거 후보]"""
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


class MBS_IN_INSTI_MST(Base):
    """13F 기관 마스터 — 제출 기관 목록(전체 적재). holdings는 PORT/HOLD 참조."""

    __tablename__ = 'mbs_in_insti_mst'

    institution_key = Column(String(100), primary_key=True)  # whalewisdom key(slug) | cik
    name = Column(String(300), nullable=False)
    manager = Column(String(300))
    cik = Column(String(20), index=True)
    description = Column(Text)
    category = Column(String(50))
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class MBS_IN_INSTI_PORT(Base):
    """기관 13F 포트폴리오 요약 — 최신 1건/기관(배치가 교체). 분기 공시 스냅샷."""

    __tablename__ = 'mbs_in_insti_port'

    institution_key = Column(String(100), primary_key=True)
    id = Column(String(120))                       # 서비스가 노출하는 식별자(예: 13f_berkshire)
    manager = Column(String(300))
    name = Column(String(300))
    description = Column(Text)
    total_value = Column(Float)
    num_holdings = Column(Integer)
    filing_date = Column(String(20))
    period_end = Column(String(20), index=True)
    category = Column(String(50))
    previous_filing_date = Column(String(20))
    previous_value = Column(Float)
    value_change = Column(Float)
    value_change_pct = Column(Float)
    num_new_positions = Column(Integer)
    num_sold_out = Column(Integer)
    num_increased = Column(Integer)
    num_decreased = Column(Integer)
    turnover = Column(Float)
    performance = Column(JSON)
    top_sectors = Column(JSON)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class MBS_IN_INSTI_HOLD(Base):
    """기관 13F 보유 종목 — stocks + sold_positions(is_sold). 배치가 기관별 교체."""

    __tablename__ = 'mbs_in_insti_hold'

    id = Column(Integer, primary_key=True, autoincrement=True)
    institution_key = Column(String(100), index=True, nullable=False)
    is_sold = Column(Boolean, default=False, index=True)  # False=보유 stocks, True=매도 sold_positions
    seq = Column(Integer)                                  # 정렬 순서(비중 내림차순)
    symbol = Column(String(20), index=True)
    name = Column(String(300))
    cusip = Column(String(20))
    value = Column(Float)
    shares = Column(BigInteger)
    weight = Column(Float)
    prev_shares = Column(BigInteger)
    prev_value = Column(Float)
    share_change = Column(BigInteger)
    share_change_pct = Column(Float)
    value_change = Column(Float)
    value_change_pct = Column(Float)
    status = Column(String(20))

    __table_args__ = (
        Index('ix_insti_hold_key_sold', 'institution_key', 'is_sold'),
    )


class MBS_IN_RESEARCH_RPT(Base):
    """입수 - 리서치 보고서 (PDF 임포트: 애널리스트 보고서/추정치/연간보고서).

    업로드 라우트(/api/reports/upload)가 PDF를 data/reports/ 에 저장하고
    추출 텍스트와 함께 이 테이블에 적재한다. 조회는 db/research_reports fetcher.
    """
    __tablename__ = 'mbs_in_research_rpt'

    report_id = Column(String(50), primary_key=True)
    symbol = Column(String(20), index=True)              # 대상 종목 (없으면 NULL — 시장 전반 보고서)
    title = Column(String(500), nullable=False)
    report_type = Column(String(20), nullable=False, index=True)  # analyst | estimates | annual
    source = Column(String(200))                         # 증권사/작성기관 (예: Goldman Sachs, 10-K)
    published_date = Column(Date, index=True)

    file_name = Column(String(300), nullable=False)      # 원본 파일명
    file_path = Column(String(500), nullable=False)      # 저장 경로 (프로젝트 루트 상대)
    file_size = Column(Integer)                          # bytes
    num_pages = Column(Integer)
    content_text = Column(Text)                          # pypdf 추출 전문 (검색/미리보기용)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index('idx_research_rpt_symbol_type', 'symbol', 'report_type'),
        Index('idx_research_rpt_published', 'published_date'),
    )

    def to_dict(self) -> dict:
        return {
            'report_id': self.report_id,
            'symbol': self.symbol,
            'title': self.title,
            'report_type': self.report_type,
            'source': self.source,
            'published_date': self.published_date.isoformat() if self.published_date else None,
            'file_name': self.file_name,
            'file_size': self.file_size,
            'num_pages': self.num_pages,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


__all__ = [
    "MBS_IN_STBD_MST",
    "MBS_IN_INDX_STBD",
    "MBS_IN_ARTICLE",
    "MBS_IN_STK_STBD",
    "MBS_IN_ETF_STBD",
    "MBS_IN_BOND_STBD",
    "MBS_IN_CMDTY_STBD",
    "MBS_IN_FINANCIAL_METRICS",
    "MBS_IN_STK_PROFILE",
    "MBS_IN_STK_RELATIONS",
    "MBS_IN_INDX_MEMBER",
    "MBS_IN_BOND_ISSUANCE",
    "MBS_IN_INSTI_MST",
    "MBS_IN_INSTI_PORT",
    "MBS_IN_INSTI_HOLD",
    "MBS_IN_RESEARCH_RPT",
]
