"""provider 무관 데이터 계층 — 선언형 provider · 데이터 개념 · 내 키 기준 provider 선택.

핵심 약속: 사용자는 키만 등록하면 된다.
  - 같은 개념(예: 소비자물가 상승률)을 여러 provider가 구현하고, 내가 쓸 수 있는 것으로 자동 선택된다.
  - 값은 개념 단위로 정규화된다(OECD 비율 0.037 → 3.7%, 지수 → 전년비 %).
  - 키가 없으면 401/403(세션 만료로 오인돼 로그아웃)이 아니라 424 + code=missing_key.
  - JSON 스펙만으로 provider가 추가된다.
네트워크는 쓰지 않는다 — amake_request / QueryExecutor.fetch 를 대체한다.
"""
from datetime import date

import pytest

from data_fetcher.abstract_provider.abstract.provider import Provider
from data_fetcher.concepts import CONCEPTS, ConceptError, ConceptImpl, choose_impl, normalize
from data_fetcher.providers.declarative import build_provider
from data_fetcher.providers.declarative.loader import parse_period, period_str
from data_fetcher.query_executor import (
    MissingCredentialsError, QueryExecutor, QueryExecutorError, RemoteUnavailableError,
)
from data_fetcher.utils.circuit_breaker import CircuitBreakerOpen


# ── 선언형 provider ───────────────────────────────────────────────────────────

@pytest.mark.parametrize("raw,expected", [
    ("20240115", date(2024, 1, 15)),
    ("2024-01-15", date(2024, 1, 15)),
    ("202403", date(2024, 3, 1)),
    ("2024Q3", date(2024, 7, 1)),
    ("2024S2", date(2024, 7, 1)),
    ("2024", date(2024, 1, 1)),
    ("", None),
    ("garbage", None),
])
def test_parse_period(raw, expected):
    assert parse_period(raw) == expected


@pytest.mark.parametrize("cycle,expected", [("D", "20240815"), ("M", "202408"), ("Q", "2024Q3"), ("A", "2024")])
def test_period_str(cycle, expected):
    assert period_str(date(2024, 8, 15), cycle) == expected


SPEC = {
    "name": "toy",
    "credentials": ["api_key"],
    "models": {
        "series": {
            "url": "https://example.test/{api_key}/{code}/{start_date|period:cycle}/{end_date|period:cycle}",
            "params": {
                "code": {"type": "str", "required": True},
                "cycle": {"type": "str", "default": "M", "choices": ["D", "M"]},
                "start_date": {"type": "date", "default": "-1y"},
                "end_date": {"type": "date", "default": "today"},
            },
            "records": "Body.rows",
            "error": {"path": "RESULT", "code": "CODE", "message": "MESSAGE", "empty_codes": ["NODATA"]},
            "fields": {
                "date": {"from": "T", "parse": "period"},
                "value": {"from": "V", "type": "float"},
            },
        }
    },
}


def _patch_request(monkeypatch, response, seen=None):
    async def fake(url, **kwargs):
        if seen is not None:
            seen.append(url)
        return response
    monkeypatch.setattr("data_fetcher.utils.provider_helpers.amake_request", fake)


async def test_declarative_provider_fetches_and_maps(monkeypatch):
    prov = build_provider(SPEC)
    assert isinstance(prov, Provider) and prov.credentials == ["api_key"]
    fetcher = prov.fetcher_dict["series"]
    assert fetcher.param_choices == {"cycle": ["D", "M"]}

    seen = []
    _patch_request(monkeypatch, {"Body": {"rows": [{"T": "202401", "V": "1,234.5"}, {"T": "202402", "V": "-"}]}}, seen)
    rows = await fetcher.fetch_data(
        {"code": "A/B", "start_date": "2024-01-10", "end_date": "2024-02-20"}, credentials={"api_key": "k"},
    )
    # 경로 값은 URL 인코딩, 날짜는 cycle 에 맞춘 기간 문자열
    assert seen == ["https://example.test/k/A%2FB/202401/202402"]
    assert [(r.date, r.value) for r in rows] == [(date(2024, 1, 1), 1234.5), (date(2024, 2, 1), None)]


async def test_declarative_error_codes(monkeypatch):
    fetcher = build_provider(SPEC).fetcher_dict["series"]
    _patch_request(monkeypatch, {"RESULT": {"CODE": "NODATA", "MESSAGE": "없음"}})
    assert await fetcher.fetch_data({"code": "x"}, credentials={"api_key": "k"}) == []

    _patch_request(monkeypatch, {"RESULT": {"CODE": "BADKEY", "MESSAGE": "인증키 오류"}})
    with pytest.raises(ValueError, match="BADKEY"):
        await fetcher.fetch_data({"code": "x"}, credentials={"api_key": "k"})


def test_ecos_spec_is_registered():
    import data_fetcher.providers_init  # noqa: F401
    from data_fetcher.abstract_provider.abstract.provider import ProviderRegistry

    ecos = ProviderRegistry.get("ecos")
    assert ecos.metadata.get("declarative") and ecos.credentials == ["api_key"]
    assert "series" in ecos.fetcher_dict


# ── 데이터 개념 ───────────────────────────────────────────────────────────────

def test_normalize_scale_and_yoy():
    ratio = ConceptImpl("oecd", "m", {"KOR": "korea"}, scale=100)
    assert normalize(ratio, [{"date": date(2024, 1, 1), "value": 0.037}]) == [{"date": "2024-01-01", "value": 3.7}]

    level = ConceptImpl("ecos", "series", {"KOR": None}, yoy=True)
    rows = [{"date": "2023-01-01", "value": 100.0}, {"date": "2024-01-01", "value": 103.0},
            {"date": "2024-02-01", "value": 104.0}]   # 2023-02 없음 → 2024-02 는 계산 불가
    assert normalize(level, rows) == [{"date": "2024-01-01", "value": 3.0}]


def test_choose_impl_prefers_available_provider():
    cpi = CONCEPTS["cpi_yoy"]
    # 키 없는 사용자: 미국 CPI 는 FRED(키 필요) 대신 OECD(무키)
    assert choose_impl(cpi, "USA", lambda p: p == "oecd").provider == "oecd"
    # FRED 키가 있으면 FRED 우선
    assert choose_impl(cpi, "USA", lambda p: True).provider == "fred"
    # 한국은 ECOS → OECD 순
    assert choose_impl(cpi, "KOR", lambda p: True).provider == "ecos"
    # 전부 못 쓰면 첫 구현 — 호출 시 missing_key 로 '키 등록' 안내가 나간다
    assert choose_impl(cpi, "USA", lambda p: False).provider == "fred"
    # 명시 provider 존중
    assert choose_impl(cpi, "USA", lambda p: True, provider="oecd").provider == "oecd"


def test_choose_impl_rejects_unsupported():
    with pytest.raises(ConceptError):
        choose_impl(CONCEPTS["unemployment_rate"], "CHN", lambda p: True)
    with pytest.raises(ConceptError):
        choose_impl(CONCEPTS["cpi_yoy"], "KOR", lambda p: True, provider="fred")


# ── API ───────────────────────────────────────────────────────────────────────

@pytest.fixture
def keys(monkeypatch):
    """사용자 키 저장소 대체 — 테스트가 등록 provider 집합을 정한다."""
    from app.backend.services import user_key_service

    registered: set = set()
    monkeypatch.setattr(user_key_service, "list_status",
                        lambda uid: [{"provider": p, "configured": True} for p in registered])
    monkeypatch.setattr(user_key_service, "get_credentials",
                        lambda uid, p: {"api_key": "stored"} if p in registered else None)
    return registered


def test_providers_configured_reflects_my_keys(auth_client, keys):
    client, _ = auth_client
    by_id = {p["id"]: p for p in client.get("/api/providers").json()["providers"]}
    assert by_id["fred"]["requires_key"] and not by_id["fred"]["configured"]
    assert by_id["oecd"]["configured"]                       # 무키 provider
    assert by_id["fred"]["credentials"] == [{"key": "api_key", "label": "API Key"}]
    assert "cpi_yoy" in by_id["fred"]["concepts"]
    assert by_id["ecos"]["declarative"] and by_id["ecos"]["key_testable"]
    assert [f["key"] for f in by_id["kis"]["credentials"]] == ["appkey", "appsecret"]

    keys.add("fred")
    by_id = {p["id"]: p for p in client.get("/api/providers").json()["providers"]}
    assert by_id["fred"]["configured"]


def test_key_test_endpoint(auth_client, keys, monkeypatch):
    client, _ = auth_client
    calls = []

    async def fake_fetch(provider, model, params, credentials=None, ttl=None, **kw):
        calls.append((provider, model, credentials, ttl))
        if credentials.get("api_key") == "bad":
            raise ValueError("Bad API key")
        return []
    monkeypatch.setattr(QueryExecutor, "fetch", fake_fetch)

    r = client.post("/api/keys/fred/test", json={"api_key": "good"}).json()
    assert r["ok"] is True
    assert calls[-1] == ("fred", "series", {"api_key": "good"}, 0)   # 캐시 우회(ttl=0)

    assert client.post("/api/keys/fred/test", json={"api_key": "bad"}).json()["ok"] is False
    assert client.post("/api/keys/fred/test").json()["ok"] is False    # 저장된 키 없음
    keys.add("fred")
    assert client.post("/api/keys/fred/test").json()["ok"] is True     # 저장된 키로 검증
    assert client.post("/api/keys/kis/test").json()["ok"] is None      # 검증 미지원


def test_concept_endpoint_picks_provider_by_my_keys(auth_client, keys, monkeypatch):
    client, _ = auth_client
    calls = []

    async def fake_fetch(provider, model, params, credentials=None, ttl=None, **kw):
        calls.append((provider, model, params))
        if provider == "fred":
            return [{"date": "2024-01-01", "value": 3.1}, {"date": "2024-02-01", "value": 3.2}]
        return [{"date": date(2024, 1, 1), "value": 0.031}]
    monkeypatch.setattr(QueryExecutor, "fetch", fake_fetch)

    body = client.get("/api/concepts/cpi_yoy?country=USA&start_date=2024-01-01&end_date=2024-12-31").json()
    assert body["provider"] == "oecd" and calls[-1][2]["country"] == "united_states"
    assert body["results"] == [{"date": "2024-01-01", "value": 3.1}]
    assert [(c["provider"], c["available"]) for c in body["metadata"]["candidates"]] == [("fred", False), ("oecd", True)]

    keys.add("fred")
    body = client.get("/api/concepts/cpi_yoy?country=USA&start_date=2024-01-01&end_date=2024-12-31").json()
    assert body["provider"] == "fred"
    assert calls[-1][2] == {"series_id": "CPIAUCSL", "units": "pc1",
                            "start_date": "2024-01-01", "end_date": "2024-12-31"}
    assert [r["date"] for r in body["results"]] == ["2024-02-01", "2024-01-01"]   # 최신이 위

    assert client.get("/api/concepts/unemployment_rate?country=CHN").status_code == 404
    listing = {c["id"]: c for c in client.get("/api/concepts").json()["results"]}
    assert "oecd" in listing["cpi_yoy"]["available_providers"]

    countries = {c["code"]: c for c in client.get("/api/concepts/policy_rate/countries").json()["results"]}
    assert countries["KOR"]["label"] == "Korea"
    # KOR 기준금리는 ECOS 뿐 — 키가 없으면 사용 불가로 표시
    assert countries["KOR"]["available"] is False and countries["JPN"]["available"] is True
    assert client.get("/api/concepts/nope/countries").status_code == 404


def test_missing_key_is_424_not_401(auth_client, keys, monkeypatch):
    """401/403 이면 프론트 apiClient 가 세션 만료로 보고 로그아웃시킨다."""
    client, _ = auth_client

    async def fake_fetch(provider, model, params, credentials=None, ttl=None, **kw):
        raise MissingCredentialsError(provider)
    monkeypatch.setattr(QueryExecutor, "fetch", fake_fetch)

    for path in ("/api/data/fred/series?series_id=DGS10", "/api/concepts/policy_rate?country=USA"):
        r = client.get(path)
        assert r.status_code == 424, (path, r.text)
        assert r.json()["code"] == "missing_key" and r.json()["provider"] == "fred"


def test_gateway_fetcher_off_is_503_not_400(auth_client, monkeypatch):
    """프론트 stateFromError 는 503 일 때만 'Fetcher 실행' 안내를 띄운다.

    RemoteUnavailableError 는 QueryExecutorError 의 하위 클래스라, 게이트웨이가
    QueryExecutorError 를 통째로 400 으로 바꾸면 안내 대신 일반 오류가 뜬다.
    """
    client, _ = auth_client

    async def worker_off(provider, model, params, credentials=None, ttl=None, **kw):
        raise RemoteUnavailableError("Fetcher 워커 미접속")
    monkeypatch.setattr(QueryExecutor, "fetch", worker_off)
    r = client.get("/api/data/yahoo/stock_price?symbol=AAPL")
    assert r.status_code == 503, r.text

    async def circuit_open(provider, model, params, credentials=None, ttl=None, **kw):
        try:
            raise CircuitBreakerOpen(provider, 12.0)
        except CircuitBreakerOpen as e:
            raise QueryExecutorError(str(e)) from e     # QueryExecutor.fetch 와 같은 포장
    monkeypatch.setattr(QueryExecutor, "fetch", circuit_open)
    r = client.get("/api/data/fred/series?series_id=DGS10")
    assert r.status_code == 503 and r.headers.get("retry-after") == "13", r.text

    # 그 밖의 조회 오류는 그대로 — 없는 모델 404, 나머지 400
    async def not_found(provider, model, params, credentials=None, ttl=None, **kw):
        raise QueryExecutorError("Model 'nope' not found")
    monkeypatch.setattr(QueryExecutor, "fetch", not_found)
    assert client.get("/api/data/fred/nope").status_code == 404

    async def bad(provider, model, params, credentials=None, ttl=None, **kw):
        raise QueryExecutorError("invalid params")
    monkeypatch.setattr(QueryExecutor, "fetch", bad)
    assert client.get("/api/data/fred/series").status_code == 400
