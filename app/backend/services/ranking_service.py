"""
Market Ranking Service
YFinanceBatchQuotesFetcher → QueryExecutor 기반 실시간 랭킹.
종목 유니버스는 stock_list_service에서 읽고, 실시간 가격은 배치 Fetcher로 조회.
"""
import asyncio
import logging
from typing import List, Dict, Any

from app.backend.core.cache import cached
from app.backend.services._base import cached_quotes, to_quote_symbol, unwrap
from data_fetcher.query_executor import QueryExecutor

log = logging.getLogger(__name__)

CANDIDATE_LIMIT = 500
LIVE_TTL        = 180    # 핫 시세 캐시 (초) — 이 안엔 다운로드 없이 즉시
SNAPSHOT_TTL    = 3600   # 장기 스냅샷 (초) — 핫 캐시가 식어도 즉시 응답하는 폴백
WARMUP_INTERVAL = 60     # 프리워밍 갱신 주기 (초)


# ── fallback 유니버스 ──────────────────────────────────────────────────────────

_FALLBACK_UNIVERSE = [
    'AAPL','MSFT','NVDA','AMZN','META','GOOGL','GOOG','TSLA','AVGO','ORCL',
    'JPM','BAC','WFC','GS','MS','V','MA','AXP','BLK','SCHW',
    'UNH','LLY','JNJ','ABBV','MRK','ABT','TMO','DHR','BMY','AMGN',
    'WMT','COST','HD','MCD','SBUX','NKE','TGT','LOW','TJX','DG',
    'XOM','CVX','COP','EOG','SLB','PSX','VLO','MPC','OXY','KMI',
    'CAT','GE','HON','UNP','DE','RTX','LMT','NOC','GD','BA',
    'AMD','INTC','TXN','QCOM','LRCX','KLAC','MCHP','ADI','ON','MU',
    'CRM','ADBE','NOW','INTU','SNOW','PLTR','DDOG','ZS','CRWD','NET',
    'T','VZ','DIS','NFLX','CMCSA','WBD','FOXA',
    'NEE','SO','DUK','PLD','AMT','EQIX','CCI','SPG',
    'PG','KO','PEP','PM','MO','CL','KMB','MDLZ','GIS',
    'BRK-B','LIN','APD','ECL','MMM','EMR','ITW','ETN','CMI','PH',
    'SQ','PYPL','COIN','HOOD','SOFI','AFRM','UPST','AI','PATH','RBLX',
    'SPY','QQQ','IWM','DIA',
]


# ── 유니버스 로딩 ──────────────────────────────────────────────────────────────

async def _load_universe() -> List[Dict[str, str]]:
    try:
        from app.backend.services.stock_list_service import get_stock_list
        stocks = await get_stock_list()
        result = [
            {
                'stk_cd': to_quote_symbol(s['ticker_cd'], s.get('exchange'), s.get('curr')),
                'stk_nm': s.get('ticker_nm') or s['ticker_cd'],
                'curr':   s.get('curr') or 'USD',
                'sector': s.get('sector') or '',
            }
            for s in stocks
            if s.get('asset_type', 'stock') in ('stock', 'etf')
        ]
        if result:
            log.info("[Ranking] Universe from cache: %d symbols", len(result))
            return result
    except Exception as e:
        log.warning("[Ranking] Cache universe load failed: %s — using fallback", e)

    log.warning("[Ranking] Cache empty — using static fallback universe")
    return [
        {'stk_cd': s, 'stk_nm': s, 'curr': 'USD', 'sector': ''}
        for s in _FALLBACK_UNIVERSE
    ]


def _filter_by_market(universe: List[Dict], market: str) -> List[Dict]:
    if market == 'domestic':
        return [u for u in universe if u.get('curr') == 'KRW']
    if market == 'overseas':
        return [u for u in universe if u.get('curr') != 'KRW']
    return universe


# ── 단일 소스 시세 캐시 ────────────────────────────────────────────────────────

async def _live_universe_keys(market: str = 'all'):
    """(meta, symbols, full_key). base/WS가 동일 키를 쓰도록 단일화."""
    universe = _filter_by_market(await _load_universe(), market)
    meta     = {u['stk_cd']: u for u in universe}
    symbols  = list(meta.keys())[:CANDIDATE_LIMIT]
    return meta, symbols, ','.join(sorted(symbols))


def _hot_key(symbols_key: str) -> str:
    return f"rank_live:{symbols_key}"


def _snap_key(symbols_key: str) -> str:
    return f"rank_snap:{symbols_key}"


async def _batch_quotes(symbols_key: str, period: str = '5d', mode: str = 'live') -> Dict[str, Dict]:
    """실제 다운로드 경로 — single-flight 캐시 + YFinanceBatchQuotesFetcher 경유.
    성공 시 핫 캐시(LIVE_TTL)와 장기 스냅샷(SNAPSHOT_TTL)을 함께 갱신한다."""
    symbols = [s for s in symbols_key.split(',') if s]
    return await cached_quotes(
        _hot_key(symbols_key), symbols, ttl=LIVE_TTL, period=period, mode=mode,
        snapshot_key=_snap_key(symbols_key), snapshot_ttl=SNAPSHOT_TTL,
    )


async def _refresh_quotes_bg(symbols_key: str) -> None:
    """백그라운드 시세 갱신 (fire-and-forget). 실패는 조용히 무시."""
    try:
        await _batch_quotes(symbols_key)
    except Exception as e:
        log.debug("[Ranking] background refresh failed: %s", e)


async def _live_quotes_swr(symbols_key: str) -> Dict[str, Dict]:
    """요청 경로용 — stale-while-revalidate.

    1) 핫 캐시 HIT → 즉시 반환.
    2) 핫 MISS·스냅샷 HIT → 스냅샷 즉시 반환 + 백그라운드 갱신(다운로드 안 기다림).
    3) 둘 다 MISS(최초 1회) → 동기 다운로드 폴백.
    """
    from app.backend.core.cache import cache

    hot = await cache.get(_hot_key(symbols_key))
    if hot is not None:
        return hot

    snap = await cache.get(_snap_key(symbols_key))
    if snap is not None:
        asyncio.create_task(_refresh_quotes_bg(symbols_key))
        return snap

    return await _batch_quotes(symbols_key)


async def get_live_quotes_subset(symbols: List[str]) -> Dict[str, Dict]:
    """
    WebSocket용 — 프리워밍된 전체 유니버스 시세 캐시에서 요청 심볼만 추출.
    유니버스 밖 심볼(지수/환율 등)은 별도 조회.
    """
    wanted = [s for s in symbols if s]
    if not wanted:
        return {}

    _, _, full_key = await _live_universe_keys('all')
    all_quotes = await _batch_quotes(full_key)

    subset  = {s: all_quotes[s] for s in wanted if s in all_quotes}
    missing = [s for s in wanted if s not in all_quotes]
    if missing:
        extra = await cached_quotes(
            f"live_extra:{','.join(sorted(missing))}", missing, ttl=LIVE_TTL,
        )
        subset.update(extra)
    return subset


# ── RankingService ─────────────────────────────────────────────────────────────

class RankingService:

    @staticmethod
    async def get_live_ranking(
        market:  str = 'all',
        sort_by: str = 'gainers',
        limit:   int = 50,
    ) -> List[Dict[str, Any]]:
        meta, _, full_key = await _live_universe_keys(market)
        if not meta:
            return []

        live = await _live_quotes_swr(full_key)

        rows: List[Dict[str, Any]] = []
        for sym, q in live.items():
            m = meta.get(sym, {'stk_nm': sym, 'curr': 'USD', 'sector': ''})
            rows.append({
                'stk_cd':      sym,
                'stk_nm':      m['stk_nm'],
                'curr':        m['curr'],
                'sector':      m['sector'],
                'close_price': q['price'],
                'change_rate': q['change_percent'],
                'volume':      q['volume'],
                'trade_value': q['volume'] * q['price'],
            })

        return RankingService._sort_rows(rows, sort_by)[:limit]

    @staticmethod
    async def get_ranking(
        market:  str = 'all',
        sort_by: str = 'gainers',
        period:  str = '1d',
        limit:   int = 50,
    ) -> List[Dict[str, Any]]:
        """기간별 랭킹.

        realtime → 라이브(Redis SWR + WebSocket) 경로.
        1d~1y    → DB(mbs_in_stk_stbd 일별 시계열)에서 계산. 외부 API 호출 없음.
        """
        if period == 'realtime':
            return await RankingService.get_live_ranking(market, sort_by, limit)

        rows = await _fetch_db_ranking(period)
        rows = _filter_rows_by_market(rows, market)
        return RankingService._sort_rows(rows, sort_by)[:limit]

    @staticmethod
    def _sort_rows(rows: List[Dict], sort_by: str) -> List[Dict]:
        if sort_by == 'gainers':
            return sorted(
                [r for r in rows if (r.get('change_rate') or 0) > 0],
                key=lambda r: r.get('change_rate') or 0, reverse=True,
            )
        if sort_by == 'losers':
            return sorted(
                [r for r in rows if (r.get('change_rate') or 0) < 0],
                key=lambda r: r.get('change_rate') or 0,
            )
        if sort_by == 'volume':
            return sorted(rows, key=lambda r: r.get('volume') or 0, reverse=True)
        if sort_by == 'trade_value':
            return sorted(rows, key=lambda r: r.get('trade_value') or 0, reverse=True)
        return rows


def _filter_rows_by_market(rows: List[Dict], market: str) -> List[Dict]:
    if market == 'domestic':
        return [r for r in rows if r.get('curr') == 'KRW']
    if market == 'overseas':
        return [r for r in rows if r.get('curr') != 'KRW']
    return rows


@cached(ttl=300)
async def _fetch_db_ranking(period: str) -> List[Dict]:
    """기간별 랭킹을 DB(mbs_in_stk_stbd 일별 시계열)에서 계산 (5m 캐시).

    외부 API 호출 없이 DB만으로 응답한다. 적재 배치가 base_ymd별 종가를
    누적해주면 1d~1y 모든 기간이 즉시 계산된다.
    """
    try:
        raw = await QueryExecutor.fetch(
            provider='db',
            model='stock_ranking',
            params={'period': period},
        )
    except asyncio.CancelledError:
        return []
    except Exception as e:
        log.warning(f"[Ranking] DB ranking failed: {e}")
        return []

    rows: List[Dict] = []
    for item in unwrap(raw) or []:
        d = item.model_dump() if hasattr(item, 'model_dump') else dict(item)
        d.setdefault('volume', 0)
        d.setdefault('trade_value', 0.0)
        rows.append(d)
    return rows


# ── 백그라운드 프리워밍 ───────────────────────────────────────────────────────

async def warmup_ranking_loop(interval: int = WARMUP_INTERVAL):
    """
    서버 시작 시 백그라운드로 전체 유니버스 시세 캐시를 주기적으로 갱신.
    base 랭킹·WebSocket이 이 캐시를 공유하므로 둘의 등락률 기준이 항상 일치.
    """
    while True:
        try:
            # 요청 경로(SWR)와 달리, warmup은 실제 다운로드로 핫·스냅샷을 직접 갱신한다.
            _, _, full_key = await _live_universe_keys('all')
            await _batch_quotes(full_key)
            log.info("[Ranking] warmup refresh complete")
        except Exception as e:
            log.warning(f"[Ranking] warmup failed: {e}")
        await asyncio.sleep(interval)
