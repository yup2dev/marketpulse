"""위젯 데이터 출처와 데이터 API 호출 허용 (services/widget_sources.py).

    출처        위젯 종류마다 달리 생긴 정의에서 (provider, model) 을 한 모양으로 뽑는다.
    호출 허용   기본 위젯 + 요청 사용자의 위젯 출처에 있는 데이터 API 만 (WIDGET_API_GATE).
                지금 운영은 log(허용 밖 호출을 기록만) — 어떤 화면이 등록 없이 부르는지 모은 뒤 enforce 로.
    하드코딩    위젯 코드에 직접 적힌 /data/<provider>/<model> 은 기본 위젯 출처에 있거나 아래 목록에만 —
                목록은 줄기만 한다 (정의 행으로 옮기면 지운다).
"""
import re
import uuid
from pathlib import Path

import pytest

from app.backend.models.orm import UserWidget
from app.backend.services import widget_sources
from app.backend.services.builtin_widgets import load_specs
from app.backend.services.widget_sources import ApiNotRegisteredError, endpoint_sources, sources_of

ROOT = Path(__file__).resolve().parents[1]
FRONT = ROOT / "MarketpulseWeb" / "app" / "frontend" / "src"


@pytest.fixture(autouse=True)
def _fresh_cache():
    widget_sources.invalidate()
    yield
    widget_sources.invalidate()


def _uw(db, user_id=None, provider=None, model=None, endpoint=None, use_yn="Y"):
    w = UserWidget(widget_id=f"w_{uuid.uuid4().hex[:8]}", user_id=user_id, name="t", provider=provider,
                   model=model, endpoint=endpoint, view_type="table", use_yn=use_yn)
    db.add(w)
    db.commit()
    return w


# ── 출처 ──────────────────────────────────────────────────────────────────────

def test_sources_by_widget_kind():
    assert sources_of(UserWidget(provider="fred", model="series")) == {("fred", "series")}
    assert endpoint_sources("/data/polygon/news?limit=50") == {("polygon", "news")}
    assert endpoint_sources("/stock/summary/{symbol}") == set()                    # command — 데이터 API 아님
    holders = endpoint_sources("/data/{provider}/holders?symbol={symbol}")          # 헤더 provider 선택
    assert ("yahoo", "holders") in holders and all(m == "holders" for _, m in holders)


def test_builtin_widget_data_endpoints_are_registered():
    """기본 위젯 파일의 /data endpoint 가 등록된 fetcher 를 가리킨다 (배포 전에 잡는다)."""
    missing = []
    for spec in load_specs():
        m = widget_sources.DATA_ENDPOINT.match(spec.get("endpoint") or "")
        if m and not endpoint_sources(spec["endpoint"]):
            missing.append(f"{spec['widget_id']}: {spec['endpoint']}")
        elif m and m.group(1) != widget_sources.PROVIDER_SLOT:
            assert (m.group(1), m.group(2)) in endpoint_sources(spec["endpoint"])
            assert m.group(1) in widget_sources.providers_of(m.group(2)), f"{spec['widget_id']}: {spec['endpoint']}"
    assert not missing, "등록되지 않은 데이터 API 를 가리키는 기본 위젯:\n" + "\n".join(missing)


# ── 호출 허용 ─────────────────────────────────────────────────────────────────

def _check(db, provider, model, user_id, mode):
    widget_sources.check_data_call(provider, model, user_id, mode, db_factory=lambda: _NoClose(db))


class _NoClose:
    def __init__(self, db):
        self.db = db

    def __getattr__(self, name):
        return getattr(self.db, name)

    def close(self):
        pass


def test_allowed_is_builtin_plus_own_widgets(db_session):
    _uw(db_session, endpoint="/data/polygon/news?limit=50")                         # 기본 위젯
    _uw(db_session, user_id="u1", provider="oecd", model="unemployment")            # u1 의 위젯
    _uw(db_session, user_id="u2", provider="fmp", model="quote")                    # 남의 위젯
    _uw(db_session, user_id="u1", provider="bls", model="series", use_yn="N")       # 꺼 둔 위젯

    code = widget_sources.code_widget_pairs()                                       # 코드 위젯(chart-studio …)
    assert widget_sources.allowed_pairs(db_session, "u1") == {("polygon", "news"), ("oecd", "unemployment")} | code
    _check(db_session, "oecd", "unemployment", "u1", "enforce")
    _check(db_session, "fred", "series", "u1", "enforce")                           # chart-studio 거시 겹침
    _check(db_session, "polygon", "news", "u1", "enforce")
    for provider, model in [("fmp", "quote"), ("bls", "series")]:
        with pytest.raises(ApiNotRegisteredError):
            _check(db_session, provider, model, "u1", "enforce")


def test_log_mode_only_logs_and_off_skips(db_session, monkeypatch):
    seen = []

    class _Log:                                   # 전역 로깅 설정(다른 테스트가 바꿀 수 있다)과 무관하게 본다
        def warning(self, msg, *args):
            seen.append(msg % args)

    monkeypatch.setattr(widget_sources, "log", _Log())
    _check(db_session, "fmp", "quote", "u1", "log")
    assert any("fmp/quote" in m for m in seen)
    seen.clear()
    _check(db_session, "fmp", "quote", "u1", "off")
    assert not seen


def test_saving_a_widget_refreshes_the_allowed_set(auth_client, db_session):
    client, uid = auth_client
    assert ("bls", "series") not in widget_sources.allowed_pairs(db_session, uid)
    r = client.post("/api/user-widgets", json={
        "name": "CPI", "provider": "bls", "model": "series", "view_type": "table",
        "params": [{"param_name": "symbol", "bind_type": "FIXED", "param_value": "CUUR0000SA0"}],
    })
    assert r.status_code in (200, 201), r.text
    assert ("bls", "series") in widget_sources.allowed_pairs(db_session, uid)


def test_gateway_returns_404_api_not_registered_in_enforce(auth_client, db_session, monkeypatch):
    from app.backend.core.config import settings

    client, _uid = auth_client
    monkeypatch.setattr(settings, "WIDGET_API_GATE", "enforce")
    monkeypatch.setattr(widget_sources, "_default_db", lambda: _NoClose(db_session))
    r = client.get("/api/data/fmp/quote", params={"symbol": "AAPL"})
    assert r.status_code == 404 and r.json()["code"] == "api_not_registered"


# ── 위젯 코드에 직접 적힌 데이터 경로 ─────────────────────────────────────────

# 기본 위젯 · 코드 위젯 출처에 없는데 프론트 코드가 직접 부르는 것 — 늘리지 않는다 (enforce 면 404 가 된다).
HARDCODED_UNREGISTERED: set = set()

_LITERAL = re.compile(r"/data/([a-z0-9_]+)/([a-z0-9_]+)")


def test_hardcoded_data_paths_only_shrink():
    builtin = widget_sources.code_widget_pairs()
    for spec in load_specs():
        builtin |= endpoint_sources(spec.get("endpoint"))
    found = set()
    for p in [*FRONT.rglob("*.js"), *FRONT.rglob("*.jsx")]:
        if "node_modules" in p.parts:
            continue
        found |= {(a, b) for a, b in _LITERAL.findall(p.read_text(encoding="utf-8"))}
    unregistered = found - builtin
    assert unregistered <= HARDCODED_UNREGISTERED, f"새로 하드코딩된 데이터 경로 — 기본 위젯 정의로: {unregistered - HARDCODED_UNREGISTERED}"
    assert HARDCODED_UNREGISTERED <= unregistered, f"정리된 경로는 목록에서 지운다: {HARDCODED_UNREGISTERED - unregistered}"


def test_code_widget_sources_are_registered_and_allowed(db_session):
    for widget, pairs in widget_sources.CODE_WIDGET_SOURCES.items():
        for provider, model in pairs:
            assert provider in widget_sources.providers_of(model), f"{widget}: {provider}/{model}"
    assert widget_sources.code_widget_pairs() <= widget_sources.allowed_pairs(db_session, "anyone")


# ── 참조 검사 — 기본 위젯 endpoint 의 데이터 API ─────────────────────────────

def test_broken_builtin_widget_endpoint_is_reported(db_session):
    from app.backend.services import data_catalog

    entry = {"params": [], "fields": [{"name": "title", "kind": "text", "description": None}]}
    data_catalog.sync_catalog(db_session, ({"polygon": {"name": "P", "description": None, "key": True}},
                                           {("polygon", "news"): entry}))
    ok = _uw(db_session, endpoint="/data/polygon/news?limit=50")
    gone = _uw(db_session, endpoint="/data/polygon/no_such_model")
    cmd = _uw(db_session, endpoint="/stock/summary/{symbol}")                     # 데이터 API 가 아니다

    by_id = {w["widget_id"]: w for w in data_catalog.find_broken_widgets(db_session)["widgets"]}
    assert ok.widget_id not in by_id and cmd.widget_id not in by_id
    assert by_id[gone.widget_id]["problems"][0]["kind"] == "api"


# ── 기본 설정: local fetcher 는 enforce, 서버 fetcher 는 log ─────────────────

def test_default_gate_blocks_unregistered_local_fetcher_only(auth_client, db_session, monkeypatch):
    """사용자 PC 를 쓰는 local fetcher(yahoo · 13F)만 막는다 — 서버 fetcher 는 아직 기록만."""
    from app.backend.core.config import settings

    from app.backend.core.config import Settings

    client, _uid = auth_client
    defaults = (Settings.model_fields["WIDGET_API_GATE"].default, Settings.model_fields["WIDGET_API_GATE_LOCAL"].default)
    assert defaults == ("log", "enforce")                                   # 운영 기본값
    monkeypatch.setattr(settings, "WIDGET_API_GATE", defaults[0])            # conftest 가 끈 것을 기본값으로
    monkeypatch.setattr(settings, "WIDGET_API_GATE_LOCAL", defaults[1])
    monkeypatch.setattr(widget_sources, "_default_db", lambda: _NoClose(db_session))

    r = client.get("/api/data/yahoo/quote", params={"symbol": "AAPL"})       # local · 어느 위젯에도 없음
    assert r.status_code == 404 and r.json()["code"] == "api_not_registered"

    # server fetcher 는 위젯에 없어도 log — 막지 않는다 (HTTP 로 부르면 실제 조회가 나가므로 게이트만 본다)
    _check(db_session, "fmp", "quote", _uid, settings.WIDGET_API_GATE)
