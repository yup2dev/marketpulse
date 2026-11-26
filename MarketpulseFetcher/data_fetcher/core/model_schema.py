"""(provider, model) 의 파라미터 · 응답 필드 — Fetcher 의 pydantic 모델에서 읽는다.

두 곳이 같은 규칙을 쓴다:
    GET /api/data/{provider}/{model}/schema   ProviderInterface.schema — 위젯 파라미터 폼 (dynamic=True)
    services/data_catalog.sync_catalog        DB 카탈로그(data_model_params · data_model_fields)로 적는다
                                              (dynamic=False — 동적 선택지는 부르지 않는다)
"""
import datetime as _dt
import enum
from typing import Any, Dict, List, Literal, Union, get_args, get_origin

# 날짜로 보는 응답 필드 이름 — 날짜 범위 후처리(api/deps.filter_dated_rows)도 이 목록을 쓴다
DATE_KEYS = ("date", "period_ending", "filing_date", "report_date", "datetime", "timestamp", "published_utc")

# 데이터에 날짜가 있는데 QueryParams 가 날짜 범위를 선언하지 않으면 붙이는 가상 파라미터.
# 실제 필터링은 /api/data 의 날짜 후처리가 한다.
VIRTUAL_DATE_SPECS = [
    {"name": "start_date", "label": "start_date", "kind": "date", "required": False,
     "default": None, "hint": "표시 시작일 (미지정 시 전체)"},
    {"name": "end_date", "label": "end_date", "kind": "date", "required": False,
     "default": None, "hint": "표시 종료일 (미지정 시 전체)"},
]


def _pydantic(cls) -> bool:
    from pydantic import BaseModel
    return isinstance(cls, type) and issubclass(cls, BaseModel)


def _unwrap(ann):
    if get_origin(ann) is Union:
        args = [a for a in get_args(ann) if a is not type(None)]
        return args[0] if args else ann
    return ann


def has_dynamic_choices(fetcher_cls) -> bool:
    """선택지를 그때그때 받아오는 fetcher 인지 (예: db 의 기관 목록)."""
    return callable(getattr(fetcher_cls, "resolve_param_choices", None))


def resolve_choices(fetcher_cls, dynamic: bool = True) -> Dict[str, Any]:
    """파라미터 선택지. resolve_param_choices()(동적) > param_choices(정적) > {}.
    dynamic=False 면 동적 선택지는 부르지 않는다 (DB · 네트워크를 탈 수 있다)."""
    try:
        fn = getattr(fetcher_cls, "resolve_param_choices", None)
        if callable(fn):
            if not dynamic:
                return {}
            pc = fn()
            return dict(pc) if isinstance(pc, dict) else {}
        pc = getattr(fetcher_cls, "param_choices", None)
        return dict(pc) if isinstance(pc, dict) else {}
    except Exception:  # noqa: BLE001
        return {}


def serialize_value(v: Any) -> Any:
    """스키마 default/choices 값을 JSON-호환으로 직렬화."""
    if isinstance(v, bool):
        return "true" if v else "false"   # 프론트 select 값과 일치
    if v is None or isinstance(v, (str, int, float)):
        return v
    if isinstance(v, (_dt.date, _dt.datetime)):
        return v.isoformat()[:10]
    if isinstance(v, enum.Enum):
        return serialize_value(v.value)
    return str(v)


def param_specs(fetcher_cls, dynamic: bool = True) -> List[dict]:
    """Fetcher QueryParams(pydantic) → 프론트 WidgetParamForm 스펙 목록.

    kind 추론: choices/Literal→select, bool→select(true/false),
    int/float→number, date/datetime 또는 *_date 이름→date, 그 외 text.
    """
    from pydantic_core import PydanticUndefined

    qp = fetcher_cls.query_params_type
    if not _pydantic(qp):
        return []

    choices_map = resolve_choices(fetcher_cls, dynamic=dynamic)
    extra_meta = getattr(qp, "__json_schema_extra__", {}) or {}

    specs = []
    for name, field in qp.model_fields.items():
        base = _unwrap(field.annotation)

        options = choices_map.get(name) or (extra_meta.get(name) or {}).get("choices")
        if not options and get_origin(base) is Literal:
            options = [serialize_value(a) for a in get_args(base)]

        if options:
            kind = "select"
        elif base is bool:
            kind, options = "select", ["true", "false"]
        elif base in (int, float):
            kind = "number"
        elif base in (_dt.date, _dt.datetime) or name.endswith("_date") or name == "date":
            kind = "date"
        else:
            kind = "text"

        default = field.get_default(call_default_factory=True)
        spec: Dict[str, Any] = {
            "name":     name,
            "label":    name,
            "kind":     kind,
            "required": field.is_required(),
            "default":  None if default is PydanticUndefined else serialize_value(default),
        }
        if options:
            opts = [serialize_value(o) if not isinstance(o, dict) else o for o in options]
            # 비필수 select에 기본값이 없으면 "미지정" 상태를 선택할 수 있게 빈 옵션 추가
            if not spec["required"] and spec["default"] in (None, ""):
                opts = [{"value": "", "label": "—"}, *opts]
            spec["options"] = opts
        if kind == "number":
            spec["step"] = 1 if base is int else "any"
        if (extra_meta.get(name) or {}).get("multiple_items_allowed"):
            spec["multiple"] = True               # 쉼표로 여러 값 (예: FRED series_id='DGS2,DGS10')
        if field.description:
            spec["hint"] = field.description
        specs.append(spec)
    return specs


def data_has_date(fetcher_cls) -> bool:
    """반환 Data 모델에 날짜 필드가 있는지 — 가상 날짜 범위 파라미터 노출 판단."""
    try:
        dt = fetcher_cls.data_type
        if not _pydantic(dt):
            return False
        fields = dt.model_fields
        return any(k in fields for k in DATE_KEYS) or any(k.endswith("_date") for k in fields)
    except Exception:  # noqa: BLE001
        return False


def data_fields(fetcher_cls) -> List[dict]:
    """반환 Data 모델(pydantic)의 필드 목록 — 사용자 위젯의 매핑 화면이 쓴다.

    kind: number | date | bool | text.  Data 모델이 extra 를 허용하면 실제 응답에는
    여기 없는 필드가 더 올 수 있다 (매핑 화면은 샘플 조회로 보충한다).
    """
    try:
        dt = fetcher_cls.data_type
        if not _pydantic(dt):
            return []
    except Exception:  # noqa: BLE001
        return []

    out = []
    for name, field in dt.model_fields.items():
        base = _unwrap(field.annotation)
        if base is bool:
            kind = "bool"
        elif base in (int, float):
            kind = "number"
        elif base in (_dt.date, _dt.datetime) or name.endswith("_date") or name in DATE_KEYS:
            kind = "date"
        else:
            kind = "text"
        out.append({"name": name, "kind": kind, "description": field.description or None,
                    **display_hints(field)})
    return out


def display_hints(field) -> Dict[str, Any]:
    """Data 필드의 화면 표시 힌트 (OpenBB 와 같은 json_schema_extra 키).

        x-unit_measurement   단위 — percent · currency · …
        x-frontend_multiply  화면에 보일 때 곱할 값 (0.0123 → 1.23% 면 100)
        x-widget_config      {prefix, suffix, hidden} — 접두사 · 접미사 · 기본 숨김

    위젯 만드는 화면의 초안(컬럼 형식 · 숨김)이 쓴다. 위젯 정의 DB 행에 값이 있으면 행이 우선한다.
    """
    extra = field.json_schema_extra if isinstance(field.json_schema_extra, dict) else {}
    cfg = extra.get("x-widget_config") if isinstance(extra.get("x-widget_config"), dict) else {}
    hints = {
        "unit": extra.get("x-unit_measurement"),
        "multiply": extra.get("x-frontend_multiply"),
        "prefix": cfg.get("prefix"),
        "suffix": cfg.get("suffix"),
        "hidden": bool(cfg.get("hidden")) or None,
    }
    return {k: v for k, v in hints.items() if v is not None}


def model_schema(fetcher_cls, dynamic: bool = True) -> Dict[str, Any]:
    """파라미터 + 응답 필드. 날짜 범위를 선언하지 않은 날짜 데이터에는 가상 파라미터를 붙인다."""
    params = param_specs(fetcher_cls, dynamic=dynamic)
    names = {p["name"] for p in params}
    if "start_date" not in names and "end_date" not in names and data_has_date(fetcher_cls):
        params = [*params, *VIRTUAL_DATE_SPECS]
    return {
        "accepts_symbol": any(p["name"] in ("symbol", "ticker") for p in params),
        "params":         params,
        "fields":         data_fields(fetcher_cls),
    }
