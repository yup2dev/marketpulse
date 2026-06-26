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

    # period → start_date / end_date 자동 변환
    if "period" in params and "start_date" not in params:
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

    return wrap_result(raw, provider)


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
