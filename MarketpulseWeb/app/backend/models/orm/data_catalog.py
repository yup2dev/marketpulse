"""데이터 카탈로그 — 위젯이 고를 수 있는 데이터(API)의 목록. 사람이 고치지 않는다.

Fetcher 등록 정보(ProviderRegistry · provider_catalog)와 pydantic 모델에서 읽어 서버가 채운다
(services/data_catalog.sync_catalog — 기동할 때 · 관리자 POST /api/admin/data-catalog/sync).

    data_sources            출처 (fred · kis …)
    data_models             표준 모델 (series · quote …) — 이름만
    data_model_providers    (provider, model) — 이 출처가 이 모델을 준다. 모델 하나를 여러 출처가 준다 (N:M)
    data_model_params       (provider, model, param_name) — 같은 모델이라도 출처마다 QueryParams 가 다르다
    data_model_fields       (provider, model, field_name) — 출처마다 Data 모델이 다르다
    data_model_hints        파라미터 다중 선택 · 필드 표시 힌트 (힌트가 있는 것만 행)
    data_model_routes       local fetcher 의 서버 긴급 전환 — 이것만 사람이 고친다 (아래 DataModelRoute)

행은 지우지 않는다 — 등록에서 빠지면 use_yn='N'. 위젯(user_widgets · user_widget_fields)은 이름 문자열로
이 표를 가리키므로, 빠진 API · 필드를 쓰는 위젯은 data_catalog.find_broken_widgets 가 조인으로 찾는다.
(SQLite 는 PRAGMA foreign_keys 를 켜지 않아 FK 를 검사하지 않는다 — 점검은 쿼리로 한다.)
"""
from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, ForeignKeyConstraint, Integer, String, Text

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


class DataModelHint(Base):
    """파라미터 · 필드의 화면 힌트 — 위젯 만드는 화면의 초안이 쓴다. 힌트가 있는 파라미터 · 필드만 행을 둔다.

        target='param'  multiple_yn — 쉼표로 여러 값 (QueryParams __json_schema_extra__ 의 multiple_items_allowed)
        target='field'  unit · multiply · prefix · suffix · hidden_yn — Data 필드 json_schema_extra
                        (x-unit_measurement · x-frontend_multiply · x-widget_config)

    data_model_params · data_model_fields 에 칼럼을 더하지 않고 표를 따로 둔 이유: 운영 서버는 기동할 때 create_all 로
    없는 표만 만든다 — 있는 표에 칼럼을 더하면 수동 마이그레이션 전까지 카탈로그 조회가 깨진다.
    """
    __tablename__ = 'data_model_hints'

    provider = Column(String(50), primary_key=True)
    model = Column(String(100), primary_key=True)
    target = Column(String(5), primary_key=True)            # param · field
    name = Column(String(100), primary_key=True)
    multiple_yn = Column(String(1), nullable=False, default='N')
    unit = Column(String(20))                               # percent · currency · …
    multiply = Column(Float)                                # 화면에 보일 때 곱할 값
    prefix = Column(String(10))
    suffix = Column(String(10))
    hidden_yn = Column(String(1), nullable=False, default='N')


class DataModelRoute(Base):
    """로컬 → 서버 긴급 전환 — 사람이 고치는 설정 (위 카탈로그 표들과 달리 동기화가 덮어쓰지 않는다).

    실행 위치는 fetcher 의 target 이 정한다 (local = 사용자 PC Fetcher, server = 서버). 이 표는 평소 비어 있고,
    target="local" fetcher 를 배포 없이 서버에서 돌려야 할 때만(서버 IP 차단이 풀렸을 때 · PC Worker 장애) 행을 둔다.

        local_yn = N  긴급 전환 중 — target="local" 이지만 서버 fetcher 로 직접 실행 + 서버 캐시
        (local_yn = Y 는 쓰지 않는다 — server → local 은 fetcher target 을 바꾸고 exe 를 다시 배포한다)

    읽는 곳: core/execution (실행 계층). fetcher 패키지는 이 표를 모른다.
    기동할 때 core/execution/routes.cleanup 이 기본값과 같아 뜻이 없는 행을 지운다.
    """
    __tablename__ = 'data_model_routes'

    provider = Column(String(50), primary_key=True)
    model = Column(String(100), primary_key=True)
    local_yn = Column(String(1), nullable=False, default='N')
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by = Column(String(50))                           # 관리자 user_id (기동 시 넣은 행은 비어 있다)
