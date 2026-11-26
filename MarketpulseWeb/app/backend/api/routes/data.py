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
    GET /api/data/polygon/news?symbol=TSLA&limit=20
"""
import asyncio
import logging
from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Request

from app.backend.api.deps import filter_dated_rows as _postprocess_dated_rows, route_handler
from app.backend.platform import OBBject, ProviderInterface, Query
from data_fetcher.core.model_schema import resolve_choices
from data_fetcher.query_executor import QueryExecutorError
from app.backend.core.execution import MissingCredentialsError, RemoteUnavailableError
from app.backend.core.execution.circuit_breaker import CircuitBreakerOpen
from app.backend.core.config import settings
from app.backend.core.execution.context import current_user_id
from app.backend.services import widget_sources

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


@router.get("/{provider}/{model}")
@route_handler
async def fetch_data(provider: str, model: str, request: Request) -> OBBject:
    """범용 데이터 조회 — 등록된 (provider, model) 무엇이든. 쿼리 파라미터는 fetcher QueryParams 로 그대로.

    OpenBB 의 model command 를 동적으로 연 것이다 (Query · ProviderInterface 를 같이 쓴다).
    가공(여러 모델 조합 · 계산)이 필요하면 여기가 아니라 Router.command(inputs=...) 로.
    """
    if ProviderInterface.fetcher(model, provider) is None:
        raise HTTPException(status_code=404, detail=f"Model '{model}' not found for provider '{provider}'")
    # 위젯에 등록된 데이터만 — 지금은 log 모드(허용 밖 호출을 기록만). enforce 면 404 api_not_registered
    await asyncio.to_thread(widget_sources.check_data_call, provider, model, current_user_id.get(),
                            settings.WIDGET_API_GATE)
    params: Dict[str, Any] = {k: _coerce(v) for k, v in request.query_params.items()}
    params.pop("provider", None)                       # provider 는 경로가 정한다
    if isinstance(params.get("symbol"), str):
        params["symbol"] = params["symbol"].upper()

    # 위젯 계층이 늘 넣는 symbol/ticker — 모델이 받지 않으면 뺀다 (BaseQueryParams 가 extra 를 허용해서
    # 그대로 두면 잘못된 파라미터로 fetcher 가 깨진다. 예: 기관 계열)
    accepted = ProviderInterface.field_names(model, provider)
    if accepted is not None:
        for k in ("symbol", "ticker"):
            if k in params and k not in accepted:
                params.pop(k)

    query = Query(_model=model, provider=provider, **params)
    try:
        obb = await OBBject.from_query(query)
    except QueryExecutorError as e:
        if isinstance(e, (MissingCredentialsError, RemoteUnavailableError)) or isinstance(e.__cause__, CircuitBreakerOpen):
            raise                               # route_handler 가 424 · 503 으로
        msg = str(e)
        raise HTTPException(status_code=404 if "not found" in msg.lower() else 400, detail=msg)

    # 날짜가 있는 데이터 공통 후처리: 날짜 범위 필터 + 최신순 — QueryParams 가 날짜 범위를 받지 않아도
    # 위젯의 기간 선택이 동작한다
    norm = query.normalized_params()
    obb.results = _postprocess_dated_rows(obb.results, norm.get("start_date"), norm.get("end_date"))
    obb.metadata["row_count"] = len(obb.results)       # 날짜 범위로 거른 뒤의 행 수
    obb.metadata.pop("params", None)
    return obb


@router.get("/{provider}/{model}/schema")
async def get_model_schema(provider: str, model: str) -> Dict[str, Any]:
    """(provider, model) 파라미터 폼 · 응답 필드 — UniversalWidget · 사용자 위젯 설정이 쓴다."""
    schema = ProviderInterface.schema(model, provider)
    if schema is None:
        raise HTTPException(status_code=404, detail=f"Model '{model}' not found for provider '{provider}'")
    return {"provider": provider, "model": model, **schema}


@router.get("/")
async def list_providers() -> OBBject:
    """등록된 모든 provider와 지원 model 목록 반환.

    각 model 항목에 required_params 포함 — 프론트엔드가 필수 파라미터 유무를
    미리 확인하여 symbol 자동 주입 여부를 결정하는 데 사용.

    제외: 복잡한 파라미터 폼이 필요한 provider (quantlib) →
          이미 WIDGET_ENDPOINTS에 전용 params 폼으로 등록되어 있음.
    """
    from pydantic import BaseModel
    from data_fetcher.abstract_provider.abstract.provider import ProviderRegistry
    # 복잡한 계산 provider는 Data 탭이 아닌 Widgets Library 탭에서만 사용
    _EXCLUDE = frozenset({'quantlib'})

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
                "param_choices": resolve_choices(fetcher_cls),
            })
        results.append({
            "provider":             name,
            "models":               models,
            "credentials_required": p.requires_credentials(),
        })
    return OBBject(results=results, provider="registry")
