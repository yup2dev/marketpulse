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
    assert set(body["codes"]) == {
        "VIEW_TYPE", "RENDERER", "BIND_TYPE", "FIELD_ROLE", "FIELD_FORMAT",
        # 기본 제공 위젯(user_id NULL)의 코드값
        "SPEC_VIEW", "SPEC_FIELD_ROLE", "CELL_TYPE", "TRANSFORM", "TAB_FILTER",
    }
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


# ── 기본 제공 위젯의 정의 (user_id NULL 인 행) ───────────────────────────────

def test_builtin_widgets_are_rows_seeded_on_first_read(auth_client, db_session, admin):
    from app.backend.models.orm import UserWidget, UserWidgetTabItem

    client, _ = auth_client
    assert db_session.query(UserWidget).count() == 0
    widgets = {w["widget_id"]: w for w in client.get("/api/user-widgets/builtin").json()["widgets"]}
    home = {"index-tiles", "key-events", "live-ranking", "mini-chart", "sector-heatmap", "breaking-news"}
    macro = {"macro-summary", "yield-curve", "cpi-breakdown", "labor-overview", "fear-greed"}
    concepts = {"concept-cpi", "concept-policy-rate", "concept-unemployment", "concept-long-rate", "concept-gdp-growth"}
    assert set(widgets) == home | macro | concepts

    # 정의는 행이다 — 마스터(user_id NULL) + 자식 테이블
    rows = db_session.query(UserWidget).all()
    assert len(rows) == 16 and all(w.user_id is None for w in rows)
    assert db_session.query(UserWidgetTabItem).filter_by(widget_id="index-tiles").count() == 16

    # 모든 위젯에 출처·크기·기본 배치가 있다
    for w in widgets.values():
        assert w["source"] and all(w["size"].values()), w["widget_id"]
        placed = w["screens"][-1]
        assert None not in (placed["x"], placed["y"], placed["w"], placed["h"])
        if w["widget_id"] in concepts:
            # 지표 개념 위젯은 매크로 Global Indicators 탭에만 (코드 레지스트리의 같은 id 를 대신한다)
            assert [(s["screen"], s["tab"]) for s in w["screens"]] == [("/macro", "global")]
            continue
        # 모든 화면의 메뉴('*') + 자기 화면(홈 / 매크로) Overview 탭의 기본 배치
        screen = "/macro" if w["widget_id"] in macro else "/"
        assert [s["screen"] for s in w["screens"]] == ["*", screen] and placed["tab"] == "overview"

    ranking = widgets["live-ranking"]
    assert ranking["source"] == ["$provider", "live"] and ranking["transform"] == "rank_sort"
    assert [o["value"] for o in ranking["params"][0]["options"]] == ["trade_value", "gainers", "losers"]
    assert [f["format"] for f in ranking["fields"]] == ["rank", "stock", "price", "change", "compact", "trend", "tag"]
    assert ranking["fields"][2]["quote_field"] == "price"

    chart = widgets["mini-chart"]
    assert chart["endpoint"] == "/stock/history/{symbol}?period={period}&interval={interval}"
    five = next(o for o in chart["params"][0]["options"] if o["value"] == "5m")
    assert five["params"] == {"period": "5d", "interval": "5m", "session": "true", "note": "5분봉"}

    tiles = widgets["index-tiles"]
    assert [t["tab_code"] for t in tiles["tabs"]] == ["index", "fxcmd"]
    assert tiles["tabs"][0]["items"][0] == {"symbol": "^GSPC", "name": "S&P 500"}
    assert widgets["breaking-news"]["options"]["extra.favorites"] == "/watchlist/my-tickers"

    # 탭마다 뷰·요청을 따로 가질 수 있다 — 'tab.<탭>.<이름>' 옵션
    yields = widgets["yield-curve"]
    assert yields["view_type"] == "lines" and [t["tab_code"] for t in yields["tabs"]] == ["curve", "trend"]
    assert yields["options"]["tab.trend.endpoint"] == "/data/{provider}/yield_curve_history?period={period}"
    # 데이터 소스를 고를 수 있는 위젯: endpoint 에 {provider} + 처음 값, 기준일은 date 컨트롤
    assert yields["endpoint"] == "/data/{provider}/yield_curve?date={date}" and yields["options"]["provider"] == "fred"
    assert [p["param_name"] for p in yields["params"]] == ["date", "period"]
    cpi = widgets["concept-cpi"]
    assert cpi["endpoint"] == "/concepts/cpi_yoy?country={country}&period={period}&provider={provider}"
    assert cpi["options"]["optionsFrom.country"] == "/concepts/cpi_yoy/countries|code|label"
    assert widgets["concept-policy-rate"]["params"][0]["param_value"] == "KOR"
    assert widgets["labor-overview"]["options"]["tab.claims.view"] == "lines"
    assert widgets["macro-summary"]["options"]["extra.yields"] == "/data/{provider}/yield_curve?date={date}"

    # 두 번째 읽기는 다시 넣지 않는다. 모든 사용자가 같은 정의를 본다
    assert len(client.get("/api/user-widgets/builtin", headers=admin).json()["widgets"]) == 16
    assert db_session.query(UserWidget).count() == 16


def test_builtin_widgets_added_to_the_seed_reach_an_existing_db(auth_client, db_session):
    """이미 기본 제공 행이 있는 DB 에도 시드에 새로 생긴 위젯은 들어간다 — 있는 행은 그대로."""
    from app.backend.models.orm import UserWidget

    client, _ = auth_client
    client.get("/api/user-widgets/builtin")
    # 새 위젯이 추가되기 전의 DB: 매크로 위젯 하나가 없고, 홈 위젯 하나는 고쳐져 있다
    db_session.delete(db_session.query(UserWidget).filter_by(widget_id="fear-greed").one())
    db_session.query(UserWidget).filter_by(widget_id="mini-chart").update({"default_symbol": "AAPL"})
    db_session.commit()

    widgets = {w["widget_id"]: w for w in client.get("/api/user-widgets/builtin").json()["widgets"]}
    assert widgets["fear-greed"]["view_type"] == "gauge"
    assert widgets["mini-chart"]["default_symbol"] == "AAPL"
    assert db_session.query(UserWidget).count() == 16


def test_builtin_widgets_follow_the_db_not_the_seed(auth_client, db_session):
    """화면은 DB 행을 그린다 — 행을 고치면 정의가 바뀌고, 사용 안 함이면 빠진다."""
    from app.backend.models.orm import UserWidget

    client, _ = auth_client
    client.get("/api/user-widgets/builtin")
    db_session.query(UserWidget).filter_by(widget_id="mini-chart").update({"default_symbol": "AAPL"})
    db_session.query(UserWidget).filter_by(widget_id="key-events").update({"use_yn": "N"})
    db_session.commit()

    widgets = {w["widget_id"]: w for w in client.get("/api/user-widgets/builtin").json()["widgets"]}
    assert widgets["mini-chart"]["default_symbol"] == "AAPL"
    assert "key-events" not in widgets


def test_builtin_widgets_are_not_in_my_widgets_and_cannot_be_edited(auth_client):
    client, _ = auth_client
    client.get("/api/user-widgets/builtin")
    assert client.get("/api/user-widgets").json()["widgets"] == []
    assert client.put("/api/user-widgets/mini-chart", json={"name": "x"}).status_code == 404
    assert client.delete("/api/user-widgets/mini-chart").status_code == 404
