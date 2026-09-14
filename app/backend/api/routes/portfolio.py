"""Portfolio API Routes — OBBject pattern"""
import logging
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException

from data_fetcher.core.obbject import OBBject
from app.backend.services.portfolio_service import portfolio_service

log = logging.getLogger(__name__)
router = APIRouter()


def _wrap(data: Any, provider: str = "sec") -> OBBject:
    if isinstance(data, list):
        return OBBject(results=data, provider=provider)
    return OBBject(results=[data] if data is not None else [], provider=provider)


@router.get("/13f/institutions")
async def get_13f_institutions(
    use_dynamic: bool = True,
    limit: int = 1000,
    loaded_only: bool = True,
    with_performance: bool = False,
    provider: str = "sec",
) -> OBBject:
    try:
        institutions = await portfolio_service.get_institutions_list(
            use_dynamic=use_dynamic, limit=limit, loaded_only=loaded_only,
            with_performance=with_performance,
        )
        return OBBject(
            results=institutions,
            provider=provider,
            metadata={
                "source": "dynamic" if use_dynamic else "featured",
                "loaded_only": loaded_only,
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/13f/{institution_key}/performance")
async def get_fund_performance(
    institution_key: str,
    quarters: int = 8,
    provider: str = "sec",
) -> OBBject:
    """13F 보유종목 기반 분기별 추정 수익률.

    ⚠️ 펀드의 실제 NAV 수익률이 아니다 — 헤지펀드 실수익률은 공시 대상이 아니라
    어떤 소스로도 못 가져온다. 여기 값은 분기말 13F 스냅샷 2개를 비교한 근사치이며
    미국 상장주식 롱 포지션만 반영한다. 응답의 coverage_pct / derivative_weight_pct
    를 함께 봐야 신뢰도를 판단할 수 있다.

    로컬 배치가 산출·적재한 값(db)만 읽는다 — provider 는 출처 표기용(원본은 SEC 13F).
    """
    try:
        rows = await portfolio_service.get_fund_performance(
            institution_key=institution_key, quarters=quarters
        )
        return OBBject(
            results=rows,
            provider=provider,
            metadata={
                "basis": "13f_holdings_derived",
                "disclaimer": (
                    "13F 공시 기반 추정치이며 펀드의 실제 NAV 수익률이 아닙니다. "
                    "미국 상장주식 롱 포지션만 반영되고 공매도·파생·현금·레버리지는 제외됩니다."
                ),
            },
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        log.error(f"Error fetching fund performance for {institution_key}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/13f/{institution_key}")
async def get_13f_portfolio(
    institution_key: str,
    limit: int = 50,
    summary_only: bool = False,
    provider: str = "sec",
) -> OBBject:
    try:
        data = await portfolio_service.get_institution_portfolio(
            institution_key=institution_key, limit=limit, summary_only=summary_only
        )
        return OBBject(results=[data], provider=provider)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        log.error(f"Error fetching 13F for {institution_key}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
