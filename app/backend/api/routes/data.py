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
    """등록된 모든 provider와 지원 model 목록 반환."""
    from data_fetcher.abstract_provider.abstract.provider import ProviderRegistry
    providers = [
        {
            "provider": name,
            "models": sorted(p.fetcher_dict.keys()),
            "credentials_required": p.requires_credentials(),
        }
        for name, p in sorted(ProviderRegistry.get_all().items())
    ]
    return OBBject(results=providers, provider="registry")
