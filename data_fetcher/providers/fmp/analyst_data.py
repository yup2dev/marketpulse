"""FMP Analyst Data (grades, price targets, consensus) — QueryParams + Data + Fetcher"""
import logging
from typing import Any, Dict, List, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.abstract_provider.standard_models.analyst_ratings import (
    AnalystRatingsQueryParams,
    AnalystRatingItem as FMPAnalystItem,
    AnalystRatingsData,
)
from data_fetcher.utils.api_keys import get_api_key
from data_fetcher.utils.async_http_client import amake_request

log = logging.getLogger(__name__)

FMP_STABLE_BASE = "https://financialmodelingprep.com/stable"


# ── QueryParams / Data (standard AnalystRatings 경유) ──────────────────────────

class FMPAnalystDataQueryParams(AnalystRatingsQueryParams):
    """애널리스트 레이팅 조회 파라미터 (standard AnalystRatings 경유)"""


class FMPAnalystDataData(AnalystRatingsData):
    """애널리스트 종합 데이터 (standard AnalystRatings 경유)"""


# ── Fetcher ───────────────────────────────────────────────────────────────────

class FMPAnalystDataFetcher(ApiFetcher[FMPAnalystDataQueryParams, FMPAnalystDataData]):

    api_name = "FMP"
    api_key_env = "FMP_API_KEY"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> FMPAnalystDataQueryParams:
        return FMPAnalystDataQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: FMPAnalystDataQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        api_key = get_api_key(credentials=credentials, api_name='FMP', env_var='FMP_API_KEY')

        async def _get(endpoint: str, extra_params: dict = {}) -> Any:
            try:
                return await amake_request(
                    f'{FMP_STABLE_BASE}/{endpoint}',
                    params={'symbol': query.symbol, 'apikey': api_key, 'limit': 30, **extra_params},
                    timeout=15,
                )
            except Exception as e:
                log.warning(f"FMP {endpoint} failed: {e}")
                return []

        return {
            'grades':    await _get('grades'),
            'consensus': await _get('price-target-consensus'),
            'targets':   await _get('price-target'),
        }

    @staticmethod
    def transform_data(
        query: FMPAnalystDataQueryParams,
        data: Dict[str, Any],
        **kwargs: Any,
    ) -> List[FMPAnalystDataData]:
        grades_data    = data.get('grades') or []
        consensus_data = data.get('consensus') or []
        pt_data        = data.get('targets') or []

        pt_lookup: Dict[tuple, float] = {}
        if isinstance(pt_data, list):
            for item in pt_data:
                company = item.get('analystCompany') or item.get('analystName') or ''
                date    = (item.get('publishedDate') or '')[:10]
                target  = item.get('priceTarget') or item.get('adjPriceTarget')
                if company and date and target:
                    pt_lookup[(company.lower(), date)] = target

        avg_target = min_target = max_target = None
        if isinstance(consensus_data, list) and consensus_data:
            ct = consensus_data[0]
            avg_target = ct.get('targetConsensus') or ct.get('targetMedian')
            min_target = ct.get('targetLow')
            max_target = ct.get('targetHigh')

        strong_buy = buy = hold = sell = strong_sell = 0
        analysts: List[FMPAnalystItem] = []

        if isinstance(grades_data, list):
            for item in grades_data[:20]:
                grade = (item.get('newGrade') or '').lower()
                if 'strong buy' in grade or grade == 'buy':
                    strong_buy += 1
                elif grade in ('outperform', 'overweight') or 'buy' in grade:
                    buy += 1
                elif grade in ('hold', 'neutral', 'equal-weight') or 'hold' in grade:
                    hold += 1
                elif grade in ('underperform', 'underweight') or 'sell' in grade:
                    sell += 1
                elif 'strong sell' in grade:
                    strong_sell += 1

                company  = item.get('gradingCompany')
                date_str = item.get('date')
                target   = pt_lookup.get((company.lower(), date_str[:10])) if company and date_str else None
                analysts.append(FMPAnalystItem(
                    name=company or '',
                    rating=item.get('newGrade'),
                    prev_rating=item.get('previousGrade'),
                    action=item.get('action'),
                    date=date_str,
                    target_price=target,
                ))

        total = strong_buy + buy + hold + sell + strong_sell
        if total > 0:
            if (strong_buy + buy) / total >= 0.6:
                consensus = 'Buy'
            elif (sell + strong_sell) / total >= 0.6:
                consensus = 'Sell'
            else:
                consensus = 'Hold'
        else:
            consensus = 'N/A'

        return [FMPAnalystDataData(
            symbol=query.symbol,
            consensus_rating=consensus,
            ratings={
                'strong_buy': strong_buy, 'buy': buy, 'hold': hold,
                'sell': sell, 'strong_sell': strong_sell, 'total': total,
            },
            price_target={'average': avg_target, 'low': min_target, 'high': max_target},
            number_of_analysts=total or None,
            analysts=analysts,
        )]
