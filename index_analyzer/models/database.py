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
    """
    입수 - 상태판 마스터
    시스템에서 수집/추적할 종목 목록 관리
    실제 가격 데이터는 MBS_IN_STK_STBD, MBS_IN_ETF_STBD, MBS_IN_BOND_STBD, MBS_IN_CMDTY_STBD에 저장
    """
    __tablename__ = 'mbs_in_stbd_mst'

    ticker_cd = Column(String(20), primary_key=True)  # 종목 코드 (예: AAPL, SPY, GC=F, ^TNX)
    ticker_nm = Column(String(200), nullable=False)  # 종목명
    asset_type = Column(String(20), nullable=False, index=True)  # stock, etf, bond, commodity

    # 추가 정보
    sector = Column(String(100), index=True)  # 섹터 (Technology, Energy 등)
    industry = Column(String(100))  # 산업 (Software, Oil & Gas 등)
    exchange = Column(String(50))  # 거래소 (NYSE, NASDAQ, NYMEX 등)
    country = Column(String(50))  # 국가
    curr = Column(String(10), default='USD')  # 통화

    # 채권 전용 필드
    bond_type = Column(String(50))  # Treasury, Corporate, Municipal
    maturity = Column(String(20))  # 만기 (10Y, 30Y)

    # 관리 정보
    data_source = Column(String(50))  # wikipedia, yfinance, manual
    is_active = Column(Boolean, default=True, index=True)  # 활성 여부
    start_date = Column(Date, index=True)  # 수집 시작일
    end_date = Column(Date)  # 수집 종료일 (is_active=False인 경우)
    remarks = Column(Text)  # 비고

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
    """
    입수 - 지수 상태판 마스터
    시스템에서 사용할 주요 지수(Index/Universe) 정보 관리
    """
    __tablename__ = 'mbs_in_indx_stbd'

    indx_cd = Column(String(50), primary_key=True)  # 지수 코드 (예: sp500, nasdaq100, dow30)
    indx_nm = Column(String(200), nullable=False)  # 지수명 (예: S&P 500, NASDAQ 100)
    indx_type = Column(String(20), nullable=False, index=True)  # universe, benchmark

    # API 연동 정보
    fmp_endpoint = Column(String(100))  # FMP API 엔드포인트 (예: sp500_constituent)
    api_symbol = Column(String(20))  # API에서 사용하는 심볼 (예: SPY, QQQ - benchmark용)

    # 메타 정보
    description = Column(Text)  # 설명
    category = Column(String(50))  # 카테고리 (Large Cap, Small Cap, Tech, etc.)
    region = Column(String(50), default='US')  # 지역 (US, Global, etc.)

    # 관리 정보
    is_active = Column(Boolean, default=True, index=True)  # 활성 여부
    display_order = Column(Integer, default=0)  # 표시 순서
    remarks = Column(Text)  # 비고

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
    """
    입수 - 뉴스 기사 원본
    크롤러가 수집한 raw 데이터
    """
    __tablename__ = 'mbs_in_article'

    news_id = Column(String(50), primary_key=True)
    base_ymd = Column(Date, nullable=False, index=True)
    source_cd = Column(String(50), nullable=False, index=True)  # 출판사/뉴스 출처
    url = Column(Text)  # 기사 URL
    title = Column(Text, nullable=False)
    content = Column(Text)  # 요약본 (summary)
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


class MBS_IN_BOND_STBD(Base):
    """
    입수 - 채권 상태판
    크롤러가 수집한 채권 가격 데이터
    """
    __tablename__ = 'mbs_in_bond_stbd'

    id = Column(Integer, primary_key=True, autoincrement=True)
    bond_cd = Column(String(20), nullable=False, index=True)
    bond_nm = Column(String(100))
    bond_type = Column(String(50), index=True)  # Treasury, Corporate, Municipal 등
    maturity = Column(String(20))  # 만기 (예: 10Y, 30Y)
    curr = Column(String(10), default='USD')
    close_price = Column(DECIMAL(20, 4))
    yield_rate = Column(DECIMAL(10, 4))  # 수익률
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
    """
    입수 - 원자재 상태판
    크롤러가 수집한 원자재 선물 가격 데이터
    """
    __tablename__ = 'mbs_in_cmdty_stbd'

    id = Column(Integer, primary_key=True, autoincrement=True)
    cmdty_cd = Column(String(20), nullable=False, index=True)
    cmdty_nm = Column(String(100))
    sector = Column(String(100), index=True)  # Energy, Metals, Agriculture 등
    exchange = Column(String(50))  # NYMEX, COMEX, CBOT 등
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
    """
    입수 - 기업 재무지표
    yfinance로 수집한 재무제표 데이터
    """
    __tablename__ = 'mbs_in_financial_metrics'

    id = Column(Integer, primary_key=True, autoincrement=True)
    stk_cd = Column(String(20), nullable=False, index=True)
    stk_nm = Column(String(100))

    # 재무비율
    debt_to_asset = Column(DECIMAL(10, 4))  # 부채비율 (총부채/총자산)
    debt_to_equity = Column(DECIMAL(10, 4))  # 부채자본비율 (총부채/자본)
    current_ratio = Column(DECIMAL(10, 4))  # 유동비율
    quick_ratio = Column(DECIMAL(10, 4))  # 당좌비율

    # 수익성 지표
    roe = Column(DECIMAL(10, 4))  # ROE (자기자본이익률)
    roa = Column(DECIMAL(10, 4))  # ROA (총자산이익률)
    profit_margin = Column(DECIMAL(10, 4))  # 순이익률

    # 밸류에이션
    pe_ratio = Column(DECIMAL(10, 4))  # PER (주가수익비율)
    pb_ratio = Column(DECIMAL(10, 4))  # PBR (주가순자산비율)
    market_cap = Column(DECIMAL(20, 2))  # 시가총액

    # 날짜
    fiscal_period = Column(String(20))  # 회계기간 (예: 2024Q3, 2023FY)
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


class MBS_IN_BOND_ISSUANCE(Base):
    """
    입수 - 기업채권 발행량
    FRED API나 기타 소스로 수집한 채권 발행 데이터
    """
    __tablename__ = 'mbs_in_bond_issuance'

    id = Column(Integer, primary_key=True, autoincrement=True)
    issuer_cd = Column(String(20), index=True)  # 발행사 코드
    issuer_nm = Column(String(200))  # 발행사명

    # 채권 정보
    bond_type = Column(String(50), index=True)  # Corporate, High-Yield, Investment-Grade
    issuance_amount = Column(DECIMAL(20, 2))  # 발행액 (USD)
    maturity_date = Column(Date)  # 만기일
    coupon_rate = Column(DECIMAL(10, 4))  # 쿠폰 이자율

    # 날짜
    issue_date = Column(Date, nullable=False, index=True)  # 발행일
    base_ymd = Column(Date, nullable=False, index=True)  # 기준일
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


# =============================================================================
# Default DB Instance (SQLite)
# =============================================================================
import os
from pathlib import Path

# 프로젝트 루트 디렉토리
PROJECT_ROOT = Path(__file__).parent.parent.parent
DB_PATH = PROJECT_ROOT / "data" / "marketpulse.db"

# 데이터 디렉토리 생성
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

# SQLite 기본 인스턴스
default_db = get_sqlite_db(str(DB_PATH))
engine = default_db.engine
SessionLocal = default_db.SessionLocal
