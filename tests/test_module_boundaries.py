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


# 웹 API 레이어는 MarketpulseWeb/app/backend/platform/ 에 있다. PC exe 에 들어가는 fetcher 패키지에는 두지 않는다.
WEB_ONLY_CLASSES = {"OBBject", "Query", "Router", "CommandRunner", "Fetch", "ProviderInterface", "Concept"}


def test_fetcher_does_not_define_web_layer():
    """data_fetcher 안에 OBBject · Router · CommandRunner 같은 웹 레이어 클래스를 다시 만들지 않는다."""
    base = ROOT / "MarketpulseFetcher/data_fetcher"
    violations = [
        f"{p.relative_to(ROOT)}:{node.lineno} → class {node.name}"
        for p in base.rglob("*.py")
        for node in ast.walk(ast.parse(p.read_text(encoding="utf-8"), filename=str(p)))
        if isinstance(node, ast.ClassDef) and node.name in WEB_ONLY_CLASSES
    ]
    assert not violations, "웹 레이어는 app/backend/platform/ 에:\n" + "\n".join(violations)
    assert (ROOT / "MarketpulseWeb/app/backend/platform/obbject.py").exists()


def test_common_package_is_gone():
    """marketpulse_common 을 다시 만들지 않는다 — 공유가 필요하면 계약(ingest)으로."""
    assert not (ROOT / "MarketpulseCommon").exists()


# ── fetcher ↔ command 경계 ─────────────────────────────────────────────────────
#
# fetcher 는 provider 하나의 응답을 표준 모델로 맞추기만 한다 (필드 이름 · 단위 · 날짜 · 페이지 넘김).
# 파생 지표 · 여러 모델 조합 · 점수 같은 분석은 백엔드 command(app/backend/commands/)가 한다.
# 기준: "provider 를 바꾸면 이 코드도 바뀌어야 하나?" — 바뀌어야 하면 fetcher, 아니면 command.
#
# 그래서 fetcher 안에서 QueryExecutor 나 다른 fetcher 를 부르면 실패하고, .pct_change( · .rolling( 같은
# 분석 호출이 나와도 실패한다.
# 아래 세 목록은 이 규칙 이전에 있던 위반이다. 새로 늘리지 않고, 정리하면서 지운다 (줄기만 한다).

PROVIDERS_DIR = ROOT / "MarketpulseFetcher/data_fetcher/providers"
COMMANDS_DIR = ROOT / "MarketpulseWeb/app/backend/commands"

# FREDGenericSeriesFetcher / KOSIS series 같은 같은 provider 의 기본 fetcher 를 재사용하는 fetcher.
# 다음 브랜치에서 fred_series() 같은 HTTP 헬퍼로 바꾸면서 목록에서 지울 예정.
# (sec 의 filings 목록 · 기관 목록 재사용도 같은 방식으로 정리한다)
SERIES_COMPOSITION = {
    "api/fred/models/consumer_sentiment.py",
    "api/fred/models/cpi.py",
    "api/fred/models/employment.py",
    "api/fred/models/fed_balance_sheet.py",
    "api/fred/models/gdp.py",
    "api/fred/models/housing_starts.py",
    "api/fred/models/industrial_production.py",
    "api/fred/models/initial_claims.py",
    "api/fred/models/interest_rate.py",
    "api/fred/models/nonfarm_payroll.py",
    "api/fred/models/pmi.py",
    "api/fred/models/retail_sales.py",
    "api/fred/models/real_rates.py",            # 여러 시리즈를 날짜로 모으기만 (계산 없음)
    "api/fred/models/yield_curve.py",
    "api/fred/models/yield_curve_history.py",
    "api/fred/models/unemployment.py",
    "api/kosis/models/capacity_utilization.py",
    "api/kosis/models/ict_exports.py",
    "api/kosis/models/mining_manufacturing_index.py",
    "api/kosis/models/product_trade.py",
    "api/sec/models/insider_trading.py",          # sec/utils/form4 를 거쳐 filings 목록
    "api/sec/models/institutional_13f.py",
    "api/sec/models/management_discussion_analysis.py",
    "api/sec/utils/form4.py",
    "api/sec/utils/parse_13f.py",
}

# fetcher 안에서 분석(파생 지표 · 점수 · 여러 모델 조합)을 하던 것 — 비었다 (#105).
# fred 분석 13개 → commands/regime · inflation · labor · market_conditions, polygon 뉴스 감성 → news_sentiment,
# quantitative provider 7개 → commands/quant. 새로 넣지 않는다.
ANALYSIS_TO_COMMAND: set = set()

# 다른 fetcher 를 부르지 않고 받은 값으로 직접 분석하는 것 (호출 검사로는 안 잡힌다).
# (fred 파생 칸 11개는 FRED units(pch · pc1 · chg · ch1)와 FRED 이동평균 시리즈로 요청하게 바꿔 목록에서 지웠고,
#  yahoo 해자 · 스코어카드 · SWOT · 분기 손익, fmp 세그먼트 전년 대비, 소셜 감성 비율, db 펀드 누적 수익률은
#  commands/fundamentals · sentiment · portfolio 로 옮겼다 — #104)
ANALYSIS_IN_PLACE: set = set()

_FETCH_METHODS = {"fetch_data", "afetch_data", "aextract_data", "extract_data"}


def _direct_calls(path: Path):
    """파일 안에서 QueryExecutor · 다른 fetcher 를 직접 부르는 곳 (줄, 설명)."""
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    own_classes = {n.name for n in ast.walk(tree) if isinstance(n, ast.ClassDef)}
    for node in ast.walk(tree):
        if isinstance(node, ast.Name) and node.id == "QueryExecutor":
            yield node.lineno, "QueryExecutor"
        elif isinstance(node, ast.ImportFrom) and (node.module or "").startswith("data_fetcher.providers."):
            if ".models." in node.module:
                for alias in node.names:
                    if alias.name.endswith("Fetcher"):
                        yield node.lineno, f"import {alias.name}"
        elif (isinstance(node, ast.Attribute) and node.attr in _FETCH_METHODS
              and isinstance(node.value, ast.Name) and node.value.id.endswith("Fetcher")
              and node.value.id not in own_classes):
            yield node.lineno, f"{node.value.id}.{node.attr}"


def _module_name(path: Path) -> str:
    return "data_fetcher.providers." + ".".join(path.relative_to(PROVIDERS_DIR).with_suffix("").parts)


_TAINTED: dict = {}


def _tainted_helpers() -> set:
    """직접 위반이 있는 헬퍼 모듈 (models/ 밖, 예: quantitative/utils/prices.py) — 이걸 쓰면 간접 위반."""
    if not _TAINTED:
        _TAINTED["mods"] = {
            _module_name(p) for p in _provider_files()
            if "models" not in p.relative_to(PROVIDERS_DIR).parts and list(_direct_calls(p))
        }
    return _TAINTED["mods"]


def _fetcher_calls(path: Path):
    """fetcher 안에서 QueryExecutor · 다른 fetcher 를 부르는 곳 — 헬퍼를 거친 간접 호출도."""
    yield from _direct_calls(path)
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module in _tainted_helpers():
            yield node.lineno, f"via {node.module}"


def _provider_files():
    # provider 패키지 __init__.py 는 등록하느라 fetcher 를 import 한다 — 검사 대상이 아니다
    return sorted(p for p in PROVIDERS_DIR.rglob("*.py") if p.name != "__init__.py")


def test_fetcher_does_not_call_query_executor_or_other_fetchers():
    allowed = SERIES_COMPOSITION | ANALYSIS_TO_COMMAND
    violations = []
    for p in _provider_files():
        rel = p.relative_to(PROVIDERS_DIR).as_posix()
        if rel in allowed:
            continue
        violations += [f"{rel}:{line} → {what}" for line, what in _fetcher_calls(p)]
    assert not violations, (
        "fetcher 안에서 QueryExecutor · 다른 fetcher 호출 — 분석 · 조합은 app/backend/commands/ 로:\n"
        + "\n".join(violations)
    )


def test_allowlists_only_shrink():
    """정리된 파일이 목록에 남아 있으면 실패 — 지운 위반은 목록에서도 지운다."""
    stale = sorted(
        rel for rel in SERIES_COMPOSITION | ANALYSIS_TO_COMMAND
        if not (PROVIDERS_DIR / rel).exists() or not list(_fetcher_calls(PROVIDERS_DIR / rel))
    )
    assert not stale, "더 이상 위반이 아닌데 허용 목록에 남아 있다 — 목록에서 지울 것:\n" + "\n".join(stale)
    assert not SERIES_COMPOSITION & ANALYSIS_TO_COMMAND


# ── 분석 흔적 (AST) ──────────────────────────────────────────────────────────
# 강제하는 것: pandas · numpy · scipy 식 분석 호출. 목록 정리 판단(줄기만)에는 아래 산술 흔적도 본다.
ANALYSIS_METHODS = {
    "pct_change", "rolling", "cumprod", "cumsum", "corr", "cov", "diff", "ewm", "expanding",
    "corrcoef", "linregress",
}


def _analysis_calls(tree):
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)                 and node.func.attr in ANALYSIS_METHODS:
            yield node.lineno, f".{node.func.attr}("


def _names(node) -> str:
    return " ".join(n.id if isinstance(n, ast.Name) else n.attr if isinstance(n, ast.Attribute)
                    else str(n.value) if isinstance(n, ast.Constant) else ""
                    for n in ast.walk(node)).lower()


def _analysis_traces(tree):
    """분석 호출 + 손으로 쓴 분석: 직전 대비(x - prev…), 합/개수 평균, 복리 누적(*=), 0~100 점수 자르기."""
    yield from _analysis_calls(tree)
    for node in ast.walk(tree):
        if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Sub)                 and any(k in _names(node.right) for k in ("prev", "year_ago", "baseline", "prv")):
            yield node.lineno, "직전 대비"
        elif isinstance(node, ast.BinOp) and isinstance(node.op, ast.Div) and isinstance(node.left, ast.Call)                 and getattr(node.left.func, "id", "") == "sum":
            yield node.lineno, "sum(...)/n"
        elif isinstance(node, ast.AugAssign) and isinstance(node.op, ast.Mult):
            yield node.lineno, "*= (누적)"
        elif isinstance(node, ast.Call) and getattr(node.func, "id", "") in ("min", "max")                 and any(isinstance(a, ast.Constant) and a.value in (0, 100) for a in node.args):
            yield node.lineno, "점수 자르기"
        elif isinstance(node, ast.BinOp) and isinstance(node.op, ast.Div)                 and isinstance(node.left, ast.BinOp) and isinstance(node.left.op, ast.Sub):
            yield node.lineno, "(a - b) / c"
        elif isinstance(node, ast.BinOp) and isinstance(node.op, ast.Mult) and isinstance(node.left, ast.BinOp)                 and isinstance(node.left.op, ast.Div) and isinstance(node.right, ast.Constant) and node.right.value == 100:
            yield node.lineno, "a / b * 100 (비중)"


def _tree(path: Path):
    return ast.parse(path.read_text(encoding="utf-8"), filename=str(path))


def test_fetcher_has_no_analysis_calls():
    allowed = ANALYSIS_IN_PLACE | ANALYSIS_TO_COMMAND
    violations = []
    for p in _provider_files():
        rel = p.relative_to(PROVIDERS_DIR).as_posix()
        if rel in allowed:
            continue
        violations += [f"{rel}:{line} → {what}" for line, what in _analysis_calls(_tree(p))]
    assert not violations, (
        "fetcher 안에서 분석 호출 — 증감률은 provider 에 요청(FRED units 등)하거나 app/backend/commands/ 로:\n"
        + "\n".join(violations)
    )


def test_analysis_in_place_only_shrinks():
    """분석 흔적이 없어진 파일이 ANALYSIS_IN_PLACE 에 남아 있으면 실패."""
    stale = sorted(
        rel for rel in ANALYSIS_IN_PLACE
        if not (PROVIDERS_DIR / rel).exists() or not list(_analysis_traces(_tree(PROVIDERS_DIR / rel)))
    )
    assert not stale, "분석이 없어졌는데 ANALYSIS_IN_PLACE 에 남아 있다 — 목록에서 지울 것:\n" + "\n".join(stale)
    assert not ANALYSIS_IN_PLACE & ANALYSIS_TO_COMMAND


# commands/<도메인>/ 안에서 provider 이름을 써도 되는 곳:
#   router.py           inputs(Fetch) 선언 — 어느 provider · model 을 받을지 여기서 정한다
#   DATA_ACCESS_MODULES 배치가 적재한 DB(db provider) · 실시간 랭킹 소스를 직접 읽는 모듈 (예전 services/)
# 나머지(계산 모듈)는 provider 를 모른다 — 행을 받아 계산만 한다.
DATA_ACCESS_MODULES = {
    "industry/datasets.py", "industry/seed.py", "screener/screens.py",
    "stock/quotes.py", "stock/ranking.py", "stock/relations.py", "stock/universe.py", "strategies/engine.py",
}


def test_commands_do_not_name_providers():
    """계산 모듈은 provider 를 모른다 — 어떤 provider · model 을 받을지는 router.py 의 inputs(Fetch)가 정한다."""
    import data_fetcher.providers_init  # noqa: F401 — 등록된 provider 이름
    from data_fetcher.abstract_provider.abstract.provider import ProviderRegistry

    names = set(ProviderRegistry.list())
    files = sorted(p for p in COMMANDS_DIR.rglob("*.py")
                   if p.name != "router.py" and p.relative_to(COMMANDS_DIR).as_posix() not in DATA_ACCESS_MODULES)
    assert files, "app/backend/commands/ 를 못 찾았다 — 경로가 바뀌었나?"

    violations = []
    for p in files:
        tree = ast.parse(p.read_text(encoding="utf-8"), filename=str(p))
        for node in ast.walk(tree):
            if isinstance(node, ast.Constant) and isinstance(node.value, str) and node.value in names:
                violations.append(f"{p.relative_to(ROOT)}:{node.lineno} → '{node.value}'")
            elif isinstance(node, (ast.Import, ast.ImportFrom)):
                mods = [a.name for a in node.names] if isinstance(node, ast.Import) else [node.module or ""]
                violations += [f"{p.relative_to(ROOT)}:{node.lineno} → import {m}"
                               for m in mods if m.startswith("data_fetcher.providers")]
    assert not violations, "command 가 provider 를 직접 쓴다:\n" + "\n".join(violations)


def test_analysis_detectors_catch_known_shapes():
    """검사기가 실제로 잡는지 — 잡지 못하면 위 검사들이 조용히 통과한다."""
    calls = ast.parse("df['close'].pct_change()\ns.rolling(4).mean()\nx.cumprod()")
    assert {w for _, w in _analysis_calls(calls)} == {".pct_change(", ".rolling(", ".cumprod("}

    hand = ast.parse(
        "a = (v - prev_v) / prev_v * 100\n"
        "b = sum(xs) / 4\n"
        "c *= 1 + r\n"
        "d = max(0, min(100, s))\n"
        "e = round(n / total * 100, 1)\n"
    )
    found = {w for _, w in _analysis_traces(hand)}
    assert {"직전 대비", "sum(...)/n", "*= (누적)", "점수 자르기", "a / b * 100 (비중)"} <= found
    assert not list(_analysis_traces(ast.parse("x = row['value']\ny = float(v) * 100")))
