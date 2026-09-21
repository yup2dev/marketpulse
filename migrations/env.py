"""Alembic 환경 설정.

DB URL 은 alembic.ini 에 적지 않고 앱과 같은 소스에서 가져온다 — 두 군데에 적으면
반드시 어긋난다. 우선순위는 다음과 같다:

    1) 환경변수 DATABASE_URL       (운영/CI 에서 주입)
    2) app.backend.core.db 의 SQLite 경로  (개발 기본값, 앱이 실제로 쓰는 그 파일)

target_metadata 는 앱 ORM 의 Base.metadata 를 그대로 쓴다. 그래야 `alembic revision
--autogenerate` 가 모델과 실제 스키마의 차이를 잡아낸다.
"""
import os
import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import engine_from_config, pool

from alembic import context

# 프로젝트 루트를 import 경로에 추가 (alembic 은 루트에서 실행된다)
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# 모든 ORM 모델을 등록시킨다 — import 누락 시 autogenerate 가 테이블을
# '삭제됨'으로 오판해 DROP TABLE 을 생성한다. (실제로 menu_management 31행,
# quant_factors 등이 그렇게 잡힌 적이 있다 — all_models.py 주석 참고)
from index_analyzer.models.all_models import Base  # noqa: E402

# 모델이 없는 채 DB 에만 남아 있는 테이블을 비교에서 제외한다 (orphan_tables.py 참고)
from migrations.orphan_tables import include_object  # noqa: E402

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _database_url() -> str:
    env_url = os.getenv("DATABASE_URL")
    if env_url:
        return env_url
    # 앱이 실제로 여는 파일과 같은 경로를 쓴다 (app/backend/core/db.py 와 동일 규칙)
    db_path = Path(__file__).resolve().parent.parent / "data" / "marketpulse.db"
    return f"sqlite:///{db_path}"


def run_migrations_offline() -> None:
    """`alembic upgrade --sql` 용 — DBAPI 없이 SQL 만 출력한다."""
    context.configure(
        url=_database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        # SQLite 는 ALTER 지원이 빈약해 batch 모드(테이블 재생성)가 필요하다.
        render_as_batch=True,
        compare_type=True,
        include_object=include_object,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    section = config.get_section(config.config_ini_section, {}) or {}
    section["sqlalchemy.url"] = _database_url()

    connectable = engine_from_config(
        section,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,
            compare_type=True,
            include_object=include_object,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
