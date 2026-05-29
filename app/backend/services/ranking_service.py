"""
Market Ranking Service
YFinanceBatchQuotesFetcher → QueryExecutor 기반 실시간 랭킹.
종목 유니버스는 stock_list_service에서 읽고, 실시간 가격은 배치 Fetcher로 조회.
"""
import asyncio
import logging
from typing import List, Dict, Any

from app.backend.core.cache import cached
from app.backend.services._base import cached_quotes
from data_fetcher.query_executor import QueryExecutor

log = logging.getLogger(__name__)

CANDIDATE_LIMIT = 500
LIVE_TTL        = 180   # 단일 소스 시세 캐시 (초)
WARMUP_INTERVAL = 60    # 프리워밍 갱신 주기 (초)


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
                'stk_cd': s['ticker_cd'],
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


async def _batch_quotes(symbols_key: str, period: str = '5d', mode: str = 'live') -> Dict[str, Dict]:
    """단일-flight 캐시 + YFinanceBatchQuotesFetcher 경유."""
    symbols = [s for s in symbols_key.split(',') if s]
    return await cached_quotes(
        f"rank_live:{symbols_key}", symbols, ttl=LIVE_TTL, period=period, mode=mode,
    )


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

        live = await _batch_quotes(full_key)

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
        """기간별 랭킹 — 단기는 live와 동일, 장기는 period 모드 활용."""
        period_map = {
            'realtime': '5d', '1d': '5d',
            '1w': '1mo', '1mo': '3mo',
            '3mo': '6mo', '6mo': '1y', '1y': '2y',
        }
        yf_period = period_map.get(period, '5d')

        if yf_period == '5d':
            return await RankingService.get_live_ranking(market, sort_by, limit)

        universe = _filter_by_market(await _load_universe(), market)
        if not universe:
            return []

        meta    = {u['stk_cd']: u for u in universe}
        symbols = list(meta.keys())[:CANDIDATE_LIMIT]
        cache_key = ','.join(sorted(symbols)) + f'|{yf_period}'
        rows = await _fetch_period_ranking(cache_key)

        for r in rows:
            m = meta.get(r['stk_cd'])
            if m:
                r['stk_nm'] = m['stk_nm']
                r['sector'] = m['sector']

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


@cached(ttl=3600)
async def _fetch_period_ranking(cache_key: str) -> List[Dict]:
    """장기 기간 변동률 계산 (1h 캐시). cache_key: 'SYM1,SYM2,...|1y'"""
    parts     = cache_key.rsplit('|', 1)
    symbols   = [s for s in parts[0].split(',') if s]
    yf_period = parts[1] if len(parts) > 1 else '6mo'

    try:
        raw = await QueryExecutor.fetch(
            provider='yahoo',
            model='batch_quotes',
            params={'symbols': symbols, 'period': yf_period, 'mode': 'period'},
        )
    except asyncio.CancelledError:
        return []
    except Exception as e:
        log.warning(f"[Ranking] period download failed: {e}")
        return []

    rows: List[Dict] = []
    for item in (raw or []):
        sym   = item.symbol if hasattr(item, 'symbol') else item['symbol']
        price = item.price  if hasattr(item, 'price')  else item['price']
        chg   = item.change_percent if hasattr(item, 'change_percent') else item['change_percent']
        vol   = item.volume if hasattr(item, 'volume') else item['volume']
        rows.append({
            'stk_cd':      sym,
            'stk_nm':      sym,
            'curr':        'USD',
            'sector':      '',
            'close_price': price,
            'change_rate': chg,
            'volume':      vol,
            'trade_value': vol * price,
        })
    return rows


# ── 백그라운드 프리워밍 ───────────────────────────────────────────────────────

async def warmup_ranking_loop(interval: int = WARMUP_INTERVAL):
    """
    서버 시작 시 백그라운드로 전체 유니버스 시세 캐시를 주기적으로 갱신.
    base 랭킹·WebSocket이 이 캐시를 공유하므로 둘의 등락률 기준이 항상 일치.
    """
    while True:
        try:
            await RankingService.get_live_ranking(market='all', sort_by='gainers', limit=50)
            log.info("[Ranking] warmup refresh complete")
        except Exception as e:
            log.warning(f"[Ranking] warmup failed: {e}")
        await asyncio.sleep(interval)
