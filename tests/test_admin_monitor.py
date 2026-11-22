"""운영 모니터링 — /api/admin/monitor/* 는 관리자만, 요청은 라우트 템플릿으로 묶여 쌓인다."""
import uuid

import pytest

from app.backend.core.auth.security import create_access_token
from app.backend.models.orm import User
from app.backend.services import monitor_service as mon

DATASETS = ["summary", "system", "traffic", "endpoints", "inflight", "slow"]


@pytest.fixture
def admin(db_session):
    admin_id = str(uuid.uuid4())
    db_session.add(User(user_id=admin_id, email="admin@example.com", username="admin",
                        hashed_password="x", is_active=True, role="admin"))
    db_session.commit()
    return {"Authorization": f"Bearer {create_access_token({'sub': admin_id})}"}


@pytest.fixture(autouse=True)
def fresh():
    mon.reset_for_tests()
    yield
    mon.reset_for_tests()


def test_only_admins_can_read_the_monitor(auth_client, admin):
    client, _ = auth_client
    assert client.get("/api/admin/monitor/summary").status_code == 403
    for name in DATASETS:
        r = client.get(f"/api/admin/monitor/{name}", headers=admin)
        assert r.status_code == 200, (name, r.text)
        body = r.json()
        assert body["provider"] == "server" and isinstance(body["results"], list)
    assert client.get("/api/admin/monitor/nope", headers=admin).status_code == 404


def test_requests_are_grouped_by_route_template(auth_client, admin):
    client, _ = auth_client
    client.put("/api/user-widgets/prefs/insider", json={"use_yn": "N"})
    client.put("/api/user-widgets/prefs/financials", json={"use_yn": "N"})
    client.get("/health")                                   # 도커 점검은 세지 않는다

    rows = client.get("/api/admin/monitor/endpoints", headers=admin).json()["results"]
    by_route = {r["route"]: r for r in rows}
    # 위젯 id 마다 줄이 늘지 않게 템플릿 하나로 묶인다
    assert by_route["PUT /api/user-widgets/prefs/{widget_type}"]["count"] == 2
    assert not any("/health" in r for r in by_route)
    # 모니터링 화면이 스스로 보낸 요청은 세지 않는다 (폴링이 표를 채우지 않게)
    assert not any("/admin/monitor" in r for r in by_route)

    traffic = client.get("/api/admin/monitor/traffic", headers=admin).json()["results"]
    assert sum(t["count"] for t in traffic) == 2


def test_slow_and_failed_requests_are_kept():
    t = mon.record_start("GET", "/api/strategies/result")
    mon.record_end(t, "/api/strategies/result", 500)
    slow = mon.slow_requests()
    assert slow and slow[0]["path"] == "/api/strategies/result" and slow[0]["_state"] == "500"


def test_inflight_shows_requests_still_running():
    t = mon.record_start("GET", "/api/strategies/compare")
    rows = mon.inflight()
    assert [r["path"] for r in rows] == ["/api/strategies/compare"]
    mon.record_end(t, "/api/strategies/compare", 200)
    assert mon.inflight() == []


def test_summary_and_sample_do_not_fail_without_proc():
    """Windows 개발 PC 처럼 /proc 이 없어도 요약 줄은 나온다 (값이 없는 칸만 빠진다)."""
    mon.take_sample()
    rows = mon.summary()
    assert rows[0]["lead"] is True
    assert {r["id"] for r in rows} >= {"rpm", "p95", "inflight"}


def test_monitor_widgets_are_seeded_for_the_admin_screen_only():
    from app.backend.services.builtin_widget_seed import BUILTIN_WIDGETS

    ops = [w for w in BUILTIN_WIDGETS if w["widget_id"].startswith("ops-")]
    assert len(ops) == 5
    for w in ops:
        assert w["endpoint"].startswith("/admin/monitor/")
        # 다른 화면 메뉴('*')에 내놓지 않는다 — 관리자가 아니면 403 위젯만 생긴다
        assert all(s[0] == "/admin" for s in w["screens"]), w["widget_id"]
