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


class MBS_IN_FX_STBD(Base):
    """환율 일별 상태판 — 배치(FXRateCollector)가 적재. rate = base_curr 1단위당 quote_curr."""

    __tablename__ = 'mbs_in_fx_stbd'

    id = Column(Integer, primary_key=True, autoincrement=True)
    fx_cd = Column(String(20), nullable=False, index=True)       # 'USDKRW'
    base_curr = Column(String(10), nullable=False)
    quote_curr = Column(String(10), nullable=False)
    rate = Column(DECIMAL(20, 6), nullable=False)
    change_rate = Column(DECIMAL(10, 4))                         # 전일比 (%)
    base_ymd = Column(Date, nullable=False, index=True)


class MBS_IN_STK_PROFILE(Base):
    """종목 상세 프로필 — 배치(load_profiles 등)가 적재."""

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


class MBS_IN_STK_RELATIONS(Base):
    """종목 관계 (공급망 · 경쟁 · 지분 등) — 배치(load_all_relations)가 적재."""

    __tablename__ = 'mbs_in_stk_relations'

    id = Column(Integer, primary_key=True, autoincrement=True)
    stk_cd = Column(String(20), nullable=False, index=True)
    related_cd = Column(String(20), nullable=False, index=True)
    relation_type = Column(String(30), nullable=False, index=True)
    related_nm = Column(String(200))
    detail = Column(Text)
    confidence = Column(DECIMAL(5, 4), default=1.0)
    data_source = Column(String(50))


class MBS_IN_FINANCIAL_METRICS(Base):
    """기업 재무지표 — 배치가 적재."""

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


class MBS_IN_ARTICLE(Base):
    """뉴스 기사 원본 — 크롤 worker 가 적재."""

    __tablename__ = 'mbs_in_article'

    news_id = Column(String(50), primary_key=True)
    base_ymd = Column(Date, nullable=False, index=True)
    source_cd = Column(String(50), nullable=False, index=True)
    url = Column(Text)
    title = Column(Text, nullable=False)
    publish_dt = Column(DateTime, index=True)


class MBS_PROC_ARTICLE(Base):
    """기사 분석 결과 (종목 매핑 · 감성 · 가격 영향) — worker PROC 단계가 적재."""

    __tablename__ = 'mbs_proc_article'

    proc_id = Column(String(50), primary_key=True)
    news_id = Column(String(50), nullable=False, index=True)
    stk_cd = Column(String(20), index=True)
    summary_text = Column(Text)
    match_score = Column(DECIMAL(10, 4))
    price_impact = Column(DECIMAL(10, 4))
    sentiment_score = Column(DECIMAL(10, 4))
    price = Column(DECIMAL(20, 4))
    base_ymd = Column(Date, nullable=False, index=True)


class MBS_IN_QUANT_SNAPSHOT(Base):
    """퀀트 산출물 스냅샷 — 배치(build_quant)가 학습 · 검증 결과를 적재. payload · meta 는 JSON 글."""

    __tablename__ = 'mbs_in_quant_snapshot'

    id = Column(Integer, primary_key=True, autoincrement=True)
    universe = Column(String(30), nullable=False, index=True)
    dataset = Column(String(30), nullable=False)
    base_ymd = Column(Date, nullable=False)
    payload = Column(Text, nullable=False)
    meta = Column(Text)


class MBS_IN_QUANT_PANEL(Base):
    """퀀트 월별 패널 (월말 × 종목) — 팩터 z · ML 확률 · 다음 달 수익률. 배치(build_quant)가 적재."""

    __tablename__ = 'mbs_in_quant_panel'

    id = Column(Integer, primary_key=True, autoincrement=True)
    universe = Column(String(30), nullable=False)
    base_ymd = Column(Date, nullable=False)
    stk_cd = Column(String(20), nullable=False)
    close = Column(Float)
    fwd_ret = Column(Float)
    mom_12_1 = Column(Float)
    mom_6_1 = Column(Float)
    rev_1m = Column(Float)
    lowvol = Column(Float)
    high52 = Column(Float)
    trend = Column(Float)
    p_gbt = Column(Float)
    p_mlp = Column(Float)
    p_logit = Column(Float)
    p_avg = Column(Float)
    p_stack = Column(Float)


class MBS_IN_INSTI_PORT_HIST(Base):
    """기관 13F 포트폴리오 요약 — 분기 이력. 한 행 = 기관 × 보고 분기(period).

    MBS_IN_INSTI_PORT 는 최신 1건만 두고, 지난 분기 조회(위젯 기준 분기 선택)는 이 테이블을 읽는다.
    13F-HR 원본은 분기가 지나면 바뀌지 않으므로 배치는 없는 분기만 추가한다.
    base_ymd 는 적재일 — 클라우드 동기화 증분 기준.
    """

    __tablename__ = 'mbs_in_insti_port_hist'

    institution_key = Column(String(100), primary_key=True)
    period = Column(String(20), primary_key=True)          # 보고 분기말 (YYYY-MM-DD, SEC reportDate)
    id = Column(String(120))
    manager = Column(String(300))
    name = Column(String(300))
    description = Column(Text)
    total_value = Column(Float)
    num_holdings = Column(Integer)
    filing_date = Column(String(20))
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
    top_sectors = Column(JSON)
    base_ymd = Column(Date, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class MBS_IN_INSTI_HOLD_HIST(Base):
    """기관 13F 보유 종목 — 분기 이력 (MBS_IN_INSTI_HOLD 와 같은 필드 + period)."""

    __tablename__ = 'mbs_in_insti_hold_hist'

    institution_key = Column(String(100), primary_key=True)
    period = Column(String(20), primary_key=True)
    is_sold = Column(Boolean, primary_key=True, default=False)
    seq = Column(Integer, primary_key=True)
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
    base_ymd = Column(Date, index=True)


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
    "MBS_IN_INSTI_PORT_HIST",
    "MBS_IN_INSTI_HOLD_HIST",
    "MBS_IN_INSTI_PERF",
    "MBS_IN_RESEARCH_RPT",
    "MBS_IN_FX_STBD",
    "MBS_IN_STK_PROFILE",
    "MBS_IN_STK_RELATIONS",
    "MBS_IN_FINANCIAL_METRICS",
    "MBS_IN_ARTICLE",
    "MBS_PROC_ARTICLE",
    "MBS_IN_QUANT_SNAPSHOT",
    "MBS_IN_QUANT_PANEL",
]
