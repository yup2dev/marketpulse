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

from app.backend.api.deps import (
    filter_dated_rows as _postprocess_dated_rows, missing_key_response, route_handler, wrap_result,
)
from app.backend.services.model_schema import model_schema, resolve_choices
from data_fetcher.core.obbject import OBBject
from data_fetcher.query_executor import (
    MissingCredentialsError, QueryExecutor, QueryExecutorError, RemoteUnavailableError,
)
from data_fetcher.utils.circuit_breaker import CircuitBreakerOpen

log = logging.getLogger(__name__)
# 등록 (api/routers.py 자동 탐색)
PREFIX = "/api/data"
ORDER = 900                # /{provider}/{model} 가 넓게 받는다 — 다른 라우트 뒤에
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
        params.setdefault("end_date", end_date)   # 끝 날짜를 직접 준 요청은 그 날짜까지
        # 날짜를 문자열(YYYY-MM-DD)로 선언한 모델(예: dividends)에는 문자열로 넘긴다
        for key in ("start_date", "end_date"):
            field = qp_fields.get(key)
            if field is not None and "date" not in str(field.annotation) and hasattr(params[key], "isoformat"):
                params[key] = params[key].isoformat()

    try:
        raw = await QueryExecutor.fetch(provider, model, params)
    except MissingCredentialsError as e:
        return missing_key_response(e)
    except RemoteUnavailableError:
        # Fetcher 워커 미접속 등 → route_handler 가 503 으로 바꾼다.
        # 여기서 400 으로 뭉개면 위젯이 'Fetcher 실행' 안내 대신 일반 오류를 띄운다.
        raise
    except QueryExecutorError as e:
        if isinstance(e.__cause__, CircuitBreakerOpen):
            raise   # 서킷 OPEN → route_handler 가 503 + Retry-After
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

    return {"provider": provider, "model": model, **model_schema(fetcher_cls)}


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
