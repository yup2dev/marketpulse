"""사용자 정의 위젯 — API → 매핑 → 위젯 → 화면 등록.

설정은 마스터(user_widgets) + 파라미터 + 필드 매핑 + 화면 등록, 네 테이블의 행으로 저장된다.
"""
import uuid

import pytest

from app.backend.core.auth.security import create_access_token
from app.backend.models.orm import (
    User, UserWidgetField, UserWidgetParam, UserWidgetPref, UserWidgetPrefScreen, UserWidgetScreen,
)


def _widget(**over):
    body = {
        "name": "My 10Y yield",
        "provider": "fred",
        "model": "series",
        "view_type": "line",
        "group_name": "Rates",
        "params": [
            {"param_name": "series_id", "bind_type": "FIXED", "param_value": "DGS10"},
            {"param_name": "period", "bind_type": "VAR", "var_name": "period", "param_value": "5y"},
            {"param_name": "frequency", "bind_type": "INPUT", "param_value": "monthly"},
        ],
        "fields": [
            {"field_name": "date", "field_role": "X", "format": "date"},
            {"field_name": "value", "field_role": "Y", "label": "10Y", "format": "percent"},
            {"field_name": "series_id", "field_role": "HIDDEN"},
        ],
        "screens": ["/macro", "/"],
    }
    body.update(over)
    return body


def test_codes_drive_the_settings_screen(auth_client):
    client, _ = auth_client
    body = client.get("/api/user-widgets/codes").json()
    assert set(body["codes"]) == {"VIEW_TYPE", "RENDERER", "BIND_TYPE", "FIELD_ROLE", "FIELD_FORMAT"}
    # 위젯 종류는 DB 목록이다 — 처음 읽을 때 그리는 방식마다 하나씩 생긴다
    assert [t["value"] for t in body["codes"]["VIEW_TYPE"]] == [r["value"] for r in body["codes"]["RENDERER"]]
    assert all(t["use_yn"] == "Y" and t["kind"] in ("table", "chart", "kv") for t in body["codes"]["VIEW_TYPE"])
    assert {c["value"] for c in body["codes"]["BIND_TYPE"]} == {"FIXED", "VAR", "INPUT"}
    assert {v["name"] for v in body["variables"]} == {"symbol", "period"}


def test_create_stores_rows_in_order(auth_client, db_session):
    client, _ = auth_client
    r = client.post("/api/user-widgets", json=_widget())
    assert r.status_code == 201, r.text
    w = r.json()

    assert w["widget_id"].startswith("uw_") and w["use_yn"] == "Y" and w["renderer"] == "line"
    assert [p["param_name"] for p in w["params"]] == ["series_id", "period", "frequency"]
    assert [f["field_name"] for f in w["fields"]] == ["date", "value", "series_id"]
    assert w["params"][1]["var_name"] == "period" and w["params"][0]["var_name"] is None
    assert w["screens"] == ["/", "/macro"]

    # JSON 덩어리가 아니라 관심사별 행으로 들어간다
    assert db_session.query(UserWidgetParam).count() == 3
    assert db_session.query(UserWidgetField).count() == 3
    assert db_session.query(UserWidgetScreen).count() == 2


def test_list_by_screen_respects_registration_and_use_yn(auth_client):
    client, _ = auth_client
    a = client.post("/api/user-widgets", json=_widget(name="macro only", screens=["/macro"])).json()
    client.post("/api/user-widgets", json=_widget(name="everywhere", screens=["/stock", "*"]))
    client.post("/api/user-widgets", json=_widget(name="off", screens=["*"], use_yn="N"))

    def names(screen=None):
        qs = f"?screen={screen}" if screen else ""
        return [w["name"] for w in client.get(f"/api/user-widgets{qs}").json()["widgets"]]

    assert names() == ["macro only", "everywhere", "off"]        # 설정 화면은 전부
    assert names("/macro") == ["macro only", "everywhere"]
    assert names("/stock") == ["everywhere"]                     # '*' 는 모든 화면 (나머지는 접힌다)

    client.put(f"/api/user-widgets/{a['widget_id']}", json={"use_yn": "N"})
    assert names("/macro") == ["everywhere"]


def test_partial_update_keeps_what_was_not_sent(auth_client, db_session):
    client, _ = auth_client
    w = client.post("/api/user-widgets", json=_widget()).json()
    wid = w["widget_id"]

    # 토글만 — 자식 행은 그대로
    r = client.put(f"/api/user-widgets/{wid}", json={"use_yn": "N"}).json()
    assert r["use_yn"] == "N" and len(r["params"]) == 3 and len(r["fields"]) == 3

    # 매핑만 교체 — 순서·내용이 통째로 바뀌고 옛 행은 남지 않는다
    r = client.put(f"/api/user-widgets/{wid}", json={
        "view_type": "table",
        "fields": [{"field_name": "value", "label": "Yield"}, {"field_name": "date"}],
    }).json()
    assert [f["field_name"] for f in r["fields"]] == ["value", "date"]
    assert r["fields"][0]["label"] == "Yield" and r["fields"][0]["field_role"] == "COLUMN"
    assert len(r["params"]) == 3 and r["name"] == "My 10Y yield"
    assert db_session.query(UserWidgetField).count() == 2


def test_delete_removes_child_rows(auth_client, db_session):
    client, _ = auth_client
    wid = client.post("/api/user-widgets", json=_widget()).json()["widget_id"]
    assert client.delete(f"/api/user-widgets/{wid}").status_code == 204
    assert client.get("/api/user-widgets").json()["widgets"] == []
    for model in (UserWidgetParam, UserWidgetField, UserWidgetScreen):
        assert db_session.query(model).count() == 0
    assert client.delete(f"/api/user-widgets/{wid}").status_code == 404


@pytest.mark.parametrize("over, msg", [
    ({"provider": "nope"}, "찾을 수 없습니다"),
    ({"model": "nope"}, "찾을 수 없습니다"),
    ({"view_type": "hologram"}, "VIEW_TYPE"),
    ({"params": [{"param_name": "x", "bind_type": "MAGIC"}]}, "BIND_TYPE"),
    ({"params": [{"param_name": "x", "bind_type": "VAR", "var_name": "moon"}]}, "화면 변수"),
    ({"params": [{"param_name": "x", "bind_type": "FIXED"}]}, "고정값"),
    ({"params": [{"param_name": "x", "bind_type": "INPUT"}, {"param_name": "x", "bind_type": "INPUT"}]}, "두 번"),
    ({"fields": [{"field_name": "a", "field_role": "Z"}]}, "FIELD_ROLE"),
    ({"fields": [{"field_name": "a", "format": "emoji"}]}, "FIELD_FORMAT"),
    ({"fields": [{"field_name": "a", "field_role": "X"}, {"field_name": "b", "field_role": "X"}]}, "하나만"),
    ({"fields": [{"field_name": "a", "field_role": "Y"}]}, "함께"),
])
def test_bad_definitions_are_rejected(auth_client, over, msg):
    client, _ = auth_client
    r = client.post("/api/user-widgets", json=_widget(**over))
    assert r.status_code == 400, r.text
    assert msg in r.json()["detail"]
    assert client.get("/api/user-widgets").json()["widgets"] == []


def test_widgets_are_private_to_their_owner(auth_client, db_session):
    client, _ = auth_client
    wid = client.post("/api/user-widgets", json=_widget()).json()["widget_id"]

    other_id = str(uuid.uuid4())
    db_session.add(User(user_id=other_id, email="other@example.com", username="other",
                        hashed_password="x", is_active=True, role="user"))
    db_session.commit()
    other = {"Authorization": f"Bearer {create_access_token({'sub': other_id})}"}

    assert client.get("/api/user-widgets", headers=other).json()["widgets"] == []
    assert client.put(f"/api/user-widgets/{wid}", json={"name": "hijack"}, headers=other).status_code == 404
    assert client.delete(f"/api/user-widgets/{wid}", headers=other).status_code == 404
    assert client.get("/api/user-widgets").json()["widgets"][0]["name"] == "My 10Y yield"


def test_schema_lists_response_fields_for_mapping(auth_client):
    """매핑 화면은 API 를 부르지 않고도 응답 필드를 알아야 한다."""
    client, _ = auth_client
    body = client.get("/api/data/fred/series/schema").json()
    fields = {f["name"]: f["kind"] for f in body["fields"]}
    assert fields, body
    assert fields.get("date") == "date"
    assert "number" in fields.values()


# ── 위젯 종류 목록 (관리자) ───────────────────────────────────────────────────

@pytest.fixture
def admin(auth_client, db_session):
    """관리자 계정의 Authorization 헤더 (auth_client 와 같은 임시 DB)."""
    admin_id = str(uuid.uuid4())
    db_session.add(User(user_id=admin_id, email="admin@example.com", username="admin",
                        hashed_password="x", is_active=True, role="admin"))
    db_session.commit()
    return {"Authorization": f"Bearer {create_access_token({'sub': admin_id})}"}


def _types(client):
    return {t["value"]: t for t in client.get("/api/user-widgets/codes").json()["codes"]["VIEW_TYPE"]}


def test_only_admin_can_change_the_widget_type_list(auth_client):
    client, _ = auth_client
    body = {"type_code": "trend", "name": "추세", "renderer": "line"}
    assert client.post("/api/admin/widget-types", json=body).status_code == 403
    assert client.put("/api/admin/widget-types/table", json={"use_yn": "N"}).status_code == 403
    assert client.delete("/api/admin/widget-types/table").status_code == 403
    assert "trend" not in _types(client) and _types(client)["table"]["use_yn"] == "Y"


def test_admin_manages_widget_types_and_users_can_pick_them(auth_client, admin):
    client, _ = auth_client

    r = client.post("/api/admin/widget-types", headers=admin,
                    json={"type_code": "trend", "name": "추세", "renderer": "line"})
    assert r.status_code == 201, r.text
    assert r.json()["kind"] == "chart"
    assert list(_types(client))[-1] == "trend"                   # 맨 뒤에 붙는다

    # 새 종류로 위젯을 만들면 renderer 가 따라온다 (차트 검증도 renderer 기준)
    w = client.post("/api/user-widgets", json=_widget(view_type="trend")).json()
    assert w["view_type"] == "trend" and w["renderer"] == "line"
    bad = client.post("/api/user-widgets", json=_widget(
        view_type="trend", fields=[{"field_name": "a", "field_role": "Y"}]))
    assert bad.status_code == 400 and "함께" in bad.json()["detail"]

    # 이름·순서·사용 여부 수정
    r = client.put("/api/admin/widget-types/trend", headers=admin,
                   json={"name": "추세선", "sort_seq": -1, "use_yn": "N"}).json()
    assert (r["name"], r["use_yn"]) == ("추세선", "N")
    assert list(_types(client))[0] == "trend"
    # 숨겨도 이미 만든 위젯은 그대로 그려진다
    assert client.get("/api/user-widgets").json()["widgets"][0]["renderer"] == "line"

    # 쓰는 위젯이 있으면 못 지운다 → 위젯을 지우면 지워진다
    r = client.delete("/api/admin/widget-types/trend", headers=admin)
    assert r.status_code == 409 and "1개" in r.json()["detail"]
    client.delete(f"/api/user-widgets/{w['widget_id']}")
    assert client.delete("/api/admin/widget-types/trend", headers=admin).status_code == 204
    assert "trend" not in _types(client)
    assert client.delete("/api/admin/widget-types/trend", headers=admin).status_code == 404


@pytest.mark.parametrize("body, msg", [
    ({"type_code": "table", "name": "표2", "renderer": "table"}, "이미 있습니다"),
    ({"type_code": "9bad", "name": "x", "renderer": "table"}, "코드는"),
    ({"type_code": "holo", "name": "x", "renderer": "hologram"}, "RENDERER"),
    ({"type_code": "blank", "name": "  ", "renderer": "table"}, "이름"),
])
def test_bad_widget_types_are_rejected(auth_client, admin, body, msg):
    client, _ = auth_client
    r = client.post("/api/admin/widget-types", headers=admin, json=body)
    assert r.status_code == 400 and msg in r.json()["detail"], r.text


# ── 기본 제공 위젯의 사용자별 설정 ────────────────────────────────────────────

def test_builtin_widget_prefs_are_sparse_and_per_user(auth_client, db_session, admin):
    client, _ = auth_client
    assert client.get("/api/user-widgets/prefs").json()["prefs"] == []       # 기본값 = 행 없음

    r = client.put("/api/user-widgets/prefs/insider", json={"use_yn": "N"}).json()
    assert r == {"widget_type": "insider", "use_yn": "N", "screens": []}
    r = client.put("/api/user-widgets/prefs/financials", json={"screens": ["/stock", "/"]}).json()
    assert r == {"widget_type": "financials", "use_yn": "Y", "screens": ["/", "/stock"]}

    prefs = {p["widget_type"]: p for p in client.get("/api/user-widgets/prefs").json()["prefs"]}
    assert set(prefs) == {"insider", "financials"}
    assert client.get("/api/user-widgets/prefs", headers=admin).json()["prefs"] == []   # 남의 설정은 안 보인다

    # 한쪽만 보내면 다른 쪽은 그대로
    r = client.put("/api/user-widgets/prefs/financials", json={"use_yn": "N"}).json()
    assert r["use_yn"] == "N" and r["screens"] == ["/", "/stock"]

    # 기본값으로 되돌리면 행이 사라진다 ('*' = 화면 제한 없음)
    client.put("/api/user-widgets/prefs/insider", json={"use_yn": "Y"})
    client.put("/api/user-widgets/prefs/financials", json={"use_yn": "Y", "screens": ["*"]})
    assert client.get("/api/user-widgets/prefs").json()["prefs"] == []
    assert db_session.query(UserWidgetPref).count() == 0
    assert db_session.query(UserWidgetPrefScreen).count() == 0

    assert client.put("/api/user-widgets/prefs/bad id!", json={"use_yn": "N"}).status_code == 400
    assert client.put("/api/user-widgets/prefs/insider", json={"use_yn": "X"}).status_code == 400
