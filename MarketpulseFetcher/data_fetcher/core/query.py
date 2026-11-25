"""Query — command 한 번의 조회 (OpenBB openbb_core.app.query).

    @router.command(model="yield_curve")
    async def yield_curve(cc, provider_choices, standard_params, extra_params) -> OBBject:
        return await OBBject.from_query(Query(**locals()))

받는 꼴은 두 가지다.
  - OpenBB 꼴 : provider_choices · standard_params · extra_params (Router 가 요청 파라미터를 나눠 넣는다)
  - 평평한 꼴 : provider=..., 나머지는 파라미터 (예전 CommandRouter 라우트 — /api/v1/equity/fundamental)

execute 는 QueryExecutor 한 곳으로 간다 — 서버에서는 provider 에 따라 사용자 PC Fetcher(websocket)로 위임된다.
"""
from __future__ import annotations

from contextvars import ContextVar
from typing import Any, Dict, List, Mapping, Optional, Union

from data_fetcher.abstract_provider.abstract.fetcher import AnnotatedResult
from data_fetcher.query_executor import QueryExecutor

# Router 가 엔드포인트를 부르기 직전에 넣는 모델 이름 — Query(**locals()) 가 읽는다
_command_model: ContextVar[str] = ContextVar("command_model", default="")

DEFAULT_PROVIDER = "fmp"


def _as_dict(v: Any) -> Dict[str, Any]:
    if v is None:
        return {}
    if isinstance(v, Mapping):
        return dict(v)
    return dict(getattr(v, "__dict__", {}))


class Query:
    """단일 조회 — model · provider · params."""

    def __init__(self, **kwargs: Any) -> None:
        kwargs.pop("cc", None)
        self.model: str = kwargs.pop("_model", None) or _command_model.get()

        choices = kwargs.pop("provider_choices", None)
        standard = _as_dict(kwargs.pop("standard_params", None))
        extra = _as_dict(kwargs.pop("extra_params", None))
        provider = _as_dict(choices).get("provider") if choices is not None else kwargs.pop("provider", None)
        self.provider: str = provider or DEFAULT_PROVIDER
        self.standard_params = standard
        self.extra_params = extra
        # 평평한 꼴이면 남은 kwargs 가 곧 파라미터
        self.params: Dict[str, Any] = {**kwargs, **standard, **self._filter_extra(extra)}

    def _filter_extra(self, extra: Dict[str, Any]) -> Dict[str, Any]:
        """고른 provider 가 받지 않는 추가 파라미터는 빼고 경고 (OpenBB filter_extra_params)."""
        if not extra or not self.model:
            return extra
        from data_fetcher.core.provider_interface import ProviderInterface
        from data_fetcher.core.warnings import add_warning
        try:
            accepted = ProviderInterface.field_names(self.model, self.provider)
            info = ProviderInterface.params(self.model).extra
        except Exception:  # noqa: BLE001 — 모델을 모르면 거르지 않는다
            return extra
        out = {}
        for k, v in extra.items():
            if v is None:
                continue
            if accepted is None or k in accepted or k == "period":
                out[k] = v
            else:
                owners = ", ".join(info.get(k, (None, []))[1])
                add_warning(f"Parameter '{k}' is not supported by {self.provider}. Available for: {owners}.")
        return out

    def normalized_params(self) -> Dict[str, Any]:
        """None 을 빼고, 모델이 period 를 따로 받지 않으면 period(1y · 5y …)를 start_date · end_date 로."""
        params = {k: v for k, v in self.params.items() if v is not None}
        if "period" not in params or "start_date" in params:
            return params
        from data_fetcher.core.provider_interface import ProviderInterface
        try:
            fields = ProviderInterface.field_names(self.model, self.provider)
        except Exception:  # noqa: BLE001
            fields = None
        if fields is not None and "period" in fields:
            return params                       # financials 의 annual · quarterly 처럼 모델 고유 period
        return period_to_dates(params, self.model, self.provider)

    async def execute(self) -> Union[List[Any], AnnotatedResult]:
        return await QueryExecutor.fetch(provider=self.provider, model=self.model, params=self.normalized_params())

    def __repr__(self) -> str:
        return f"Query(model={self.model!r}, provider={self.provider!r}, params={self.params!r})"


def period_to_dates(params: Dict[str, Any], model: str, provider: str) -> Dict[str, Any]:
    """period → start_date · end_date. 날짜를 문자열로 선언한 모델(예: dividends)에는 YYYY-MM-DD 로 넘긴다."""
    from data_fetcher.utils.helpers import parse_period_to_dates

    params = dict(params)
    start, end = parse_period_to_dates(str(params.pop("period")))
    params["start_date"] = start
    params.setdefault("end_date", end)          # 끝 날짜를 직접 준 요청은 그 날짜까지
    try:
        from data_fetcher.utils.registry import FetcherRegistry
        qp = FetcherRegistry.get(model, provider).query_params_type
        fields = qp.model_fields
    except Exception:  # noqa: BLE001
        fields = {}
    for key in ("start_date", "end_date"):
        f = fields.get(key)
        if f is not None and "date" not in str(f.annotation) and hasattr(params[key], "isoformat"):
            params[key] = params[key].isoformat()
    return params
