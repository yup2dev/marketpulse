"""모든 위젯에는 출처가 붙어야 한다 — 정적 검사.

- BaseWidget·WidgetCard 를 그리는 모든 컴포넌트는 source= 를 넘긴다
  (BaseWidget 은 하단 SourceFooter, WidgetCard 는 헤더 오른쪽에 출처를 그린다)
- 레지스트리(widgetEndpoints) 의 커스텀 컴포넌트는 BaseWidget·WidgetCard·SourceFooter 중 하나를 그린다
  (또는 그런 컴포넌트로 감싼다)
- 모든 data_fetcher provider·라우트 provider 값에 출처 라벨(ui/sources.js)이 있다
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "MarketpulseWeb" / "app" / "frontend" / "src"
WIDGETS = SRC / "components" / "widgets"
ROUTES = ROOT / "MarketpulseWeb" / "app" / "backend" / "api" / "routes"
PROVIDERS = ROOT / "MarketpulseFetcher" / "data_fetcher" / "providers"

# 사람이 볼 출처가 아닌 내부 응답 값 (메타 라우트 등)
NON_DATA_PROVIDERS = {"concepts", "registry", "static", "index_analyzer"}


def _jsx_files():
    return [p for p in (SRC / "components").rglob("*.jsx")]


def test_every_basewidget_usage_passes_source():
    missing = []
    for path in _jsx_files():
        text = path.read_text(encoding="utf-8")
        for m in re.finditer(r"<(?:BaseWidget|WidgetCard)\b(.*?)>", text, re.S):
            if "source=" not in m.group(1):
                missing.append(f"{path.relative_to(SRC)}:{text[:m.start()].count(chr(10)) + 1}")
    assert not missing, f"BaseWidget/WidgetCard without source=: {missing}"


def test_every_registry_component_renders_a_source():
    reg = (SRC / "registry" / "widgetEndpoints.js").read_text(encoding="utf-8")
    imports = dict(re.findall(r"import\s+(\w+)\s+from\s+'\.\./components/widgets/([\w/]+)'", reg))
    used = set(re.findall(r"component:\s*(\w+)", reg))
    renders_source = {}

    def has_source(name, rel, depth=0):
        if name in renders_source:
            return renders_source[name]
        text = (WIDGETS / f"{rel}.jsx").read_text(encoding="utf-8")
        ok = "<BaseWidget" in text or "<WidgetCard" in text or "<SourceFooter" in text
        if not ok and depth < 2:
            # 다른 위젯으로 감싸는 경우 (BacktestLab → ChartWidget)
            for child, child_rel in re.findall(r"import\s+(\w+)\s+from\s+'\./(\w+)'", text):
                if f"<{child}" in text and (WIDGETS / f"{child_rel}.jsx").exists() and has_source(child, child_rel, depth + 1):
                    ok = "source=" in text
                    break
        renders_source[name] = ok
        return ok

    missing = [n for n in used if not has_source(n, imports[n])]
    assert not missing, f"widgets without a source footer: {missing}"


def test_every_widget_spec_declares_a_source():
    """mp-widgets 스펙(defineWidget) 은 컴포넌트가 없으므로 스펙 안의 source: 를 본다."""
    missing = []
    for path in (SRC / "registry").glob("*.js"):
        text = path.read_text(encoding="utf-8")
        starts = [m.start() for m in re.finditer(r"=\s*defineWidget\(\{", text)]
        for i, start in enumerate(starts):
            block = text[start:starts[i + 1] if i + 1 < len(starts) else len(text)]
            if not re.search(r"^\s{2}source:", block, re.M):
                missing.append(f"{path.name}:{text[:start].count(chr(10)) + 1}")
    assert not missing, f"widget specs without source: {missing}"


def test_every_provider_has_a_source_label():
    labels_js = (WIDGETS / "ui" / "sources.js").read_text(encoding="utf-8")
    labels = set(re.findall(r"^\s+(\w+):\s+'", labels_js, re.M))

    providers = {p.name for p in PROVIDERS.iterdir() if p.is_dir() and not p.name.startswith("_")}
    providers -= {"declarative"}   # JSON 스펙 provider 들은 각자 이름(ecos 등)으로 답한다
    for py in ROUTES.glob("*.py"):
        text = py.read_text(encoding="utf-8")
        providers |= set(re.findall(r'provider(?:: str)? ?= ?"([a-z_]+)"', text))
        providers |= set(re.findall(r'_PROVIDER = "([a-z_]+)"', text))
    for spec in (PROVIDERS / "declarative" / "specs").glob("*.json"):
        providers.add(spec.stem.split(".")[0])

    missing = sorted(providers - labels - NON_DATA_PROVIDERS)
    assert not missing, f"add a label in ui/sources.js for: {missing}"
