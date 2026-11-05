"""배치 → 웹 ingest 계약 테스트.

웹과 배치는 ORM 을 공유하지 않는다. 같은 테이블을 각자 정의하고, 배치는 로컬 DB 의 행을
`jobs/sync_db_to_cloud.py` 로 `/api/ingest/{table}` 에 보낸다. 둘이 맞춰야 하는 건
이 요청 형식 하나다.

왜 테스트가 필요한가:
    웹 `_coerce_row` 는 모델에 없는 키를 **조용히 버린다.** 배치에만 컬럼을 추가하면
    에러 없이 그 컬럼 데이터가 클라우드에 안 올라간다. 반대로 웹에만 NOT NULL 컬럼을
    추가하면 동기화가 INSERT 에서 깨진다.

fetcher 의 database provider 도 같은 DB 를 읽으므로 같은 기준으로 검사한다.
스키마의 주인은 웹이다 (alembic 이 웹 metadata 를 본다).
"""
import importlib.util
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SERVER_MANAGED = {"id", "created_at", "updated_at"}


def _load_sync_module():
    path = ROOT / "MarketpulseBatch" / "jobs" / "sync_db_to_cloud.py"
    spec = importlib.util.spec_from_file_location("_sync_db_to_cloud", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _tables(base):
    return {name: table for name, table in base.metadata.tables.items()}


@pytest.fixture(scope="module")
def sync_tables():
    return _load_sync_module().TABLES


@pytest.fixture(scope="module")
def web_whitelist():
    from app.backend.api.routes.ingest import _TABLES

    return _TABLES


@pytest.fixture(scope="module")
def batch_tables():
    from index_analyzer.db.orm import Base

    return _tables(Base)


@pytest.fixture(scope="module")
def web_tables():
    from app.backend.models.all_models import Base

    return _tables(Base)


def _cols(table):
    return {c.name: c for c in table.columns}


def test_sync_and_ingest_whitelist_match(sync_tables, web_whitelist):
    assert set(sync_tables) == set(web_whitelist), (
        "sync_db_to_cloud.TABLES 와 웹 /api/ingest _TABLES 가 다르다 — "
        f"배치에만: {set(sync_tables) - set(web_whitelist)}, 웹에만: {set(web_whitelist) - set(sync_tables)}"
    )


def test_synced_tables_exist_on_both_sides(sync_tables, batch_tables, web_tables):
    for name in sync_tables:
        assert name in batch_tables, f"배치 ORM 에 {name} 이 없다"
        assert name in web_tables, f"웹 ORM 에 {name} 이 없다"


def test_batch_columns_are_accepted_by_web(sync_tables, batch_tables, web_tables):
    """배치가 보내는 컬럼은 웹에 같은 이름·같은 타입으로 있어야 한다 (없으면 조용히 버려짐)."""
    problems = []
    for name in sync_tables:
        b, w = _cols(batch_tables[name]), _cols(web_tables[name])
        for col, bc in b.items():
            if col in SERVER_MANAGED:
                continue
            if col not in w:
                problems.append(f"{name}.{col}: 웹에 없음 → 동기화 시 버려진다")
            elif str(bc.type) != str(w[col].type):
                problems.append(f"{name}.{col}: 타입 다름 (배치 {bc.type} / 웹 {w[col].type})")
    assert not problems, "\n".join(problems)


def test_web_required_columns_are_sent_by_batch(sync_tables, batch_tables, web_tables):
    """웹의 NOT NULL·기본값 없는 컬럼은 배치가 보내야 한다 (안 보내면 INSERT 실패)."""
    problems = []
    for name in sync_tables:
        b, w = _cols(batch_tables[name]), _cols(web_tables[name])
        for col, wc in w.items():
            if col in SERVER_MANAGED or col in b:
                continue
            if not wc.nullable and wc.default is None and wc.server_default is None:
                problems.append(f"{name}.{col}: 웹은 필수인데 배치가 보내지 않는다")
    assert not problems, "\n".join(problems)


def test_upsert_keys_exist_in_batch(web_whitelist, batch_tables):
    for name, cfg in web_whitelist.items():
        keys = cfg.get("conflict") or [cfg["replace_by"]]
        missing = [k for k in keys if k not in batch_tables[name].columns]
        assert not missing, f"{name}: upsert 키 {missing} 가 배치 테이블에 없다"


def test_sync_options_reference_real_columns(sync_tables, batch_tables):
    for name, cfg in sync_tables.items():
        for opt in ("incremental", "group_by"):
            col = cfg.get(opt)
            if col:
                assert col in batch_tables[name].columns, f"{name}: {opt}={col} 컬럼이 없다"


def test_fetcher_read_models_match_web():
    """fetcher database provider 의 읽기 모델은 웹 스키마의 부분집합이어야 한다."""
    from data_fetcher.providers.database.schema import Base as FetcherBase

    from app.backend.models.all_models import Base as WebBase

    web = _tables(WebBase)
    problems = []
    for name, table in _tables(FetcherBase).items():
        if name not in web:
            problems.append(f"{name}: 웹에 없는 테이블")
            continue
        w = _cols(web[name])
        for col, fc in _cols(table).items():
            if col not in w:
                problems.append(f"{name}.{col}: 웹에 없음")
            elif str(fc.type) != str(w[col].type):
                problems.append(f"{name}.{col}: 타입 다름 (fetcher {fc.type} / 웹 {w[col].type})")
    assert not problems, "\n".join(problems)
