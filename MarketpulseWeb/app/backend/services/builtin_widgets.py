"""기본 제공 위젯의 기본값 — 데이터 파일(builtin_widgets/<widget_id>.json) ↔ DB 행.

기본 제공 위젯은 DB 행(user_widgets, user_id NULL)으로 쓰인다. 이 모듈은 그 행의 '기본값'을 파일로 들고,
서로 바꾼다 — 검증 · DB 반영(동기화)은 user_widget_service 가 한다.

  파일 하나 = 위젯 하나. 값이 없는 칸은 적지 않는다. 키는 DB 컬럼 이름을 따른다:
    {
      "widget_id": "quant-ranking", "sort_seq": 380, "name": ..., "view_type": "table", ...,
      "size": {"w": 5, "h": 6, "min_w": 4, "min_h": 3},
      "params":  [{"param_name", "label", "param_value", "options": [{"option_value", "label", "option_params"}]}],
      "fields":  [{"field_name", "field_role", "format", "label", "width", "sub_field", "quote_field"}],
      "tabs":    [{"tab_code", "label", "filter", "empty_text", "items": [{"symbol", "name"}]}],
      "options": {"이름": "값"},
      "screens": [{"screen", "tab", "x", "y", "w", "h"}]       # screen '*' = 모든 화면의 메뉴에만
    }

  해시(spec_hash) — 파일 내용 그대로의 지문. DB 에 '마지막으로 파일에서 넣은 지문'을 남겨 두고
  (user_widget_seeds), 행이 그 지문 그대로면 아무도 손대지 않은 것이라 파일이 바뀌면 새 값으로 바꾼다.
  위젯 정의를 바꿀 때 마이그레이션을 쓰지 않는다 — 파일만 고친다.

파일 ↔ DB: row_to_spec(행) 은 파일과 같은 모양을 돌려주고, build_row(spec) 는 그 반대다.
둘은 서로 되돌릴 수 있어야 한다 (tests/test_builtin_widgets.py 가 모든 파일로 검사).
DB 에서 파일로 내보내기: python -m app.backend.scripts.builtin_widgets export
"""
import hashlib
import json
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Optional

from app.backend.models.orm import (
    UserWidget, UserWidgetField, UserWidgetOption, UserWidgetParam, UserWidgetParamOption,
    UserWidgetScreen, UserWidgetTab, UserWidgetTabItem,
)

WIDGET_DIR = Path(__file__).resolve().parent.parent / "builtin_widgets"
# 화면 단위 파라미터 그룹(user_screen_groups)의 기본 행 — 한 파일에 전부 (몇십 행)
SCREEN_GROUP_FILE = Path(__file__).resolve().parent.parent / "builtin_screen_groups.json"
DEFAULT_GROUP = "Home"

# 위젯 칸 (파일 키 = 컬럼 이름) — 순서는 파일에 쓰는 순서
COLUMNS = (
    "name", "description", "group_name", "view_type", "use_yn", "title", "endpoint", "data_path", "source",
    "source_note", "transform", "quote_key", "refresh_sec", "live_yn", "default_symbol", "empty_text",
)
# 값이 이것이면 파일에 적지 않는다 (DB 기본값)
DEFAULTS = {"use_yn": "Y", "live_yn": "N", "group_name": DEFAULT_GROUP}
FIELD_COLUMNS = ("field_name", "field_role", "format", "label", "width", "sub_field", "quote_field")
TAB_COLUMNS = ("tab_code", "label", "filter", "empty_text")


def _compact(d: dict) -> dict:
    """None · 빈 목록 · 빈 dict 은 뺀다 — 파일에 적지 않는 값."""
    return {k: v for k, v in d.items() if v is not None and v != [] and v != {}}


# ── 파일 ──────────────────────────────────────────────────────────────────────

def load_specs(directory: Optional[Path] = None) -> List[dict]:
    """파일들을 sort_seq · widget_id 순으로. 파일 이름과 widget_id 가 다르면 알린다."""
    return list(_load(str(directory or WIDGET_DIR)))


@lru_cache(maxsize=4)
def _load(directory: str) -> tuple:
    specs = []
    for path in sorted(Path(directory).glob("*.json")):
        spec = json.loads(path.read_text(encoding="utf-8"))
        if spec.get("widget_id") != path.stem:
            raise ValueError(f"{path.name}: widget_id 가 파일 이름과 달라요 ({spec.get('widget_id')})")
        specs.append(spec)
    return tuple(sorted(specs, key=lambda s: (s.get("sort_seq", 0), s["widget_id"])))


def load_screen_groups(path: Optional[Path] = None) -> List[dict]:
    """화면 그룹 기본 행. 한 행 = {screen, tab, group_code, widget_id, param_name[, source][, required]}
    source(기본 false) = 행을 누르면 값을 내보내는 위젯 · required(기본 true) = 값이 생길 때까지 요청하지 않는다.
    서비스는 DB 에 없는 행만, 위젯 행이 있는 것만 넣는다 (user_widget_service._seed_screen_groups)."""
    path = path or SCREEN_GROUP_FILE
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def spec_hashes(directory: Optional[Path] = None) -> Dict[str, str]:
    return dict(_hashes(str(directory or WIDGET_DIR)))


@lru_cache(maxsize=4)
def _hashes(directory: str) -> tuple:
    return tuple((s["widget_id"], spec_hash(s)) for s in _load(directory))


def spec_hash(spec: dict) -> str:
    text = json.dumps(spec, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def dump(spec: dict) -> str:
    """파일에 쓰는 글 — 사람이 읽고 고치기 좋게 (키 순서는 row_to_spec 의 순서).
    값만 든 작은 객체(크기 · 필드 · 화면 배치 하나)는 한 줄로 쓴다."""
    return _pretty(spec, 0) + "\n"


LINE = 120


def _pretty(v, depth: int) -> str:
    one = json.dumps(v, ensure_ascii=False, separators=(", ", ": "))
    if not isinstance(v, (dict, list)):
        return one   # 글자 · 숫자는 길어도 한 덩어리
    flat = all(not isinstance(x, (dict, list)) for x in (v.values() if isinstance(v, dict) else v))
    if flat and len(one) + depth * 2 <= LINE:
        return one
    pad, inner = "  " * depth, "  " * (depth + 1)
    if isinstance(v, dict):
        body = ",\n".join(f"{inner}{json.dumps(k, ensure_ascii=False)}: {_pretty(x, depth + 1)}" for k, x in v.items())
        return "{\n" + body + "\n" + pad + "}"
    body = ",\n".join(inner + _pretty(x, depth + 1) for x in v)
    return "[\n" + body + "\n" + pad + "]"


def write_specs(specs: List[dict], directory: Optional[Path] = None) -> List[Path]:
    out = Path(directory or WIDGET_DIR)
    out.mkdir(parents=True, exist_ok=True)
    paths = []
    for spec in specs:
        path = out / f"{spec['widget_id']}.json"
        path.write_text(dump(spec), encoding="utf-8", newline="\n")
        paths.append(path)
    _load.cache_clear()
    _hashes.cache_clear()
    return paths


# ── 행 ↔ 파일 ─────────────────────────────────────────────────────────────────

def row_to_spec(w: UserWidget) -> dict:
    spec = {"widget_id": w.widget_id, "sort_seq": w.sort_seq}
    for c in COLUMNS:
        v = getattr(w, c)
        if v is not None and DEFAULTS.get(c) != v:
            spec[c] = v
    spec["size"] = _compact({"w": w.size_w, "h": w.size_h, "min_w": w.min_w, "min_h": w.min_h})
    spec["params"] = [
        _compact({
            "param_name": p.param_name, "label": p.label, "param_value": p.param_value,
            "options": [
                _compact({"option_value": o.option_value, "label": o.label, "option_params": o.option_params})
                for o in p.options
            ],
        })
        for p in w.params
    ]
    spec["fields"] = [_compact({c: getattr(f, c) for c in FIELD_COLUMNS}) for f in w.fields]
    spec["tabs"] = [
        _compact({**{c: getattr(t, c) for c in TAB_COLUMNS},
                  "items": [{"symbol": i.symbol, "name": i.name} for i in t.items]})
        for t in w.tabs
    ]
    spec["options"] = {o.opt_name: o.opt_value for o in sorted(w.options, key=lambda o: o.opt_name)}
    spec["screens"] = [
        _compact({"screen": s.screen, "tab": s.tab, "x": s.pos_x, "y": s.pos_y, "w": s.pos_w, "h": s.pos_h})
        for s in sorted(w.screens, key=lambda s: s.screen)
    ]
    return _compact(spec)


def build_row(spec: dict) -> UserWidget:
    """파일 → 새 행 (자식 행 포함). 검증은 부르는 쪽이 먼저 한다."""
    wid = spec["widget_id"]
    size = spec.get("size", {})
    w = UserWidget(
        widget_id=wid, user_id=None, sort_seq=spec.get("sort_seq", 0),
        size_w=size.get("w"), size_h=size.get("h"), min_w=size.get("min_w"), min_h=size.get("min_h"),
        **{c: spec.get(c, DEFAULTS.get(c)) for c in COLUMNS},
    )
    w.params = [
        UserWidgetParam(
            param_seq=i, param_name=p["param_name"], bind_type="INPUT", param_value=p.get("param_value"),
            label=p.get("label"),
            options=[
                UserWidgetParamOption(widget_id=wid, option_seq=j, option_value=o["option_value"],
                                      label=o["label"], option_params=o.get("option_params"))
                for j, o in enumerate(p.get("options", []))
            ],
        )
        for i, p in enumerate(spec.get("params", []))
    ]
    w.fields = [
        UserWidgetField(field_seq=i, **{c: f.get(c) for c in FIELD_COLUMNS})
        for i, f in enumerate(spec.get("fields", []))
    ]
    w.tabs = [
        UserWidgetTab(
            tab_seq=i, **{c: t.get(c) for c in TAB_COLUMNS},
            items=[UserWidgetTabItem(widget_id=wid, item_seq=j, symbol=it["symbol"], name=it["name"])
                   for j, it in enumerate(t.get("items", []))],
        )
        for i, t in enumerate(spec.get("tabs", []))
    ]
    w.options = [UserWidgetOption(opt_name=k, opt_value=str(v)) for k, v in spec.get("options", {}).items()]
    w.screens = [
        UserWidgetScreen(screen=s["screen"], tab=s.get("tab"), pos_x=s.get("x"), pos_y=s.get("y"),
                         pos_w=s.get("w"), pos_h=s.get("h"))
        for s in spec.get("screens", [])
    ]
    return w
