"""응답 envelope 계약 — 전 라우트가 OBBject(`{results, provider, metadata}`)를 쓴다.

배경: 엔드포인트마다 껍데기가 달라서 프론트가 그걸 전부 알아야 했다. 한 파일 안에서도
`{success, tickers}` / `{success, data}` / `{success}` / `{success, message}` 가 섞여
있었고, 같은 model 인데 `{result}` 와 `{results}` 가 갈리기도 했다(그래서 실제로
quant-summary 위젯은 `results.0` 을 읽는데 백엔드가 `{result}` 를 주고 있었다).

프론트 계약은 `res.results` 하나다. 구형 envelope 으로 되돌아가면 위젯이 **에러 없이
빈 채로** 뜨기 때문에 사람 눈으로는 늦게 발견된다. 그래서 여기서 고정한다.
"""
import ast
import pathlib

import pytest

# cwd 와 무관하게 — 예전 상대경로("app/backend/...")는 폴더 이동 후 0개를 찾고 조용히 통과했다
ROUTES_DIR = pathlib.Path(__file__).resolve().parents[1] / "MarketpulseWeb" / "app" / "backend" / "api" / "routes"
assert any(ROUTES_DIR.glob("*.py")), f"라우트 디렉터리를 못 찾음: {ROUTES_DIR}"


def test_no_legacy_success_envelope_in_routes():
    """`{"success": True, ...}` 가 어느 라우트에도 남아 있으면 안 된다.

    문자열 검사가 아니라 AST 로 본다 — 주석·docstring 안의 언급은 걸리지 않게.
    """
    offenders = []
    for path in sorted(ROUTES_DIR.glob("*.py")):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if not isinstance(node, ast.Dict):
                continue
            keys = [k.value for k in node.keys if isinstance(k, ast.Constant)]
            if "success" in keys:
                offenders.append(f"{path.name}:{node.lineno}")
    assert not offenders, (
        "구형 envelope 이 돌아왔다: " + ", ".join(offenders) +
        " — OBBject(results=[...], provider=...) 를 써라"
    )


# 인증만 있으면 빈 DB 에서도 200 이 나오는 조회 엔드포인트
ENVELOPE_GETS = [
    "/api/watchlist",
    "/api/watchlist/my-tickers",
    "/api/notes",
    "/api/menu/list",
    "/api/menu/hierarchy",
    "/api/screener/saved",
    "/api/screener/presets",
    "/api/alerts/",
    "/api/alerts/history",
]


@pytest.mark.parametrize("path", ENVELOPE_GETS)
def test_get_endpoints_return_obbject(auth_client, path):
    client, _ = auth_client

    r = client.get(path)
    assert r.status_code == 200, r.text
    body = r.json()

    assert isinstance(body, dict), f"{path} 가 배열을 그대로 반환한다 — OBBject 로 감싸라"
    assert "results" in body, f"{path} 응답에 results 가 없다: {list(body)}"
    assert isinstance(body["results"], list), f"{path} 의 results 가 배열이 아니다"
    assert body.get("provider"), f"{path} 에 provider 가 없다"
    # 구형 키가 남아 있으면 프론트가 그쪽을 계속 읽게 된다
    for legacy in ("success", "data", "tickers", "presets", "sectors", "menu", "result", "history"):
        assert legacy not in body, f"{path} 가 아직 구형 키 '{legacy}' 를 준다"


def test_notes_crud_roundtrip(auth_client):
    """단건도 `results` 배열에 담겨 와야 한다 — 생성→목록→수정→삭제."""
    client, _ = auth_client

    r = client.post("/api/notes", json={"title": "메모", "content": "본문"})
    assert r.status_code == 200, r.text
    note_id = r.json()["results"][0]["note_id"]

    assert [n["title"] for n in client.get("/api/notes").json()["results"]] == ["메모"]

    r = client.put(f"/api/notes/{note_id}", json={"content": "수정됨"})
    assert r.status_code == 200
    assert r.json()["results"][0]["content"] == "수정됨"

    r = client.delete(f"/api/notes/{note_id}")
    assert r.status_code == 200
    # 삭제는 돌려줄 본문이 없다 — results 는 비우고 대상은 metadata 에
    assert r.json()["results"] == []
    assert r.json()["metadata"]["deleted"] == note_id
    assert client.get("/api/notes").json()["results"] == []


def test_watchlist_crud_roundtrip(auth_client):
    """watchlist 는 한 파일 안에 껍데기가 4종 섞여 있었다 — 전부 OBBject 인지 본다."""
    client, _ = auth_client

    r = client.post("/api/watchlist", json={"name": "테스트 관심종목"})
    assert r.status_code == 200, r.text
    wl_id = r.json()["results"][0]["watchlist_id"]

    # 목록 (구 `{success, data}`)
    assert len(client.get("/api/watchlist").json()["results"]) == 1

    # 항목 추가 (구 `{success, data}`) → 항목 목록
    r = client.post(f"/api/watchlist/{wl_id}/items", json={"ticker_cd": "AAPL"})
    assert r.status_code == 200, r.text
    assert isinstance(r.json()["results"], list)

    # 내 티커 (구 `{success, tickers}` — 문자열 배열이 results 로 온다)
    r = client.get("/api/watchlist/my-tickers")
    assert "AAPL" in r.json()["results"]

    # 삭제 (구 `{success, message}`)
    r = client.delete(f"/api/watchlist/{wl_id}")
    assert r.status_code == 200
    assert r.json()["results"] == []
    assert r.json()["metadata"]["deleted"] == wl_id


def test_not_found_still_surfaces(auth_client):
    """route_handler 를 붙인 뒤에도 의도된 404 가 그대로 나와야 한다."""
    client, _ = auth_client

    assert client.get("/api/menu/does-not-exist").status_code == 404
    assert client.put("/api/notes/nope", json={"content": "x"}).status_code == 404
    assert client.delete("/api/watchlist/nope").status_code == 404


# ── AnnotatedResult 는 OBBject 단에서만 푼다 ────────────────────────────────────

from data_fetcher.abstract_provider.abstract.annotated_result import AnnotatedResult  # noqa: E402
from data_fetcher.abstract_provider.abstract.data import BaseData  # noqa: E402
from app.backend.core.command.obbject import OBBject  # noqa: E402


class _Row(BaseData):
    d: str
    v: float


def test_from_result_unwraps_annotated_result_and_keeps_metadata():
    raw = AnnotatedResult(result=[_Row(d="2024-01-01", v=1.5)], metadata={"table_name": "T"})
    obb = OBBject.from_result(raw, "kosis", metadata={"model": "series"})
    assert obb.results == [{"d": "2024-01-01", "v": 1.5}]            # 모델 → dict 직렬화
    assert obb.provider == "kosis"
    assert obb.metadata == {"model": "series", "table_name": "T"}    # 넘긴 metadata 위에 fetcher metadata


@pytest.mark.parametrize("raw,expected", [
    ([{"a": 1}], [{"a": 1}]),          # dict 목록은 그대로
    ({"a": 1}, [{"a": 1}]),            # 스냅샷 dict 하나 → 한 행 (예전 from_query 는 key 를 돌았다)
    (_Row(d="x", v=2), [{"d": "x", "v": 2.0}]),
    (None, []),
    (AnnotatedResult(result=None), []),
])
def test_from_result_normalizes_shapes(raw, expected):
    assert OBBject.from_result(raw, "p").results == expected


def test_unwrap_keeps_model_objects():
    rows = [_Row(d="x", v=1)]
    assert OBBject.unwrap(AnnotatedResult(result=rows)) is rows      # 직렬화하지 않는다 (서비스 계산용)
    assert OBBject.unwrap(rows) is rows and OBBject.unwrap(None) is None
    assert OBBject.metadata_of(AnnotatedResult(result=rows, metadata={"k": 1})) == {"k": 1}
    assert OBBject.metadata_of(rows) == {}                            # 목록이면 metadata 없음


def test_no_annotated_result_isinstance_outside_obbject():
    """라우트 · 서비스 · provider 가 isinstance(raw, AnnotatedResult) 를 직접 보면 안 된다
    — OBBject.unwrap / metadata_of / from_result 를 쓴다. (fetcher 추상 계층 · OBBject · 전송 직렬화만 예외)"""
    backend = ROUTES_DIR.parents[1]
    providers = backend.parents[2] / "MarketpulseFetcher" / "data_fetcher" / "providers"
    assert any(providers.glob("*/models/*.py")), f"provider 디렉터리를 못 찾음: {providers}"
    offenders = []
    obbject = backend / "core" / "command" / "obbject.py"   # 예외: OBBject 자신
    for path in sorted([*backend.rglob("*.py"), *providers.rglob("*.py")]):
        if path == obbject:
            continue
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if (isinstance(node, ast.Call) and getattr(node.func, "id", None) == "isinstance"
                    and len(node.args) == 2 and getattr(node.args[1], "id", None) == "AnnotatedResult"):
                offenders.append(f"{path.name}:{node.lineno}")
    assert not offenders, f"OBBject.unwrap / OBBject.from_result 를 쓰세요: {offenders}"


# ── OBBject[T] 제네릭 — 타입 없는 기존 라우트의 스키마는 그대로 ─────────────────

def test_untyped_obbject_openapi_schema_unchanged():
    """`-> OBBject` 라우트들의 공개 스키마는 제네릭 전과 같다 (results = 아무 값 배열)."""
    from app.backend.main import app

    schema = app.openapi()["components"]["schemas"]["OBBject"]
    assert schema["properties"]["results"] == {"items": {}, "type": "array", "title": "Results"}
    assert set(schema["properties"]) == {"results", "provider", "warnings", "metadata"}


def test_typed_obbject_publishes_row_schema_and_validates():
    from typing import List

    from fastapi import FastAPI

    class Row(BaseData):
        code: str
        value: float

    app = FastAPI()

    @app.get("/rows")
    def rows() -> OBBject[List[Row]]:
        return OBBject[List[Row]].from_result([{"code": "A", "value": 1}], "p")

    spec = app.openapi()
    name = next(k for k in spec["components"]["schemas"] if k.startswith("OBBject"))
    assert spec["components"]["schemas"][name]["properties"]["results"]["items"] == {"$ref": "#/components/schemas/Row"}

    obb = OBBject[List[Row]].from_result(AnnotatedResult(result=[Row(code="B", value=2)], metadata={"m": 1}), "p")
    assert isinstance(obb.results[0], Row) and obb.results[0].code == "B" and obb.metadata == {"m": 1}
    with pytest.raises(Exception):
        OBBject[List[Row]](results=[{"code": "C"}])          # value 없음 → 검증 실패
