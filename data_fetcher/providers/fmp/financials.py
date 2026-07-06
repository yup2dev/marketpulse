"""FMP Financials (재무제표 통합 모델 어댑터)

`financials` 표준 모델(손익+재무상태+현금흐름 합본)에 FMP를 provider로 노출하기 위한 어댑터.
FMP는 이 코드베이스에서 손익계산서(income-statement)만 연동돼 있으므로,
손익 필드만 채우고 재무상태/현금흐름 필드는 None으로 둔다.
(합본 + balance sheet가 필요하면 yahoo provider를 사용한다.)
"""
import logging
from datetime import date as date_type
from typing import Any, Dict, List, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.abstract_provider.standard_models import FinancialsQueryParams, FinancialsData
from data_fetcher.utils.api_keys import get_api_key
from data_fetcher.utils.provider_helpers import amake_json_request as amake_request

log = logging.getLogger(__name__)

FMP_STABLE_BASE = "https://financialmodelingprep.com/stable"


class FMPFinancialsQueryParams(FinancialsQueryParams):
    """FMP 재무제표 파라미터 — period 대신 freq 별칭 지원 (yahoo와 동일 UX)"""
    freq: Optional[str] = Field(default=None, description="보고 주기 (quarterly/annual) — period 별칭")


class FMPFinancialsData(FinancialsData):
    """FMP 재무제표 데이터 — 표준 FinancialsData 상속 (손익 필드만 채움)"""
    pass


def _num(d: Dict[str, Any], key: str) -> Optional[float]:
    val = d.get(key)
    if val is None or val == "":
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


class FMPFinancialsFetcher(ApiFetcher[FMPFinancialsQueryParams, FMPFinancialsData]):
    """FMP 손익계산서를 `financials` 표준 모델로 어댑팅하는 Fetcher"""

    api_name = "FMP"
    api_key_env = "FMP_API_KEY"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> FMPFinancialsQueryParams:
        # freq → period 통일 (yahoo financials fetcher와 동일)
        if "freq" in params and "period" not in params:
            params = {**params, "period": params["freq"]}
        return FMPFinancialsQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: FMPFinancialsQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        api_key = get_api_key(credentials=credentials, api_name="FMP", env_var="FMP_API_KEY")
        params = {"symbol": query.symbol, "apikey": api_key, "limit": 10}
        period = query.freq or query.period
        if period:
            # FMP는 annual/quarter 를 받는다 — quarterly 별칭 보정
            params["period"] = "quarter" if period == "quarterly" else period
        data = await amake_request(
            f"{FMP_STABLE_BASE}/income-statement",
            params=params,
            timeout=30,
        )
        if not isinstance(data, list):
            log.warning(f"Unexpected FMP financials response for {query.symbol}")
            return []
        return data

    @staticmethod
    def transform_data(
        query: FMPFinancialsQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any,
    ) -> List[FMPFinancialsData]:
        results: List[FMPFinancialsData] = []
        for d in data:
            raw_date = d.get("date")
            if not raw_date:
                continue
            try:
                dt = date_type.fromisoformat(str(raw_date)[:10])
            except ValueError:
                continue
            results.append(FMPFinancialsData(
                symbol=query.symbol,
                date=dt,
                period=d.get("period") or query.period,
                # ── 손익계산서 (FMP 제공) ──
                revenue=_num(d, "revenue"),
                cost_of_revenue=_num(d, "costOfRevenue"),
                gross_profit=_num(d, "grossProfit"),
                operating_expenses=_num(d, "operatingExpenses"),
                operating_income=_num(d, "operatingIncome"),
                net_income=_num(d, "netIncome"),
                ebitda=_num(d, "ebitda"),
                eps=_num(d, "eps"),
                eps_diluted=_num(d, "epsdiluted"),
                # ── 재무상태표 / 현금흐름표: FMP income-statement 미제공 → None ──
            ))
        log.info(f"Fetched {len(results)} periods of FMP financials for {query.symbol}")
        return results
