"""위젯 다듬기 함수 이름 — 프론트 구현과 서버 코드값이 같은 목록인지 (아키텍처 가이드 v9.1 B10).

기본 위젯 정의(DB 행)에는 함수 '이름'만 있다. 함수는 프론트 widget/registry/builtinWidgets.js 의
TRANSFORMS · TAB_FILTERS 에 있고, 서버는 services/user_widget_service.CODES 로 저장 값을 검증한다.
두 곳에 따로 적는 목록이라 한쪽만 고치면 어긋난다 — 서버에만 있으면 위젯이 없는 함수를 부르고,
프론트에만 있으면 설정 화면에서 고를 수 없다.
"""
import re
from pathlib import Path

import pytest

from app.backend.services.user_widget_service import CODES

ROOT = Path(__file__).resolve().parents[1]
BUILTIN_JS = ROOT / "MarketpulseWeb/app/frontend/src/widget/registry/builtinWidgets.js"


def _object_keys(source: str, const: str) -> set:
    """`export const NAME = { ... };` 의 최상위 키 (두 칸 들여쓴 `key:`)."""
    m = re.search(rf"^export const {const} = \{{\n(.*?)^\}};", source, re.S | re.M)
    assert m, f"{BUILTIN_JS.name} 에서 {const} 를 못 찾음"
    return set(re.findall(r"^  ([A-Za-z_]\w*)\s*:", m.group(1), re.M))


@pytest.mark.parametrize("const,group", [("TRANSFORMS", "TRANSFORM"), ("TAB_FILTERS", "TAB_FILTER")])
def test_front_functions_match_server_codes(const, group):
    front = _object_keys(BUILTIN_JS.read_text(encoding="utf-8"), const)
    server = {c["value"] for c in CODES[group]}
    assert front, f"{const} 가 비어 있다 — 파싱이 깨졌나?"
    assert server - front == set(), f"서버 CODES['{group}'] 에만 있음 (프론트 {const} 에 함수 추가): {sorted(server - front)}"
    assert front - server == set(), f"프론트 {const} 에만 있음 (CODES['{group}'] 에 이름 추가): {sorted(front - server)}"
