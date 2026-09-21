"""ORM metadata 완전성 + alembic baseline 동기화 테스트.

이 두 가지가 어긋나면 조용히 데이터가 날아간다:

  1. metadata 누락 — 모델이 `Base.metadata` 에 등록되지 않으면
     alembic autogenerate 가 그 테이블을 '삭제됨'으로 보고 **DROP TABLE 을 생성한다.**
     실제로 menu_management(31행), quant_factors 가 그렇게 잡힌 적이 있다.

  2. 모델/마이그레이션 드리프트 — 모델만 고치고 리비전을 만들지 않으면
     새 환경(Docker 재빌드, 신규 개발자)의 스키마가 코드와 달라진다.
"""
import pytest


def test_all_model_modules_are_registered():
    """`__tablename__` 을 가진 모든 모델이 Base.metadata 에 등록돼야 한다.

    models/ 아래 파일을 전부 import 한 뒤의 metadata 와, all_models.py 만 import 했을
    때의 metadata 가 같아야 한다. 새 모델 파일을 만들고 all_models.py 에 추가하는 것을
    잊으면 여기서 걸린다.
    """
    import importlib
    import pkgutil

    from index_analyzer.models.all_models import Base

    registered = set(Base.metadata.tables)

    # models 패키지 전체를 훑어 import (등록 부작용 유발)
    import index_analyzer.models as models_pkg

    for mod_info in pkgutil.walk_packages(models_pkg.__path__, f"{models_pkg.__name__}."):
        try:
            importlib.import_module(mod_info.name)
        except Exception:
            # 선택적 의존성이 없는 모듈은 건너뛴다 (등록 대상이 아니다)
            continue

    after_full_import = set(Base.metadata.tables)
    missing = after_full_import - registered

    assert not missing, (
        f"all_models.py 에 import 가 빠진 모델 테이블: {sorted(missing)} — "
        "추가하지 않으면 alembic autogenerate 가 DROP TABLE 을 생성한다"
    )


def test_known_out_of_package_models_are_present():
    """orm/ 바깥 모델이 실제로 등록되는지 명시적으로 확인한다."""
    from index_analyzer.models.all_models import Base

    for table in ("menu_management", "quant_factors", "quant_factor_catalog"):
        assert table in Base.metadata.tables, (
            f"{table} 이 metadata 에 없다 — all_models.py import 확인"
        )


def test_backtest_tables_registered():
    """백테스트 랩 테이블이 등록돼 있어야 한다 (최근 추가분)."""
    from index_analyzer.models.all_models import Base

    assert "user_backtest_items" in Base.metadata.tables
    assert "user_backtest_runs" in Base.metadata.tables


def test_alembic_baseline_matches_models(tmp_path):
    """빈 DB에 `alembic upgrade head` 한 결과가 모델과 일치해야 한다.

    모델을 바꾸고 리비전을 만들지 않으면 여기서 차이가 잡힌다:
        alembic revision --autogenerate -m "설명"
    """
    from alembic import command
    from alembic.autogenerate import compare_metadata
    from alembic.config import Config
    from alembic.migration import MigrationContext
    from sqlalchemy import create_engine

    from index_analyzer.models.all_models import Base
    from migrations.orphan_tables import include_object

    db_path = tmp_path / "schema_check.db"
    url = f"sqlite:///{db_path}"

    cfg = Config("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", url)
    # env.py 는 DATABASE_URL 을 우선한다 — 테스트 DB로 향하게 한다
    import os

    prev = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = url
    try:
        command.upgrade(cfg, "head")

        engine = create_engine(url)
        with engine.connect() as conn:
            ctx = MigrationContext.configure(
                conn,
                opts={"compare_type": True, "include_object": include_object},
            )
            diff = compare_metadata(ctx, Base.metadata)
        engine.dispose()
    finally:
        if prev is None:
            os.environ.pop("DATABASE_URL", None)
        else:
            os.environ["DATABASE_URL"] = prev

    assert not diff, (
        "모델과 마이그레이션이 어긋났다. 아래 차이를 반영할 리비전을 만들어라:\n"
        f"  alembic revision --autogenerate -m \"설명\"\n\n차이: {diff}"
    )
