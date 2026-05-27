"""
Market Ranking Service
yfinance 배치 기반 실시간 랭킹.
종목 유니버스는 mbs_in_stk_stbd에서 읽고, 실시간 가격은 yfinance 배치로 조회.
"""
import asyncio
import logging
from typing import List, Dict, Any

import pandas as pd

from app.backend.core.cache import cached
from app.backend.services._base import (
    suppress_yfinance_logs, cached_quotes,
)

log = logging.getLogger(__name__)

CANDIDATE_LIMIT = 500   # 백그라운드 프리워밍 + 긴 캐시로 콜드로드 비용 흡수
LIVE_TTL = 180          # 단일 소스 시세 캐시. 프리워밍이 60초마다 갱신
WARMUP_INTERVAL = 60    # base·WS 공통 캐시 갱신 주기(초)


# ── fallback 유니버스 (DB 조회 실패 시) ────────────────────────────────────────
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


# ── 유니버스 로딩 (stocks:all 캐시 우선) ─────────────────────────────────────

async def _load_universe() -> List[Dict[str, str]]:
    """
    종목 유니버스 로딩 — stocks:all Redis 캐시 우선, 빈 경우 정적 fallback.
    Returns: [{stk_cd, stk_nm, curr, sector}, ...]
    """
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


# ── 단일 소스 시세 캐시 ────────────────────────────────────────────────────────
#
# base 랭킹과 WebSocket이 동일한 캐시를 읽도록 하나의 전체-유니버스 시세 캐시를
# 공유한다. 프리워밍이 주기적으로 이 캐시를 갱신하고, base/WS 모두 여기서 값을
# 읽으므로 둘의 등락률 기준이 항상 일치한다(직전 종가 대비 현재가).

async def _live_universe_keys(market: str = 'all'):
    """(meta, symbols, full_key) 반환. base/WS가 동일 키를 쓰도록 단일화."""
    universe = _filter_by_market(await _load_universe(), market)
    meta     = {u['stk_cd']: u for u in universe}
    symbols  = list(meta.keys())[:CANDIDATE_LIMIT]
    return meta, symbols, ','.join(sorted(symbols))


async def _yf_batch_quotes(symbols_key: str) -> Dict[str, Dict]:
    """청크 동시 다운로드 + single-flight. Returns {sym: {price, change, change_percent, volume}}."""
    symbols = [s for s in symbols_key.split(',') if s]
    return await cached_quotes(f"rank_live:{symbols_key}", symbols, ttl=LIVE_TTL)


async def get_live_quotes_subset(symbols: List[str]) -> Dict[str, Dict]:
    """
    WebSocket용 — 프리워밍된 전체 유니버스 시세 캐시에서 요청 심볼만 추출.
    base 랭킹과 같은 캐시를 읽으므로 등락률 기준이 동일하다.
    유니버스 밖 심볼(지수/환율 등)은 별도 조회.
    """
    wanted = [s for s in symbols if s]
    if not wanted:
        return {}

    _, _, full_key = await _live_universe_keys('all')
    all_quotes = await _yf_batch_quotes(full_key)          # 프리워밍된 캐시 히트

    subset  = {s: all_quotes[s] for s in wanted if s in all_quotes}
    missing = [s for s in wanted if s not in all_quotes]   # ^KS11, KRW=X 등
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
        """yfinance 배치 기반 실시간 랭킹. 유니버스는 DB에서 로딩."""
        meta, _, full_key = await _live_universe_keys(market)
        if not meta:
            return []

        live = await _yf_batch_quotes(full_key)

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
        """기간별 랭킹 — 단기는 live와 동일, 장기는 yfinance period 활용."""
        period_map = {
            'realtime': '5d', '1d': '5d',
            '1w': '1mo', '1mo': '3mo',
            '3mo': '6mo', '6mo': '1y', '1y': '2y',
        }
        yf_period = period_map.get(period, '5d')

        if yf_period == '5d':
            return await RankingService.get_live_ranking(market, sort_by, limit)

        universe = await _load_universe()
        universe = _filter_by_market(universe, market)
        if not universe:
            return []

        meta    = {u['stk_cd']: u for u in universe}
        symbols = list(meta.keys())[:CANDIDATE_LIMIT]
        cache_key = ','.join(sorted(symbols)) + f'|{yf_period}'
        rows = await _fetch_period_ranking(cache_key)

        # 종목명 보강
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


def _filter_by_market(universe: List[Dict], market: str) -> List[Dict]:
    if market == 'domestic':
        return [u for u in universe if u.get('curr') == 'KRW']
    if market == 'overseas':
        return [u for u in universe if u.get('curr') != 'KRW']
    return universe  # 'all'


def _parse_period_chunks(symbols: List[str], yf_period: str) -> List[Dict]:
    """청크 동시 다운로드 후 기간 시작가 대비 변동률 계산 (동기)."""
    import concurrent.futures as cf
    import yfinance as yf

    def _dl(chunk):
        try:
            data = yf.download(
                tickers=chunk, period=yf_period, interval='1d',
                auto_adjust=True, progress=False, threads=False,
            )
        except Exception:
            data = pd.DataFrame()
        return chunk, data

    chunks = [symbols[i:i + 20] for i in range(0, len(symbols), 20)]
    rows: List[Dict] = []

    with suppress_yfinance_logs(), cf.ThreadPoolExecutor(max_workers=15) as ex:
        for chunk, data in ex.map(_dl, chunks):
            if data is None or getattr(data, 'empty', True):
                continue
            is_multi = isinstance(data.columns, pd.MultiIndex)
            for sym in chunk:
                try:
                    close  = data['Close'][sym].dropna() if is_multi else data['Close'].dropna()
                    volume = data['Volume'][sym].dropna() if is_multi else data['Volume'].dropna()
                    if len(close) < 2:
                        continue
                    price_now  = float(close.iloc[-1])
                    price_then = float(close.iloc[0])
                    change_pct = ((price_now - price_then) / price_then * 100) if price_then else 0.0
                    vol        = int(volume.iloc[-1]) if not volume.empty else 0
                    rows.append({
                        'stk_cd':      sym,
                        'stk_nm':      sym,
                        'curr':        'USD',
                        'sector':      '',
                        'close_price': round(price_now, 4),
                        'change_rate': round(change_pct, 4),
                        'volume':      vol,
                        'trade_value': vol * price_now,
                    })
                except Exception:
                    continue

    return rows


@cached(ttl=3600)
async def _fetch_period_ranking(cache_key: str) -> List[Dict]:
    """장기 기간 변동률 계산 (1h 캐시). cache_key: 'SYM1,SYM2,...|1y'"""
    parts   = cache_key.rsplit('|', 1)
    symbols = [s for s in parts[0].split(',') if s]
    yf_period = parts[1] if len(parts) > 1 else '6mo'

    try:
        return await asyncio.to_thread(_parse_period_chunks, symbols, yf_period)
    except asyncio.CancelledError:
        return []
    except Exception as e:
        log.warning(f"[Ranking] period download failed: {e}")
        return []


# ── 백그라운드 프리워밍 ───────────────────────────────────────────────────────

async def warmup_ranking_loop(interval: int = WARMUP_INTERVAL):
    """
    서버 시작 시 백그라운드로 전체 유니버스 시세 캐시를 주기적으로 갱신한다.
    base 랭킹·WebSocket이 이 캐시를 공유하므로 둘의 등락률 기준이 항상 일치하고,
    콜드 다운로드는 백그라운드에서만 발생해 요청은 즉시 응답된다.
    """
    while True:
        try:
            await RankingService.get_live_ranking(market='all', sort_by='gainers', limit=50)
            log.info("[Ranking] warmup refresh complete")
        except Exception as e:
            log.warning(f"[Ranking] warmup failed: {e}")
        await asyncio.sleep(interval)
