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

ROUTES_DIR = pathlib.Path("app/backend/api/routes")


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
