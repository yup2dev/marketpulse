"""
Industry Catalog Models — 산업 화면의 산업 → 데이터셋 → 계열 정의와 관련 기업 연결.

한 데이터셋 = provider 모델 하나(`/api/data/{provider}/{model}`) + 고정 파라미터,
계열(차트 위 칩) = 그 모델을 부를 때 덧붙일 파라미터 (예: category=semiconductor, measure=inventory).
파라미터는 user_widget_param_options.option_params 와 같은 쿼리스트링 형식이다.

기본 제공 행은 commands/industry/seed.py — 서비스가 처음 읽을 때 DB 에 없는 행만 넣는다
(화면 그룹 기본 행 builtin_screen_groups.json 과 같은 방식). 이미 있는 행은 건드리지 않으니 고칠 때는 DB 행을 고친다.
"""
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String

from app.backend.models.orm import Base


class Industry(Base):
    """산업 — 화면 왼쪽 목록 한 줄."""
    __tablename__ = 'industries'

    industry_code = Column(String(30), primary_key=True)      # 'semiconductor'
    name = Column(String(100), nullable=False)               # '반도체'
    sort_seq = Column(Integer, nullable=False, default=0)
    new_yn = Column(String(1), nullable=False, default='N')  # 목록에 NEW 표시
    use_yn = Column(String(1), nullable=False, default='Y')  # N 이면 숨김

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class IndustryDataset(Base):
    """데이터셋 — 산업 안의 한 통계 (provider 모델 하나 + 고정 파라미터)."""
    __tablename__ = 'industry_datasets'

    dataset_id = Column(String(50), primary_key=True)         # 'semi-exports'
    industry_code = Column(String(30), ForeignKey('industries.industry_code', ondelete='CASCADE'),
                           nullable=False, index=True)
    group_name = Column(String(50))                          # 목록 안의 묶음 ('수출' · '생산')
    name = Column(String(200), nullable=False)               # '반도체 수출: 품목별 (월)'
    provider = Column(String(50), nullable=False)            # 'kosis'
    model = Column(String(100), nullable=False)              # 'ict_exports'
    params = Column(String(300))                             # 모든 계열에 붙는 파라미터 'flow=export'
    frequency = Column(String(1), nullable=False, default='M')   # M 월 · Q 분기 · Y 연
    unit = Column(String(30))                                # 'USD' · '2020=100'
    source = Column(String(100))                             # 출처 기관
    note = Column(String(300))                               # 비고 (기준 · 범위)
    sort_seq = Column(Integer, nullable=False, default=0)
    use_yn = Column(String(1), nullable=False, default='Y')

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class IndustryDatasetSeries(Base):
    """계열 — 데이터셋 차트 위 칩 하나 (그 모델을 부를 때 덧붙일 파라미터)."""
    __tablename__ = 'industry_dataset_series'

    dataset_id = Column(String(50), ForeignKey('industry_datasets.dataset_id', ondelete='CASCADE'),
                        primary_key=True)
    series_seq = Column(Integer, primary_key=True)
    series_code = Column(String(50), nullable=False)         # 'dram'
    label = Column(String(100), nullable=False)              # 'DRAM'
    series_params = Column(String(300), nullable=False)      # 'category=dram'


class IndustrySector(Base):
    """관련 기업 연결 — 종목 마스터(mbs_in_stbd_mst)의 업종 값과 대조한다."""
    __tablename__ = 'industry_sectors'

    industry_code = Column(String(30), ForeignKey('industries.industry_code', ondelete='CASCADE'),
                           primary_key=True)
    market = Column(String(10), primary_key=True)            # 'KR' · 'US' (= mbs_in_stbd_mst.country)
    sector_name = Column(String(200), primary_key=True)      # '반도체 제조업' · 'Semiconductors'
    match_field = Column(String(20), nullable=False, default='sector')   # 대조할 컬럼: sector(KR KSIC) · industry(US GICS)
