"""
Market Ranking Service — 랭킹 소스 고르기 + 실시간 시세 캐시.

랭킹 계산은 fetcher 가 한다: 기간 랭킹은 db stock_ranking(market · sort_by · limit), 국내 실시간은 kis ranking.
여기 남는 것은 fetcher 가 갖지 않는 상태다 — 유니버스 전 종목 실시간 시세의 Redis SWR 캐시(웹소켓과 공유) ·
1분 주기 프리워밍, 그리고 소스 선택 · 폴백 순서(국내 KIS → yahoo → db).
정렬 · 시장 거르기 규칙은 표준 모델 하나(standard_models/stock_ranking.rank · in_market).
"""
import asyncio
import logging
from typing import List, Dict, Any, Optional, Tuple

from app.backend.core.cache import cached
from app.backend.services._base import cached_quotes, to_quote_symbol, unwrap
from data_fetcher.abstract_provider.standard_models.stock_ranking import in_market, rank
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
        from app.backend.commands.stock.universe import get_stock_list
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


# ── 단일 소스 시세 캐시 ────────────────────────────────────────────────────────

async def _live_universe_keys(market: str = 'all'):
    """(meta, symbols, full_key). base/WS가 동일 키를 쓰도록 단일화."""
    universe = [u for u in await _load_universe() if in_market(u, market)]
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


# ── 국내(KRW) 순위 — 한국투자증권(KIS) ──────────────────────────────────────────

@cached(ttl=10)
async def _kis_domestic_ranking(sort_by: str, limit: int) -> Optional[List[Dict[str, Any]]]:
    """국내(KRW) 실시간/1일 순위를 KIS 서버 정렬로 조회 (10s 캐시).

    QueryExecutor 'kis' provider 경유 → 배포 환경에선 RemoteTransport가 Fetcher(exe)로
    위임하고, Fetcher가 보유한 KIS 자격증명(appkey/appsecret)으로 실제 호출한다.
    자격증명 미등록·호출 실패 시 None을 반환해 호출부가 기존 경로(yfinance/DB)로 폴백한다.
    """
    try:
        raw = await QueryExecutor.fetch(
            provider='kis',
            model='ranking',
            params={'sort_by': sort_by, 'market': 'domestic', 'limit': limit},
        )
    except asyncio.CancelledError:
        raise
    except Exception as e:
        log.warning("[Ranking] KIS domestic ranking failed: %s — fallback", e)
        return None

    rows: List[Dict[str, Any]] = []
    for item in unwrap(raw) or []:
        rows.append(item.model_dump() if hasattr(item, 'model_dump') else dict(item))
    return rows or None


# 실시간 랭킹을 낼 수 있는 소스 — 순서 = 자동 선택 우선순위 (위젯의 데이터 소스 선택지)
LIVE_RANKING_PROVIDERS = ('yahoo', 'kis', 'db')


class LiveRankingError(Exception):
    """고른 소스가 랭킹을 내지 못했다 (폴백하지 않는다)."""

    def __init__(self, provider: str, message: str):
        super().__init__(message)
        self.provider = provider


def _live_rows(meta: Dict[str, Dict], live: Dict[str, Dict]) -> List[Dict[str, Any]]:
    """유니버스 메타 + 실시간 시세 → 랭킹 행."""
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
    return rows


# ── RankingService ─────────────────────────────────────────────────────────────

class RankingService:

    @staticmethod
    async def get_live_ranking(
        market:  str = 'all',
        sort_by: str = 'gainers',
        limit:   int = 50,
        provider: Optional[str] = None,
    ) -> Tuple[List[Dict[str, Any]], str]:
        """(행, 실제 응답한 provider). 위젯 출처 표기에 provider 를 그대로 쓴다.

        provider 를 주면 그 소스 하나로만 조회한다 (폴백 없음 — 실패하면 LiveRankingError):
          yahoo  유니버스 전 종목 실시간 시세 (Redis SWR)
          kis    한국투자증권 서버 정렬 — 국내(KRW)만
          db     적재된 일별 시계열(mbs_in_stk_stbd)로 계산한 1일 랭킹
        비우면 자동: 국내는 KIS(실패 시 yahoo), 그 밖은 yahoo.
        """
        if provider:
            return await RankingService._live_from(provider, market, sort_by, limit)

        # 국내(KRW) 실시간 순위는 KIS 서버 정렬을 사용 (실패 시 아래 yfinance로 폴백).
        if market == 'domestic':
            kis = await _kis_domestic_ranking(sort_by, limit)
            if kis is not None:
                return rank(kis, sort_by)[:limit], 'kis'

        meta, _, full_key = await _live_universe_keys(market)
        if not meta:
            return [], 'yahoo'

        rows = _live_rows(meta, await _live_quotes_swr(full_key))
        return rank(rows, sort_by)[:limit], 'yahoo'

    @staticmethod
    async def _live_from(provider: str, market: str, sort_by: str, limit: int) -> Tuple[List[Dict[str, Any]], str]:
        """고른 소스 하나로 실시간 랭킹. 다른 소스로 넘어가지 않는다."""
        if provider == 'kis':
            if market == 'overseas':
                raise LiveRankingError('kis', 'KIS 랭킹은 국내 종목만 제공합니다')
            rows = await _kis_domestic_ranking(sort_by, limit)
            if rows is None:
                raise LiveRankingError('kis', 'KIS 랭킹을 불러오지 못했어요 — Fetcher 와 KIS 키를 확인하세요')
            return rank(rows, sort_by)[:limit], 'kis'
        if provider == 'yahoo':
            meta, _, full_key = await _live_universe_keys(market)
            if not meta:
                raise LiveRankingError('yahoo', '랭킹 유니버스를 불러오지 못했어요')
            return rank(_live_rows(meta, await _live_quotes_swr(full_key)), sort_by)[:limit], 'yahoo'
        if provider == 'db':
            return await _fetch_db_ranking('1d', market, sort_by, limit), 'db'
        raise LiveRankingError(provider, f"'{provider}' 는 실시간 랭킹을 제공하지 않습니다")

    @staticmethod
    async def get_ranking(
        market:  str = 'all',
        sort_by: str = 'gainers',
        period:  str = '1d',
        limit:   int = 50,
    ) -> Tuple[List[Dict[str, Any]], str]:
        """기간별 랭킹 → (행, 실제 응답한 provider: kis | yahoo | db).

        realtime → 라이브(Redis SWR + WebSocket) 경로.
        국내(domestic) realtime·1d → KIS 서버 정렬(실패 시 아래 경로로 폴백).
        1d~1y    → DB(mbs_in_stk_stbd 일별 시계열)에서 계산. 외부 API 호출 없음.
        """
        # 국내 실시간/1일은 한국투자증권(KIS)으로 조회.
        if market == 'domestic' and period in ('realtime', '1d'):
            kis = await _kis_domestic_ranking(sort_by, limit)
            if kis is not None:
                return rank(kis, sort_by)[:limit], 'kis'

        if period == 'realtime':
            return await RankingService.get_live_ranking(market, sort_by, limit)

        return await _fetch_db_ranking(period, market, sort_by, limit), 'db'



async def _fetch_db_ranking(period: str, market: str, sort_by: str, limit: int) -> List[Dict]:
    """기간 랭킹 — db stock_ranking (일별 시계열로 계산 · 거르기 · 정렬). 외부 API 호출 없음.
    캐시는 QueryExecutor 의 모델 TTL. 실패하면 빈 목록 (위젯은 '데이터 없음')."""
    try:
        raw = await QueryExecutor.fetch(
            provider='db', model='stock_ranking',
            params={
                'period': period,
                'market': market if market in ('domestic', 'overseas') else 'all',
                'sort_by': sort_by if sort_by in ('gainers', 'losers', 'volume', 'trade_value') else None,
                'limit': limit,
            },
        )
    except asyncio.CancelledError:
        return []
    except Exception as e:
        log.warning(f"[Ranking] DB ranking failed: {e}")
        return []
    return [item.model_dump() if hasattr(item, 'model_dump') else dict(item) for item in unwrap(raw) or []]


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
