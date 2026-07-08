"""
Universal Data Gateway
/api/data/{provider}/{model}?param=value ...

모든 단순 pass-through 엔드포인트를 대체합니다.
새 Fetcher 추가 시 이 파일은 수정 불필요 — providers_init.py 등록만으로 즉시 호출 가능.

사용 예:
    GET /api/data/fred/yield_curve
    GET /api/data/fred/gdp?period=5y&frequency=quarterly
    GET /api/data/yahoo/quote?symbol=AAPL
    GET /api/data/fmp/income_statement?symbol=AAPL
    GET /api/data/polygon/news?ticker=TSLA&limit=20
"""
import logging
from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Request

from app.backend.api.deps import route_handler, wrap_result
from data_fetcher.core.obbject import OBBject
from data_fetcher.query_executor import QueryExecutor, QueryExecutorError

log = logging.getLogger(__name__)
router = APIRouter()


def _coerce(value: str) -> Any:
    """Query string 값을 적절한 Python 타입으로 변환."""
    if value.lower() == "true":
        return True
    if value.lower() == "false":
        return False
    try:
        return int(value)
    except ValueError:
        pass
    try:
        return float(value)
    except ValueError:
        pass
    return value


def _lookup_fetcher(provider: str, model: str):
    """ProviderRegistry에서 (provider, model) fetcher 클래스 조회. 없으면 None."""
    try:
        from data_fetcher.abstract_provider.abstract.provider import ProviderRegistry
        prov = ProviderRegistry.get_all().get(provider)
        return prov.fetcher_dict.get(model) if prov else None
    except Exception:  # noqa: BLE001
        return None


def _qp_fields(fetcher_cls) -> dict:
    """Fetcher QueryParams(pydantic)의 model_fields. 해석 불가 시 빈 dict."""
    try:
        from pydantic import BaseModel
        qp = fetcher_cls.query_params_type
        if isinstance(qp, type) and issubclass(qp, BaseModel):
            return qp.model_fields
    except Exception:  # noqa: BLE001
        pass
    return {}


# 행 dict에서 날짜 필드로 인정하는 키 (우선순위 순)
_DATE_KEYS = ("date", "period_ending", "filing_date", "report_date", "datetime", "timestamp")


def _row_date_key(rows: list) -> str | None:
    """행 목록의 날짜 필드 키. 첫 행 기준 우선순위 매칭, 없으면 *_date 아무거나."""
    if not rows or not isinstance(rows[0], dict):
        return None
    first = rows[0]
    for k in _DATE_KEYS:
        if k in first:
            return k
    return next((k for k in first if k.endswith("_date")), None)


def _postprocess_dated_rows(rows: list, start_date: Any, end_date: Any) -> list:
    """날짜 필드가 있는 행 목록의 공통 후처리.

    - start_date/end_date 가 주어지면 범위 밖 행 제거 (fetcher가 자체 지원하지 않는
      모델도 위젯의 날짜 선택이 동작하도록 하는 범용 필터 — 이중 적용은 무해)
    - 날짜 desc 정렬 (최신이 위로)

    wrap_result 이후의 JSON 직렬화 행(dict, 날짜는 ISO 문자열)을 전제로
    문자열 prefix(YYYY-MM-DD) 비교를 쓴다.
    """
    key = _row_date_key(rows)
    if key is None:
        return rows

    def day(row: dict) -> str | None:
        v = row.get(key)
        return str(v)[:10] if v not in (None, "") else None

    if start_date or end_date:
        lo = str(start_date)[:10] if start_date else None
        hi = str(end_date)[:10] if end_date else None
        rows = [
            r for r in rows
            if (d := day(r)) is not None and (lo is None or d >= lo) and (hi is None or d <= hi)
        ]
    return sorted(rows, key=lambda r: day(r) or "", reverse=True)


@router.get("/{provider}/{model}")
@route_handler
async def fetch_data(
    provider: str,
    model: str,
    request: Request,
) -> OBBject:
    """
    범용 데이터 조회 엔드포인트.

    - provider: ProviderRegistry에 등록된 제공자 이름 (fred, yahoo, fmp, polygon ...)
    - model:    해당 provider의 fetcher_dict 키 (yield_curve, quote, income_statement ...)
    - query params: Fetcher의 QueryParams 필드에 그대로 전달

    복잡한 비즈니스 로직이 필요한 경우(여러 fetcher 조합, 점수 계산 등)는
    기존 서비스 메서드를 별도 엔드포인트로 유지합니다.
    """
    params: Dict[str, Any] = {k: _coerce(v) for k, v in request.query_params.items()}

    fetcher_cls = _lookup_fetcher(provider, model)
    qp_fields = _qp_fields(fetcher_cls) if fetcher_cls else {}

    # 위젯 계층이 무조건 주입하는 symbol/ticker 제거 — 모델이 해당 파라미터를
    # 선언하지 않으면(institution 계열 등) 잘못된 파라미터로 fetcher가 깨진다.
    # (BaseQueryParams extra='allow'라 _filter_extra_params가 걸러주지 않음)
    if qp_fields:
        aliases = {f.alias for f in qp_fields.values() if f.alias}
        for k in ("symbol", "ticker"):
            if k in params and k not in qp_fields and k not in aliases:
                params.pop(k)

    # period → start_date / end_date 자동 변환.
    # 단, 모델 자체가 period 파라미터를 선언하면(예: financials의 annual/quarterly)
    # 날짜 범위 축약이 아니므로 그대로 전달한다.
    if "period" in params and "start_date" not in params and "period" not in qp_fields:
        from data_fetcher.utils.helpers import parse_period_to_dates
        start_date, end_date = parse_period_to_dates(str(params.pop("period")))
        params["start_date"] = start_date
        params["end_date"] = end_date

    try:
        raw = await QueryExecutor.fetch(provider, model, params)
    except QueryExecutorError as e:
        msg = str(e)
        if "not found" in msg.lower():
            raise HTTPException(status_code=404, detail=msg)
        raise HTTPException(status_code=400, detail=msg)

    obb = wrap_result(raw, provider)
    # 날짜 필드가 있는 데이터 공통 후처리: 날짜 범위 필터 + desc 정렬.
    # QP가 start/end를 선언하지 않는 fetcher도 위젯의 날짜 선택이 동작한다.
    obb.results = _postprocess_dated_rows(
        obb.results, params.get("start_date"), params.get("end_date")
    )
    return obb


# ── QueryParams → 위젯 파라미터 폼 스키마 추출 ────────────────────────────────
def _resolve_choices(fetcher_cls) -> Dict[str, Any]:
    """파라미터 선택지. resolve_param_choices()(동적) > param_choices(정적) > {}."""
    try:
        fn = getattr(fetcher_cls, "resolve_param_choices", None)
        if callable(fn):
            pc = fn()
            return dict(pc) if isinstance(pc, dict) else {}
        pc = getattr(fetcher_cls, "param_choices", None)
        return dict(pc) if isinstance(pc, dict) else {}
    except Exception:
        return {}


def _serialize_value(v: Any) -> Any:
    """스키마 default/choices 값을 JSON-호환으로 직렬화."""
    import datetime as _dt
    import enum
    if isinstance(v, bool):
        return "true" if v else "false"   # 프론트 select 값과 일치
    if v is None or isinstance(v, (str, int, float)):
        return v
    if isinstance(v, (_dt.date, _dt.datetime)):
        return v.isoformat()[:10]
    if isinstance(v, enum.Enum):
        return _serialize_value(v.value)
    return str(v)


def _param_specs(fetcher_cls) -> list[dict]:
    """Fetcher QueryParams(pydantic) → 프론트 WidgetParamForm 스펙 목록.

    kind 추론: choices/Literal→select, bool→select(true/false),
    int/float→number, date/datetime 또는 *_date 이름→date, 그 외 text.
    """
    import datetime as _dt
    from typing import Literal, Union, get_args, get_origin
    from pydantic import BaseModel
    from pydantic_core import PydanticUndefined

    qp = fetcher_cls.query_params_type
    if not (isinstance(qp, type) and issubclass(qp, BaseModel)):
        return []

    choices_map = _resolve_choices(fetcher_cls)
    extra_meta = getattr(qp, "__json_schema_extra__", {}) or {}

    def unwrap(ann):
        if get_origin(ann) is Union:
            args = [a for a in get_args(ann) if a is not type(None)]
            return args[0] if args else ann
        return ann

    specs = []
    for name, field in qp.model_fields.items():
        base = unwrap(field.annotation)

        options = choices_map.get(name) or (extra_meta.get(name) or {}).get("choices")
        if not options and get_origin(base) is Literal:
            options = [_serialize_value(a) for a in get_args(base)]

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
            "default":  None if default is PydanticUndefined else _serialize_value(default),
        }
        if options:
            opts = [_serialize_value(o) if not isinstance(o, dict) else o for o in options]
            # 비필수 select에 기본값이 없으면 "미지정" 상태를 선택할 수 있게 빈 옵션 추가
            if not spec["required"] and spec["default"] in (None, ""):
                opts = [{"value": "", "label": "—"}, *opts]
            spec["options"] = opts
        if kind == "number":
            spec["step"] = 1 if base is int else "any"
        if field.description:
            spec["hint"] = field.description
        specs.append(spec)
    return specs


def _data_has_date(fetcher_cls) -> bool:
    """반환 Data 모델에 날짜 필드가 있는지 — 가상 날짜 범위 파라미터 노출 판단."""
    try:
        from pydantic import BaseModel
        dt = fetcher_cls.data_type
        if not (isinstance(dt, type) and issubclass(dt, BaseModel)):
            return False
        fields = dt.model_fields
        return any(k in fields for k in _DATE_KEYS) or any(k.endswith("_date") for k in fields)
    except Exception:  # noqa: BLE001
        return False


_VIRTUAL_DATE_SPECS = [
    {"name": "start_date", "label": "start_date", "kind": "date", "required": False,
     "default": None, "hint": "표시 시작일 (미지정 시 전체)"},
    {"name": "end_date", "label": "end_date", "kind": "date", "required": False,
     "default": None, "hint": "표시 종료일 (미지정 시 전체)"},
]


@router.get("/{provider}/{model}/schema")
async def get_model_schema(provider: str, model: str) -> Dict[str, Any]:
    """(provider, model) 쌍의 파라미터 폼 스키마.

    UniversalWidget이 provider 셀렉터 변경 시 호출 — 선택된 provider의
    QueryParams(표준모델 + provider 전용 필드)로 파라미터 폼을 자동 생성한다.
    """
    from data_fetcher.abstract_provider.abstract.provider import ProviderRegistry

    prov = ProviderRegistry.get_all().get(provider)
    if prov is None:
        raise HTTPException(status_code=404, detail=f"Provider '{provider}' not found")
    fetcher_cls = prov.fetcher_dict.get(model)
    if fetcher_cls is None:
        raise HTTPException(status_code=404, detail=f"Model '{model}' not found for provider '{provider}'")

    params = _param_specs(fetcher_cls)
    # 데이터에 날짜가 있는데 QP가 날짜 범위를 선언하지 않으면 가상 파라미터로 노출.
    # 실제 필터링은 fetch_data의 _postprocess_dated_rows가 공통 수행한다.
    names = {p["name"] for p in params}
    if "start_date" not in names and "end_date" not in names and _data_has_date(fetcher_cls):
        params = [*params, *_VIRTUAL_DATE_SPECS]
    return {
        "provider":       provider,
        "model":          model,
        "accepts_symbol": any(p["name"] in ("symbol", "ticker") for p in params),
        "params":         params,
    }


@router.get("/")
async def list_providers() -> OBBject:
    """등록된 모든 provider와 지원 model 목록 반환.

    각 model 항목에 required_params 포함 — 프론트엔드가 필수 파라미터 유무를
    미리 확인하여 symbol 자동 주입 여부를 결정하는 데 사용.

    제외: 복잡한 파라미터 폼이 필요한 provider (quantlib, quantitative) →
          이미 WIDGET_ENDPOINTS에 전용 params 폼으로 등록되어 있음.
    """
    from pydantic import BaseModel
    from data_fetcher.abstract_provider.abstract.provider import ProviderRegistry
    # 복잡한 계산 provider는 Data 탭이 아닌 Widgets Library 탭에서만 사용
    _EXCLUDE = frozenset({'quantlib', 'quantitative'})

    def _required_params(fetcher_cls) -> list[str]:
        """Fetcher의 QueryParams 중 기본값 없는 필수 필드 이름 반환."""
        try:
            qp = fetcher_cls.query_params_type
            if not (isinstance(qp, type) and issubclass(qp, BaseModel)):
                return []
            return [
                name
                for name, field in qp.model_fields.items()
                if field.is_required()
            ]
        except Exception:
            return []

    def _accepts_symbol(fetcher_cls) -> bool:
        """모델 QueryParams가 symbol 필드를 갖는지 → 심볼 셀렉터 노출 여부."""
        try:
            qp = fetcher_cls.query_params_type
            return bool(isinstance(qp, type) and issubclass(qp, BaseModel)
                        and "symbol" in qp.model_fields)
        except Exception:
            return False

    def _param_choices(fetcher_cls) -> dict:
        """파라미터 선택지. fetcher가 resolve_param_choices()(동적, 예: db의 기관 목록)나
        param_choices(정적, 예: index→[sp500,…])를 선언하면 노출. 없으면 빈 dict."""
        try:
            fn = getattr(fetcher_cls, "resolve_param_choices", None)
            if callable(fn):
                pc = fn()
                return dict(pc) if isinstance(pc, dict) else {}
            pc = getattr(fetcher_cls, "param_choices", None)
            return dict(pc) if isinstance(pc, dict) else {}
        except Exception:
            return {}

    results = []
    for name, p in sorted(ProviderRegistry.get_all().items()):
        if name in _EXCLUDE:
            continue
        models = []
        for model_key in sorted(p.fetcher_dict.keys()):
            fetcher_cls = p.fetcher_dict[model_key]
            models.append({
                "model": model_key,
                "required_params": _required_params(fetcher_cls),
                "accepts_symbol": _accepts_symbol(fetcher_cls),
                "param_choices": _param_choices(fetcher_cls),
            })
        results.append({
            "provider":             name,
            "models":               models,
            "credentials_required": p.requires_credentials(),
        })
    return OBBject(results=results, provider="registry")
