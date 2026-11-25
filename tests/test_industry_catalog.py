"""산업 카탈로그 — 시드가 실제 provider 모델과 맞는지 · API 응답 모양 · OpenAPI 행 스키마.

시드의 category · measure · flow 값이 KOSIS 모델 코드 맵에 없으면 화면에서 '오류'로만 보이고
늦게 발견된다 — 여기서 그 모델의 QueryParams 검증을 그대로 돌려 막는다.
"""
import importlib.util
import pathlib

import pytest

import data_fetcher.providers_init  # noqa: F401
from data_fetcher.abstract_provider.abstract.provider import ProviderRegistry
from app.backend.commands.industry.seed import INDUSTRIES

ROOT = pathlib.Path(__file__).resolve().parents[1]


def _datasets():
    for ind in INDUSTRIES:
        for ds in ind["datasets"]:
            yield ind["industry_code"], ds


def test_seed_codes_are_unique():
    codes = [i["industry_code"] for i in INDUSTRIES]
    ids = [ds["dataset_id"] for _, ds in _datasets()]
    assert len(codes) == len(set(codes)) and len(ids) == len(set(ids))
    for _, ds in _datasets():
        series = [s["series_code"] for s in ds["series"]]
        assert series and len(series) == len(set(series)), ds["dataset_id"]


@pytest.mark.parametrize("industry,ds", list(_datasets()), ids=lambda v: v if isinstance(v, str) else v["dataset_id"])
def test_every_series_is_a_valid_provider_query(industry, ds):
    """데이터셋 params + 계열 params 로 그 모델의 QueryParams 가 만들어져야 한다 (모르는 코드면 실패)."""
    from urllib.parse import parse_qsl

    provider = ProviderRegistry.get(ds.get("provider", "kosis"))
    fetcher = provider.fetcher_dict[ds["model"]]
    base = dict(parse_qsl(ds["params"]))
    for s in ds["series"]:
        params = {**base, **dict(parse_qsl(s["series_params"]))}
        fetcher.transform_query(params)          # 검증 실패면 예외


def test_api_lists_industries_and_datasets(auth_client):
    client, _ = auth_client
    r = client.get("/api/industry")
    assert r.status_code == 200
    body = r.json()
    assert body["provider"] == "industry"
    by_code = {i["industry"]: i for i in body["results"]}
    assert list(by_code) == [i["industry_code"] for i in INDUSTRIES]           # 시드 순서
    assert by_code["semiconductor"]["dataset_count"] == 3
    assert by_code["bio"]["dataset_count"] == 0                                # 준비 중
    assert by_code["battery"]["is_new"] is True
    assert {"market": "KR", "match_field": "sector", "sector_name": "반도체 제조업"} in by_code["semiconductor"]["sectors"]

    r = client.get("/api/industry/datasets", params={"industry": "semiconductor"})
    assert r.status_code == 200
    rows = r.json()["results"]
    assert [d["dataset"] for d in rows] == ["semi-exports", "semi-production", "semi-utilization"]
    exports = rows[0]
    assert (exports["provider"], exports["model"], exports["unit"]) == ("kosis", "ict_exports", "USD")
    assert exports["series"][2] == {"code": "dram", "label": "DRAM", "params": {"category": "dram"}}
    prod = rows[1]
    assert prod["params"] == {"category": "semiconductor"}
    assert [s["params"] for s in prod["series"]] == [{"measure": m} for m in ("production", "shipment", "inventory")]

    all_rows = client.get("/api/industry/datasets").json()["results"]
    assert len(all_rows) == sum(len(i["datasets"]) for i in INDUSTRIES)


def test_seed_runs_once(auth_client, db_session):
    """두 번 읽어도 행이 늘지 않는다 — 있는 산업은 건드리지 않는다."""
    from app.backend.models.industry_catalog import IndustryDataset

    client, _ = auth_client
    client.get("/api/industry")
    n = db_session.query(IndustryDataset).count()
    client.get("/api/industry/datasets")
    assert db_session.query(IndustryDataset).count() == n


def test_openapi_publishes_row_schema():
    """OBBject[List[IndustryDatasetOut]] — 응답 스키마에 행 모델이 나온다."""
    from app.backend.main import app

    spec = app.openapi()
    ref = spec["paths"]["/api/industry/datasets"]["get"]["responses"]["200"]["content"]["application/json"]["schema"]["$ref"]
    envelope = spec["components"]["schemas"][ref.rsplit("/", 1)[-1]]
    assert envelope["properties"]["results"]["items"] == {"$ref": "#/components/schemas/IndustryDatasetOut"}
    assert "series" in spec["components"]["schemas"]["IndustryDatasetOut"]["properties"]


def test_migration_matches_orm_tables():
    """alembic 리비전이 ORM 과 같은 테이블 · 컬럼을 만든다."""
    from app.backend.models.industry_catalog import Industry, IndustryDataset, IndustryDatasetSeries, IndustrySector

    path = next((ROOT / "migrations" / "versions").glob("*_industry_catalog.py"))
    text = path.read_text(encoding="utf-8")
    for model in (Industry, IndustryDataset, IndustryDatasetSeries, IndustrySector):
        assert f"'{model.__tablename__}'" in text
        for col in model.__table__.columns:
            assert f"sa.Column('{col.name}'" in text, f"{model.__tablename__}.{col.name} 가 마이그레이션에 없다"
    spec = importlib.util.spec_from_file_location("m", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    assert mod.down_revision == "d2a8f5c1e9b4"
