"""데이터 카탈로그 — Fetcher 등록 정보 → DB 표, 깨진 위젯 점검, 복사한 위젯의 원본 상태."""
import uuid

import pytest

from app.backend.core.auth.security import create_access_token
from app.backend.models.orm import (
    DataModelField, DataModelParam, DataModelProvider, DataSource, User, UserWidget, UserWidgetField,
    UserWidgetOrigin, UserWidgetParam,
)
from app.backend.services import data_catalog
from app.backend.services.builtin_widgets import load_specs
from app.backend.services.user_widget_service import BuiltinWidgetService


def _registry(fields=("date", "value"), params=("series_id",), pairs=(("fred", "series"),)):
    sources = {p: {"name": p.upper(), "description": None, "key": True} for p, _ in pairs}
    entry = {
        "params": [{"name": n, "kind": "text", "required": True, "default": None,
                    "choices": None, "dynamic": False, "hint": None} for n in params],
        "fields": [{"name": n, "kind": "number", "description": None} for n in fields],
    }
    return sources, {pair: entry for pair in pairs}


def _widget(db, fields=("date", "value"), params=("series_id",), provider="fred", model="series"):
    w = UserWidget(widget_id=f"uw_{uuid.uuid4().hex[:8]}", user_id=None, name="t",
                   provider=provider, model=model, view_type="line")
    w.fields = [UserWidgetField(field_seq=i, field_name=n) for i, n in enumerate(fields)]
    w.params = [UserWidgetParam(param_seq=i, param_name=n, param_value="x") for i, n in enumerate(params)]
    db.add(w)
    db.commit()
    return w


def test_sync_writes_rows_and_is_idempotent(db_session):
    first = data_catalog.sync_catalog(db_session, _registry())
    assert first["added"] == ["fred/series"]
    assert db_session.get(DataSource, "fred").key_yn == "Y"
    assert [f.field_name for f in db_session.query(DataModelField).order_by(DataModelField.field_seq)] == ["date", "value"]
    assert db_session.get(DataModelParam, ("fred", "series", "series_id")).required_yn == "Y"

    again = data_catalog.sync_catalog(db_session, _registry())
    assert again["added"] == again["changed"] == again["removed"] == []


def test_rows_are_never_deleted_only_marked(db_session):
    data_catalog.sync_catalog(db_session, _registry(fields=("date", "value", "old")))
    summary = data_catalog.sync_catalog(db_session, _registry(fields=("date", "value")))
    assert summary["changed"] == ["fred/series"]
    assert db_session.get(DataModelField, ("fred", "series", "old")).use_yn == "N"

    # 다시 생기면 되살아난다
    data_catalog.sync_catalog(db_session, _registry(fields=("date", "value", "old")))
    assert db_session.get(DataModelField, ("fred", "series", "old")).use_yn == "Y"

    # 등록에서 빠진 출처 · 쌍
    data_catalog.sync_catalog(db_session, _registry(pairs=(("fmp", "series"),)))
    assert db_session.get(DataSource, "fred").use_yn == "N"
    assert db_session.get(DataModelProvider, ("fred", "series")).use_yn == "N"


def test_broken_widgets(db_session):
    assert data_catalog.find_broken_widgets(db_session) == {"synced": False, "widgets": []}

    data_catalog.sync_catalog(db_session, _registry(fields=("date", "value", "gone"), params=("series_id", "freq")))
    ok = _widget(db_session)
    bad = _widget(db_session, fields=("date", "gone", "extra"), params=("freq",))
    lost = _widget(db_session, provider="fred", model="nope")
    data_catalog.sync_catalog(db_session, _registry())   # gone · freq 가 빠졌다

    report = data_catalog.find_broken_widgets(db_session)
    by_id = {w["widget_id"]: w for w in report["widgets"]}
    assert ok.widget_id not in by_id
    assert {(p["kind"], p["name"], p["level"]) for p in by_id[bad.widget_id]["problems"]} == {
        ("field", "gone", "error"), ("field", "extra", "warn"), ("param", "freq", "error"),
    }
    assert by_id[lost.widget_id]["problems"][0]["kind"] == "api"


def test_real_registry_reads_known_models():
    sources, pairs = data_catalog.read_registry()
    assert "fred" in sources
    entry = pairs[("fred", "series")]
    assert "series_id" in {p["name"] for p in entry["params"]}
    assert entry["fields"]


def test_catalog_api(auth_client, db_session):
    client, _ = auth_client
    data_catalog.sync_catalog(db_session, _registry())
    items = client.get("/api/user-widgets/catalog").json()["items"]
    assert items == [{"provider": "fred", "model": "series", "provider_name": "FRED", "key_yn": "Y",
                      "param_count": 1, "field_count": 2}]
    entry = client.get("/api/user-widgets/catalog/fred/series").json()
    assert [f["field_name"] for f in entry["fields"]] == ["date", "value"]
    assert client.get("/api/user-widgets/catalog/fred/nope").status_code == 404


@pytest.fixture
def admin(db_session):
    admin_id = str(uuid.uuid4())
    db_session.add(User(user_id=admin_id, email="admin@example.com", username="admin",
                        hashed_password="x", is_active=True, role="admin"))
    db_session.commit()
    return {"Authorization": f"Bearer {create_access_token({'sub': admin_id})}"}


def test_admin_endpoints(auth_client, admin):
    client, _ = auth_client
    assert client.post("/api/admin/data-catalog/sync").status_code == 403
    r = client.post("/api/admin/data-catalog/sync", headers=admin)
    assert r.status_code == 200, r.text
    assert r.json()["pairs"] > 0
    r = client.get("/api/admin/data-catalog/broken-widgets", headers=admin)
    assert r.status_code == 200 and r.json()["synced"] is True


def test_copied_widget_reports_origin_updates(auth_client, db_session):
    client, _ = auth_client
    BuiltinWidgetService.list(db_session)   # 기본 위젯을 파일에서 넣는다
    origin_id = load_specs()[0]["widget_id"]
    body = {
        "name": "copy", "provider": "fred", "model": "series", "view_type": "line",
        "params": [{"param_name": "series_id", "bind_type": "FIXED", "param_value": "DGS10"}],
        "fields": [], "origin_widget_id": origin_id,
    }
    r = client.post("/api/user-widgets", json=body)
    assert r.status_code == 201, r.text
    assert r.json()["origin"] == {"widget_id": origin_id, "missing": False, "updated": False}
    assert db_session.get(UserWidgetOrigin, r.json()["widget_id"]) is not None

    db_session.get(UserWidget, origin_id).name = "원본을 고침"
    db_session.commit()
    mine = client.get("/api/user-widgets").json()["widgets"]
    assert mine[0]["origin"]["updated"] is True

    assert client.post("/api/user-widgets", json={**body, "origin_widget_id": "nope"}).status_code == 400
