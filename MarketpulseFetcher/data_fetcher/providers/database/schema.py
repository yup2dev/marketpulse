"""database provider 가 읽는 테이블의 읽기 전용 모델.

fetcher 는 이 테이블을 쓰지 않고 조회만 한다. 웹·배치 ORM 을 import 하지 않도록
필요한 테이블만 여기 따로 정의한다 (exe 에도 그대로 번들된다).
스키마의 주인은 웹(app/backend/models/orm) — 컬럼이 어긋나면
tests/test_ingest_contract.py 가 잡는다.
"""
from datetime import datetime

from sqlalchemy import (
    Column, String, Text, Integer, BigInteger, DateTime, Date, Boolean, Float, JSON,
    Index, UniqueConstraint, DECIMAL
)
from sqlalchemy.orm import declarative_base

Base = declarative_base()

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


class MBS_IN_INSTI_PERF(Base):
    """기관 13F 기반 분기별 추정 수익률 — 한 행 = 한 분기. 배치가 기관별 교체.

    로컬 배치가 13F 원본을 파싱해 산출한다(서버 파싱 금지). 실제 NAV 수익률이 아니며
    coverage_pct / derivative_weight_pct 가 신뢰도 지표다(standard_models/fund_performance.py).
    cumulative_return_pct 는 적재 구간 기준이라 조회 구간에 맞게 DB fetcher가 다시 계산한다.
    """

    __tablename__ = 'mbs_in_insti_perf'

    id = Column(Integer, primary_key=True, autoincrement=True)
    institution_key = Column(String(100), index=True, nullable=False)
    period = Column(String(20), nullable=False)            # 분기말 기준일 (YYYY-MM-DD)
    filing_date = Column(String(20))
    name = Column(String(300))
    manager = Column(String(300))
    return_pct = Column(Float)
    cumulative_return_pct = Column(Float)
    aum_change_pct = Column(Float)
    total_value = Column(Float)
    num_holdings = Column(Integer)
    coverage_pct = Column(Float)
    derivative_weight_pct = Column(Float)
    matched_positions = Column(Integer)
    excluded_positions = Column(Integer)
    top_contributor = Column(String(300))
    top_contributor_pct = Column(Float)
    top_detractor = Column(String(300))
    top_detractor_pct = Column(Float)

    __table_args__ = (
        Index('ix_insti_perf_key_period', 'institution_key', 'period'),
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
    "Base",
    "MBS_IN_STBD_MST",
    "MBS_IN_INDX_STBD",
    "MBS_IN_STK_STBD",
    "MBS_IN_INSTI_MST",
    "MBS_IN_INSTI_PORT",
    "MBS_IN_INSTI_HOLD",
    "MBS_IN_INSTI_PERF",
    "MBS_IN_RESEARCH_RPT",
]
