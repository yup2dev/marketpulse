"""Portfolio API Routes — OBBject pattern"""
import logging
from datetime import date
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException

from app.backend.api.deps import filter_dated_rows, period_start

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
    quarters: Optional[int] = None,
    period: Optional[str] = None,
    provider: str = "sec",
) -> OBBject:
    """13F 보유종목 기반 분기별 추정 수익률.

    ⚠️ 펀드의 실제 NAV 수익률이 아니다 — 헤지펀드 실수익률은 공시 대상이 아니라
    어떤 소스로도 못 가져온다. 여기 값은 분기말 13F 스냅샷 2개를 비교한 근사치이며
    미국 상장주식 롱 포지션만 반영한다. 응답의 coverage_pct / derivative_weight_pct
    를 함께 봐야 신뢰도를 판단할 수 있다.

    로컬 배치가 산출·적재한 값(db)만 읽는다 — provider 는 출처 표기용(원본은 SEC 13F).
    """
    # period(1y·3y·max…)를 주면 그 기간을 덮는 분기 수로 바꿔 읽고 분기말 날짜로 자른다.
    # 각 행은 두 분기를 비교하므로 기간 시작 분기까지 포함하도록 +1.
    start = period_start(period) if period else None
    if quarters is None:
        if period and start is None:          # max
            quarters = 200
        elif start:
            days = (date.today() - date.fromisoformat(start)).days
            quarters = max(2, round(days / 91.25) + 1)
        else:
            quarters = 8
    try:
        rows = await portfolio_service.get_fund_performance(
            institution_key=institution_key, quarters=quarters
        )
        if start:
            rows = filter_dated_rows(rows, start, None, key="period")
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
    period: Optional[str] = None,
    provider: str = "sec",
) -> OBBject:
    """period: 보고 분기말(YYYY-MM-DD) — 비우면 최신. 선택지는 응답의 available_periods."""
    try:
        data = await portfolio_service.get_institution_portfolio(
            institution_key=institution_key, limit=limit, summary_only=summary_only, period=period,
        )
        return OBBject(results=[data], provider=provider)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        log.error(f"Error fetching 13F for {institution_key}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
