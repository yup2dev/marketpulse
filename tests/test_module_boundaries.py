"""모듈 경계 검사 — Web·Batch·Fetcher 는 서로의 코드를 import 하지 않는다.

공통 모듈(MarketpulseCommon)을 없애면서 각자 ORM·엔진·로거를 따로 갖게 했다.
경계가 다시 무너지지 않도록 import 문을 AST 로 훑는다.

    Web     → Fetcher          (index_analyzer 금지)
    Batch   → Fetcher          (app 금지)
    Fetcher → (없음)           (app, index_analyzer 금지)
"""
import ast
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]

RULES = {
    "MarketpulseWeb/app": {"index_analyzer"},
    "MarketpulseBatch": {"app"},
    "MarketpulseFetcher/data_fetcher": {"app", "index_analyzer"},
}


def _imported_roots(path: Path):
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                yield node.lineno, alias.name.split(".")[0]
        elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
            yield node.lineno, node.module.split(".")[0]


@pytest.mark.parametrize("folder", list(RULES))
def test_no_cross_module_imports(folder):
    base = ROOT / folder
    files = [p for p in base.rglob("*.py") if "node_modules" not in p.parts]
    assert files, f"{folder} 에서 .py 를 하나도 못 찾았다 — 경로가 바뀌었나?"

    forbidden = RULES[folder]
    violations = [
        f"{p.relative_to(ROOT)}:{lineno} → {root}"
        for p in files
        for lineno, root in _imported_roots(p)
        if root in forbidden
    ]
    assert not violations, "모듈 경계 위반:\n" + "\n".join(violations)


def test_common_package_is_gone():
    """marketpulse_common 을 다시 만들지 않는다 — 공유가 필요하면 계약(ingest)으로."""
    assert not (ROOT / "MarketpulseCommon").exists()
