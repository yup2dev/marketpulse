"""화면 단위 파라미터 그룹 (user_screen_groups · OpenBB apps.json 의 groups).

한 화면(+탭)의 위젯 여러 개가 값 하나를 같이 따른다. 시드는 DB 에 없는 행만, 위젯 행이 있는 것만 넣는다.
"""
import pathlib

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]


@pytest.fixture
def groups_seed(monkeypatch):
    from app.backend.services import builtin_widget_seed

    rows = [
        ("/", "overview", "market", "index-tiles", "symbol", True),
        ("/", "overview", "market", "mini-chart", "symbol", False),
        ("/", "", "ghost", "no-such-widget", "x", False),        # 위젯 행이 없으면 넣지 않는다 (외래키)
    ]
    monkeypatch.setattr(builtin_widget_seed, "SCREEN_GROUPS", rows)
    return rows


def test_screen_groups_endpoint(auth_client, groups_seed):
    client, _ = auth_client
    r = client.get("/api/user-widgets/screen-groups")
    assert r.status_code == 200
    body = r.json()
    assert body["provider"] == "registry"
    assert body["results"] == [
        {"screen": "/", "tab": "overview", "group_code": "market", "widget_id": "index-tiles",
         "param_name": "symbol", "is_source": True, "is_required": True},
        {"screen": "/", "tab": "overview", "group_code": "market", "widget_id": "mini-chart",
         "param_name": "symbol", "is_source": False, "is_required": True},
    ]


def test_screen_groups_seed_only_missing(auth_client, db_session, groups_seed):
    from app.backend.models.orm import UserScreenGroup

    client, _ = auth_client
    client.get("/api/user-widgets/screen-groups")
    row = db_session.query(UserScreenGroup).filter_by(widget_id="mini-chart").one()
    row.param_name = "edited"                                     # DB 에서 고친 행은 시드가 되돌리지 않는다
    db_session.commit()
    client.get("/api/user-widgets/screen-groups")
    assert db_session.query(UserScreenGroup).count() == 2
    assert db_session.query(UserScreenGroup).filter_by(widget_id="mini-chart").one().param_name == "edited"


def test_screen_groups_openapi_is_typed():
    from app.backend.main import app

    spec = app.openapi()
    ref = spec["paths"]["/api/user-widgets/screen-groups"]["get"]["responses"]["200"]["content"]["application/json"]["schema"]["$ref"]
    envelope = spec["components"]["schemas"][ref.rsplit("/", 1)[-1]]
    assert envelope["properties"]["results"]["items"] == {"$ref": "#/components/schemas/ScreenGroupOut"}


def test_migration_matches_orm():
    from app.backend.models.orm import UserScreenGroup

    text = next((ROOT / "migrations" / "versions").glob("*_user_screen_groups.py")).read_text(encoding="utf-8")
    assert "'user_screen_groups'" in text
    for col in UserScreenGroup.__table__.columns:
        assert f"sa.Column('{col.name}'" in text, col.name
    assert "down_revision: Union[str, Sequence[str], None] = 'b7d3e9a1c5f2'" in text
