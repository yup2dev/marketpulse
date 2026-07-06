"""SEC Financials (재무제표 통합 모델 어댑터)

`financials` 표준 모델(손익+재무상태+현금흐름 합본)에 SEC를 provider로 노출하는 어댑터.
SEC는 XBRL company-facts에서 income_statement / balance_sheet / cash_flow 를 한 번에
표준화(get_standardized_financials)하므로, 이를 period_ending 기준으로 합쳐
표준 FinancialsData(재무상태표 포함)로 매핑한다. (fmp와 달리 balance sheet 제공)
"""
import logging
from datetime import date as date_type
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.abstract_provider.standard_models import FinancialsQueryParams, FinancialsData

log = logging.getLogger(__name__)

# FinancialsData 필드 → SEC 표준화 태그
_INCOME_MAP = {
    "revenue": "total_revenue",
    "cost_of_revenue": "total_cost_of_revenue",
    "gross_profit": "total_gross_profit",
    "operating_expenses": "total_operating_expenses",
    "operating_income": "total_operating_income",
    "net_income": "net_income",
    "eps": "basic_eps",
    "eps_diluted": "diluted_eps",
}
_BALANCE_MAP = {
    "total_assets": "total_assets",
    "current_assets": "total_current_assets",
    "cash": "cash_and_equivalents",
    "total_liabilities": "total_liabilities",
    "current_liabilities": "total_current_liabilities",
    "stockholders_equity": "total_equity",
    "total_debt": "long_term_debt",
}
_CASHFLOW_MAP = {
    "operating_cash_flow": "net_cash_from_operating_activities",
    "investing_cash_flow": "net_cash_from_investing_activities",
    "financing_cash_flow": "net_cash_from_financing_activities",
    "capital_expenditure": "purchase_of_plant_property_and_equipment",
}


class SecFinancialsQueryParams(FinancialsQueryParams):
    """SEC 재무제표 파라미터 — period 대신 freq 별칭 지원 (yahoo와 동일 UX)"""
    pass


class SecFinancialsData(FinancialsData):
    """SEC 재무제표 데이터 — 표준 FinancialsData 상속"""
    pass


def _pivot(records: List[Dict[str, Any]]) -> Dict[Any, Dict[str, Any]]:
    """[{period_ending, tag, value}] → {period_ending: {tag: value}}"""
    out: Dict[Any, Dict[str, Any]] = {}
    for rec in records:
        pe = rec.get("period_ending")
        if pe is None:
            continue
        bucket = out.setdefault(pe, {})
        bucket[rec["tag"]] = rec.get("value")
        if "_fiscal_period" not in bucket:
            bucket["_fiscal_period"] = rec.get("fiscal_period")
    return out


def _to_date(pe: Any) -> Optional[date_type]:
    if isinstance(pe, date_type):
        return pe
    try:
        return date_type.fromisoformat(str(pe)[:10])
    except ValueError:
        return None


def _num(d: Dict[str, Any], key: str) -> Optional[float]:
    val = d.get(key)
    if val is None or val == "":
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


class SecFinancialsFetcher(ApiFetcher[SecFinancialsQueryParams, SecFinancialsData]):
    """SEC XBRL 3개 제표를 `financials` 표준 모델로 어댑팅하는 Fetcher"""

    require_credentials = False  # SEC EDGAR is keyless

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> SecFinancialsQueryParams:
        # freq → period 통일, quarterly 별칭 보정
        if "freq" in params and "period" not in params:
            params = {**params, "period": params.pop("freq")}
        return SecFinancialsQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: SecFinancialsQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        from data_fetcher.providers.sec.utils.company_facts import get_standardized_financials

        period = query.period or "annual"
        result = await get_standardized_financials(
            symbol=query.symbol,
            period=period,
            use_cache=True,
            include_preliminary=False,
            pit_mode=False,
        )
        return {"result": result}

    @staticmethod
    def transform_data(
        query: SecFinancialsQueryParams,
        data: Dict[str, Any],
        **kwargs: Any,
    ) -> List[SecFinancialsData]:
        result = data["result"]
        inc = _pivot(getattr(result, "income_statement", []) or [])
        bal = _pivot(getattr(result, "balance_sheet", []) or [])
        cf = _pivot(getattr(result, "cash_flow", []) or [])

        periods = sorted(set(inc) | set(bal) | set(cf), reverse=True)
        results: List[SecFinancialsData] = []
        for pe in periods:
            dt = _to_date(pe)
            if dt is None:
                continue
            i, b, c = inc.get(pe, {}), bal.get(pe, {}), cf.get(pe, {})
            fields: Dict[str, Any] = {
                "symbol": query.symbol,
                "date": dt,
                "period": i.get("_fiscal_period") or b.get("_fiscal_period") or query.period,
            }
            for std_field, tag in _INCOME_MAP.items():
                fields[std_field] = _num(i, tag)
            for std_field, tag in _BALANCE_MAP.items():
                fields[std_field] = _num(b, tag)
            for std_field, tag in _CASHFLOW_MAP.items():
                fields[std_field] = _num(c, tag)
            results.append(SecFinancialsData(**fields))

        limit = getattr(query, "limit", None)
        if limit is not None:
            results = results[:limit]

        log.info(f"Fetched {len(results)} periods of SEC financials for {query.symbol}")
        return results
