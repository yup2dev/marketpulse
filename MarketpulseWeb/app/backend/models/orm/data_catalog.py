"""데이터 카탈로그 — 위젯이 고를 수 있는 데이터(API)의 목록. 사람이 고치지 않는다.

Fetcher 등록 정보(ProviderRegistry · provider_catalog)와 pydantic 모델에서 읽어 서버가 채운다
(services/data_catalog.sync_catalog — 기동할 때 · 관리자 POST /api/admin/data-catalog/sync).

    data_sources            출처 (fred · kis …)
    data_models             표준 모델 (series · quote …) — 이름만
    data_model_providers    (provider, model) — 이 출처가 이 모델을 준다. 모델 하나를 여러 출처가 준다 (N:M)
    data_model_params       (provider, model, param_name) — 같은 모델이라도 출처마다 QueryParams 가 다르다
    data_model_fields       (provider, model, field_name) — 출처마다 Data 모델이 다르다

행은 지우지 않는다 — 등록에서 빠지면 use_yn='N'. 위젯(user_widgets · user_widget_fields)은 이름 문자열로
이 표를 가리키므로, 빠진 API · 필드를 쓰는 위젯은 data_catalog.find_broken_widgets 가 조인으로 찾는다.
(SQLite 는 PRAGMA foreign_keys 를 켜지 않아 FK 를 검사하지 않는다 — 점검은 쿼리로 한다.)
"""
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, ForeignKeyConstraint, Integer, String, Text

from .base import Base


class DataSource(Base):
    __tablename__ = 'data_sources'

    provider = Column(String(50), primary_key=True)
    name = Column(String(100), nullable=False)             # 표시 이름 (provider_catalog)
    description = Column(String(300))
    key_yn = Column(String(1), nullable=False, default='N')   # Y = 사용자 API 키가 있어야 부른다
    use_yn = Column(String(1), nullable=False, default='Y')   # N = 등록에서 빠짐
    synced_at = Column(DateTime, default=datetime.utcnow)


class DataModel(Base):
    __tablename__ = 'data_models'

    model = Column(String(100), primary_key=True)
    use_yn = Column(String(1), nullable=False, default='Y')   # N = 어느 출처도 주지 않음
    synced_at = Column(DateTime, default=datetime.utcnow)


class DataModelProvider(Base):
    __tablename__ = 'data_model_providers'

    provider = Column(String(50), ForeignKey('data_sources.provider'), primary_key=True)
    model = Column(String(100), ForeignKey('data_models.model'), primary_key=True)
    schema_hash = Column(String(64), nullable=False)        # 파라미터 · 필드의 지문 — 바뀐 쌍만 다시 적는다
    use_yn = Column(String(1), nullable=False, default='Y')
    synced_at = Column(DateTime, default=datetime.utcnow)


class DataModelParam(Base):
    __tablename__ = 'data_model_params'
    __table_args__ = (
        ForeignKeyConstraint(
            ['provider', 'model'],
            ['data_model_providers.provider', 'data_model_providers.model'],
        ),
    )

    provider = Column(String(50), primary_key=True)
    model = Column(String(100), primary_key=True)
    param_name = Column(String(100), primary_key=True)
    param_seq = Column(Integer, nullable=False, default=0)
    kind = Column(String(10), nullable=False)               # select · number · date · text
    required_yn = Column(String(1), nullable=False, default='N')
    default_value = Column(String(500))
    choices = Column(Text)                                  # 정적 선택지 JSON 배열 (값 또는 {value, label})
    dynamic_yn = Column(String(1), nullable=False, default='N')   # Y = 이 모델은 선택지를 그때그때 받는다 — /schema 로 본다
    hint = Column(String(500))
    use_yn = Column(String(1), nullable=False, default='Y')


class DataModelField(Base):
    __tablename__ = 'data_model_fields'
    __table_args__ = (
        ForeignKeyConstraint(
            ['provider', 'model'],
            ['data_model_providers.provider', 'data_model_providers.model'],
        ),
    )

    provider = Column(String(50), primary_key=True)
    model = Column(String(100), primary_key=True)
    field_name = Column(String(100), primary_key=True)
    field_seq = Column(Integer, nullable=False, default=0)
    kind = Column(String(10), nullable=False)               # number · date · bool · text
    description = Column(String(500))
    use_yn = Column(String(1), nullable=False, default='Y')
