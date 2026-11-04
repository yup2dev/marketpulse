"""JSON 스펙 → Provider/Fetcher 클래스 생성기. 스펙 형식은 패키지 docstring 참고."""
import json
import logging
import re
import types
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote

from pydantic import Field, create_model

from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.provider import Provider, ProviderRegistry
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams

log = logging.getLogger(__name__)

SPEC_DIR = Path(__file__).parent / "specs"

_PARAM_TYPES = {"str": str, "int": int, "float": float, "bool": bool, "date": date}
_FIELD_TYPES = {"str": str, "int": int, "float": float, "date": date}
_PLACEHOLDER = re.compile(r"\{([a-zA-Z_][a-zA-Z0-9_]*)(?:\|([a-z]+):([a-zA-Z_][a-zA-Z0-9_]*))?\}")
_RELATIVE = re.compile(r"^-(\d+)([ymd])$")


# ── 값 변환 ───────────────────────────────────────────────────────────────────

def resolve_date(value: Any) -> Optional[date]:
    """'today' / '-10y' / '-6m' / '-30d' / 'YYYY-MM-DD' → date."""
    if value in (None, ""):
        return None
    if isinstance(value, date):
        return value
    s = str(value).strip()
    today = date.today()
    if s == "today":
        return today
    m = _RELATIVE.match(s)
    if m:
        n, unit = int(m.group(1)), m.group(2)
        if unit == "d":
            return today - timedelta(days=n)
        months = n * 12 if unit == "y" else n
        y, mo = divmod(today.month - 1 - months, 12)
        return date(today.year + y, mo + 1, min(today.day, 28))
    return datetime.strptime(s[:10], "%Y-%m-%d").date()


def period_str(d: date, cycle: str) -> str:
    """날짜 → 통계 API 기간 문자열. D:20240115 M:202401 Q:2024Q1 A/Y:2024."""
    c = (cycle or "D").upper()
    if c == "M":
        return d.strftime("%Y%m")
    if c == "Q":
        return f"{d.year}Q{(d.month - 1) // 3 + 1}"
    if c in ("A", "Y"):
        return str(d.year)
    return d.strftime("%Y%m%d")


def parse_period(s: Any) -> Optional[date]:
    """기간 문자열 → 기간 첫날. 20240115 / 2024-01-15 / 202401 / 2024Q1 / 2024S1 / 2024."""
    if s in (None, ""):
        return None
    t = str(s).strip().replace("-", "").replace("/", "").replace(".", "")
    try:
        if len(t) == 8 and t.isdigit():
            return date(int(t[:4]), int(t[4:6]), int(t[6:]))
        if len(t) == 6 and t.isdigit():
            return date(int(t[:4]), int(t[4:]), 1)
        if len(t) == 6 and t[4] in "Qq":
            return date(int(t[:4]), (int(t[5]) - 1) * 3 + 1, 1)
        if len(t) == 6 and t[4] in "Ss":
            return date(int(t[:4]), 1 if t[5] == "1" else 7, 1)
        if len(t) == 4 and t.isdigit():
            return date(int(t), 1, 1)
    except ValueError:
        return None
    return None


def _to_float(v: Any) -> Optional[float]:
    if v in (None, "", "-", ".", "NaN"):
        return None
    try:
        return float(str(v).replace(",", ""))
    except ValueError:
        return None


def _dig(obj: Any, path: Optional[str]) -> Any:
    if not path:
        return obj
    for key in path.split("."):
        if not isinstance(obj, dict):
            return None
        obj = obj.get(key)
    return obj


# ── 클래스 생성 ───────────────────────────────────────────────────────────────

def _camel(*parts: str) -> str:
    return "".join(p[:1].upper() + p[1:] for part in parts for p in re.split(r"[_\-\s]+", part) if p)


def _build_query_params(cls_name: str, params: Dict[str, Dict[str, Any]]):
    fields: Dict[str, Tuple[Any, Any]] = {}
    for name, p in params.items():
        py_type = _PARAM_TYPES.get(p.get("type", "str"), str)
        desc = p.get("description", "")
        if p.get("required"):
            fields[name] = (py_type, Field(description=desc))
        elif py_type is date:
            # 상대일 기본값('-10y')은 호출 시점에 계산 — 여기선 None 으로 두고 transform_query 에서 채운다
            fields[name] = (Optional[date], Field(default=None, description=desc))
        else:
            fields[name] = (Optional[py_type], Field(default=p.get("default"), description=desc))
    return create_model(cls_name, __base__=BaseQueryParams, **fields)


def _build_data(cls_name: str, out_fields: Dict[str, Dict[str, Any]]):
    fields: Dict[str, Tuple[Any, Any]] = {}
    for name, f in out_fields.items():
        if f.get("parse") == "period":
            py_type = date
        else:
            py_type = _FIELD_TYPES.get(f.get("type", "str"), str)
        fields[name] = (Optional[py_type], Field(default=None, description=f.get("description", "")))
    return create_model(cls_name, __base__=BaseData, **fields)


def _build_fetcher(provider: Dict[str, Any], model_key: str, model: Dict[str, Any]):
    pname = provider["name"]
    params_spec: Dict[str, Dict[str, Any]] = model.get("params", {})
    out_spec: Dict[str, Dict[str, Any]] = model["fields"]
    credentials: List[str] = provider.get("credentials", [])
    error_spec: Dict[str, Any] = model.get("error") or {}

    Q = _build_query_params(_camel(pname, model_key, "QueryParams"), params_spec)
    R = _build_data(_camel(pname, model_key, "Data"), out_spec)
    date_defaults = {
        n: p.get("default") for n, p in params_spec.items()
        if p.get("type") == "date" and p.get("default") is not None
    }
    choices = {n: p["choices"] for n, p in params_spec.items() if p.get("choices")}

    def transform_query(params: Dict[str, Any]):
        values = dict(params)
        for name, default in date_defaults.items():
            if values.get(name) in (None, ""):
                values[name] = resolve_date(default)
        return Q(**values)

    def _render_url(query, creds: Dict[str, str]) -> str:
        values = {**query.model_dump(), **creds}

        def sub(m: "re.Match") -> str:
            name, fn, arg = m.group(1), m.group(2), m.group(3)
            v = values.get(name)
            if v is None:
                raise ValueError(f"{pname}/{model_key}: URL 파라미터 '{name}' 값이 없습니다")
            if fn == "period":
                v = period_str(v if isinstance(v, date) else resolve_date(v), str(values.get(arg) or ""))
            elif isinstance(v, date):
                v = v.isoformat()
            return quote(str(v), safe="")

        return _PLACEHOLDER.sub(sub, model["url"])

    async def aextract_data(cls, query, credentials: Optional[Dict[str, str]] = None, **kwargs: Any):
        from data_fetcher.utils.provider_helpers import amake_request

        creds: Dict[str, str] = {}
        if credentials_required:
            creds = {c: (credentials or {}).get(c) for c in credentials_list}
            if "api_key" in credentials_list:
                creds["api_key"] = cls.get_api_key(credentials)
            missing = [c for c, v in creds.items() if not v]
            if missing:
                from data_fetcher.utils.api_keys import CredentialsError
                raise CredentialsError(f"{pname} API key required: {', '.join(missing)}")
        data = await amake_request(_render_url(query, creds), timeout=model.get("timeout", 20))

        err = _dig(data, error_spec.get("path")) if error_spec.get("path") else None
        if isinstance(err, dict) and err:
            code = str(err.get(error_spec.get("code", "code"), ""))
            if code in error_spec.get("empty_codes", []):
                return []
            msg = err.get(error_spec.get("message", "message"), "")
            raise ValueError(f"{pname} API 오류 {code}: {msg}".strip())

        rows = _dig(data, model.get("records"))
        return rows if isinstance(rows, list) else []

    def transform_data(query, data: List[Dict[str, Any]], **kwargs: Any):
        out = []
        for row in data:
            item: Dict[str, Any] = {}
            for name, f in out_spec.items():
                raw = row.get(f.get("from", name))
                if f.get("parse") == "period":
                    item[name] = parse_period(raw)
                elif f.get("type") in ("float", "int"):
                    num = _to_float(raw)
                    item[name] = int(num) if (num is not None and f["type"] == "int") else num
                else:
                    item[name] = raw
            out.append(R(**item))
        return out

    credentials_list = credentials
    credentials_required = bool(credentials)

    def body(ns: Dict[str, Any]) -> None:
        ns["__module__"] = __name__
        ns["__doc__"] = model.get("description", "")
        ns["require_credentials"] = credentials_required
        ns["api_name"] = provider.get("label", pname)
        ns["param_choices"] = choices
        ns["transform_query"] = staticmethod(transform_query)
        ns["aextract_data"] = classmethod(aextract_data)
        ns["transform_data"] = staticmethod(transform_data)

    return types.new_class(_camel(pname, model_key, "Fetcher"), (ApiFetcher[Q, R],), exec_body=body)


def build_provider(spec: Dict[str, Any]) -> Provider:
    """스펙 dict → Provider (fetcher 클래스 포함). 스펙 오류는 ValueError."""
    for key in ("name", "models"):
        if key not in spec:
            raise ValueError(f"declarative provider spec missing '{key}'")
    fetchers = {mk: _build_fetcher(spec, mk, m) for mk, m in spec["models"].items()}
    if spec.get("credentials"):
        # 운영자 키(서버 배치 등 사용자 컨텍스트 없는 호출) 폴백: <NAME>_API_KEY / <NAME>_<FIELD>
        from data_fetcher.utils.api_keys import API_ENV_MAPPING

        prefix = spec["name"].upper()
        API_ENV_MAPPING.setdefault(prefix, {
            c: f"{prefix}_API_KEY" if c == "api_key" else f"{prefix}_{c.upper()}"
            for c in spec["credentials"]
        })
    metadata = {"declarative": True}
    for key in ("group", "rate_limit", "data_coverage"):
        if spec.get(key):
            metadata[key] = spec[key]
    return Provider(
        name=spec["name"],
        description=spec.get("description", ""),
        website=spec.get("website"),
        credentials=spec.get("credentials", []),
        fetcher_dict=fetchers,
        metadata=metadata,
    )


def load_specs(spec_dir: Path = SPEC_DIR) -> List[Dict[str, Any]]:
    specs = []
    for path in sorted(spec_dir.glob("*.json")):
        try:
            specs.append(json.loads(path.read_text(encoding="utf-8")))
        except (OSError, json.JSONDecodeError) as exc:
            log.warning("[declarative] %s 읽기 실패: %s", path.name, exc)
    return specs


def register_declarative_providers(spec_dir: Path = SPEC_DIR) -> List[str]:
    """specs/*.json 을 ProviderRegistry 에 등록. 스펙 하나가 깨져도 나머지는 등록한다."""
    names = []
    for spec in load_specs(spec_dir):
        try:
            ProviderRegistry.register(build_provider(spec))
            names.append(spec["name"])
        except Exception as exc:  # noqa: BLE001 — 잘못된 스펙이 앱 기동을 막지 않게
            log.warning("[declarative] provider '%s' 등록 실패: %s", spec.get("name"), exc)
    return names
