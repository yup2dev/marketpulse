"""F11 · F12 — 필드 표시 힌트와 파라미터 다중 선택이 스키마 → 카탈로그 → 위젯 초안까지 간다.

    F11  Data 필드 json_schema_extra: x-unit_measurement · x-frontend_multiply · x-widget_config{prefix, suffix, hidden}
    F12  QueryParams __json_schema_extra__: choices (이미 있음) · multiple_items_allowed → multiple
"""
from typing import Optional

from pydantic import BaseModel, Field

import data_fetcher.providers_init  # noqa: F401 — provider 등록
from app.backend.models.orm import DataModelHint
from app.backend.services import data_catalog
from data_fetcher.abstract_provider.abstract.provider import ProviderRegistry
from data_fetcher.core.model_schema import data_fields, display_hints, model_schema


class _D(BaseModel):
    rate: Optional[float] = Field(default=None, json_schema_extra={"x-unit_measurement": "percent", "x-frontend_multiply": 100})
    price: Optional[float] = Field(default=None, json_schema_extra={"x-widget_config": {"prefix": "$", "suffix": "B"}})
    internal: Optional[str] = Field(default=None, json_schema_extra={"x-widget_config": {"hidden": True}})
    plain: Optional[str] = None


def test_display_hints_from_json_schema_extra():
    f = _D.model_fields
    assert display_hints(f["rate"]) == {"unit": "percent", "multiply": 100}
    assert display_hints(f["price"]) == {"prefix": "$", "suffix": "B"}
    assert display_hints(f["internal"]) == {"hidden": True}
    assert display_hints(f["plain"]) == {}


def test_registered_models_export_hints_and_multiple():
    fred = ProviderRegistry.get("fred").fetcher_dict
    series = {p["name"]: p for p in model_schema(fred["series"], dynamic=False)["params"]}
    assert series["series_id"].get("multiple") is True                     # FRED series_id='DGS2,DGS10'

    quote = {f["name"]: f for f in data_fields(ProviderRegistry.get("fmp").fetcher_dict["quote"])}
    assert quote["change_percent"].get("unit") == "percent"
    assert quote["market_cap"].get("unit") == "currency"


def test_catalog_stores_and_returns_hints(db_session):
    sources = {"fred": {"name": "FRED", "description": None, "key": True}}
    entry = {
        "params": [{"name": "series_id", "kind": "text", "required": True, "default": None, "choices": None,
                    "dynamic": False, "hint": "FRED 시리즈 ID", "multiple": True}],
        "fields": [{"name": "value", "kind": "number", "description": None, "unit": "percent", "multiply": 100.0,
                    "prefix": None, "suffix": "%", "hidden": False},
                   {"name": "series_id", "kind": "text", "description": None, "hidden": True}],
    }
    data_catalog.sync_catalog(db_session, (sources, {("fred", "series"): entry}))
    assert db_session.get(DataModelHint, ("fred", "series", "param", "series_id")).multiple_yn == "Y"
    value = db_session.get(DataModelHint, ("fred", "series", "field", "value"))
    assert (value.unit, value.multiply, value.suffix, value.hidden_yn) == ("percent", 100.0, "%", "N")
    assert db_session.get(DataModelHint, ("fred", "series", "field", "series_id")).hidden_yn == "Y"
    assert db_session.query(DataModelHint).count() == 3                     # 힌트가 있는 것만 행

    got = data_catalog.get_entry(db_session, "fred", "series")
    assert got["params"][0]["multiple_yn"] == "Y"
    by = {f["field_name"]: f for f in got["fields"]}
    assert by["value"]["unit"] == "percent" and by["value"]["multiply"] == 100.0 and by["series_id"]["hidden_yn"] == "Y"

    data_catalog.sync_catalog(db_session, (sources, {("fred", "series"): {**entry, "fields": entry["fields"][:1],
                                                                          "params": [{**entry["params"][0], "multiple": False}]}}))
    assert db_session.query(DataModelHint).count() == 1                     # 다시 쓰면 빠진 힌트는 지워진다


def test_read_registry_carries_hints():
    _sources, pairs = data_catalog.read_registry()
    params = {p["name"]: p for p in pairs[("fred", "series")]["params"]}
    assert params["series_id"]["multiple"] is True
    fields = {f["name"]: f for f in pairs[("fmp", "quote")]["fields"]}
    assert fields["change_percent"]["unit"] == "percent" and fields["change_percent"]["hidden"] is False
