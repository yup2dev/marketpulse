"""Portfolio API Routes — OBBject pattern

기관 13F 는 로컬 배치가 파싱 · 산출해 적재한 값(db provider)만 읽는다 — 서버는 13F 원본을 파싱하지 않는다
(온디맨드 스크래핑이 이벤트 루프를 막고 작은 운영 인스턴스를 OOM 으로 죽였다). 미적재면 404.
응답 행은 fetcher 의 표준 모델 그대로다.
"""
import logging
from datetime import date
from typing import Any, Dict, List, Optional

from data_fetcher.core import OBBject, Router
from fastapi import HTTPException

from app.backend.api.deps import filter_dated_rows, period_start
from app.backend.commands.portfolio.performance import rebase_cumulative

from data_fetcher.query_executor import QueryExecutor

log = logging.getLogger(__name__)
router = Router()


async def _db_rows(model: str, params: Dict[str, Any]) -> List[Dict[str, Any]]:
    """db provider 조회 → 직렬화된 행."""
    raw = await QueryExecutor.fetch("db", model, {k: v for k, v in params.items() if v is not None})
    return OBBject.from_result(raw, "db").results


@router.command(path="/13f/{institution_key}/performance", methods=["GET"])
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
        rows = await _db_rows("fund_performance", {"institution_key": institution_key, "quarters": quarters})
        if not rows:
            raise ValueError(f"'{institution_key}' 추정 수익률이 적재돼 있지 않습니다"
                             f"(배치 미적재 또는 13F 제출 2개 분기 미만).")
        if start:
            rows = filter_dated_rows(rows, start, None, key="period")
        return OBBject(
            results=rebase_cumulative(rows),     # 누적은 고른 기간의 첫 분기부터
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


@router.command(path="/13f/{institution_key}", methods=["GET"])
async def get_13f_portfolio(
    institution_key: str,
    limit: int = 50,
    summary_only: bool = False,
    period: Optional[str] = None,
    provider: str = "sec",
) -> OBBject:
    """period: 보고 분기말(YYYY-MM-DD) — 비우면 최신. 선택지는 응답의 available_periods."""
    try:
        rows = await _db_rows("institutional_holdings", {
            "institution_key": institution_key, "limit": limit, "summary_only": summary_only, "period": period,
        })
        if not rows:
            if period:
                raise ValueError(f"No 13F filing for {period} loaded for '{institution_key}'")
            raise ValueError(f"'{institution_key}' 13F 데이터가 적재돼 있지 않습니다 (배치 미적재).")
        return OBBject(results=rows[:1], provider=provider)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        log.error(f"Error fetching 13F for {institution_key}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
