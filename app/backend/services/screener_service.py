"""
종목 스크리너 서비스 — DB 유니버스 + yfinance 실시간 가격
- 유니버스: mbs_in_stk_stbd (종목 목록)
- 정적 메타: mbs_in_stk_profile (market_cap, beta, sector, industry)
- 재무지표: mbs_in_financial_metrics (pe, roe, roa 등)
- 실시간 가격/등락률/거래량: yfinance 배치 다운로드
"""
import asyncio
import json
import logging
import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.backend.core.cache import cached
from app.backend.services._base import cached_quotes

log = logging.getLogger(__name__)

SCREENER_CANDIDATE_LIMIT = 500


# ── DB 유니버스 로딩 ──────────────────────────────────────────────────────────

@cached(ttl=3600)
async def _load_screener_universe() -> List[Dict]:
    """
    종목 유니버스 조인 (1h 캐시).
    - 기본 종목 목록: stocks:all Redis 캐시 (DB 직접 쿼리 제거)
    - 프로필/재무지표: mbs_in_stk_profile + mbs_in_financial_metrics (DB)
    Returns: [{stk_cd, stk_nm, curr, sector, industry, exchange,
               market_cap, beta, pe_ratio, pb_ratio, roe, roa, profit_margin}, ...]
    """
    # 1. 기본 종목 목록 — stocks:all 캐시에서 로딩
    from app.backend.services.stock_list_service import get_stock_list
    stock_list = await get_stock_list()
    base: Dict[str, Dict] = {
        s['ticker_cd']: {
            'stk_cd':   s['ticker_cd'],
            'stk_nm':   s.get('ticker_nm') or s['ticker_cd'],
            'curr':     s.get('curr') or 'USD',
            'sector':   s.get('sector') or '',
            'industry': s.get('industry') or '',
            'exchange': s.get('exchange') or '',
        }
        for s in stock_list
        if s.get('ticker_cd') and s.get('asset_type', 'stock') == 'stock'
    }

    if not base:
        log.warning("[Screener] stocks:all cache empty — universe will be empty")
        return []

    log.info("[Screener] Base universe from cache: %d symbols", len(base))

    # 2. 프로필 + 재무지표 — DB에서만 로딩 (기본 목록 쿼리 제거)
    def _query_enrichment():
        from app.backend.core.db import get_db_sync
        from index_analyzer.models.orm import MBS_IN_STK_PROFILE, MBS_IN_FINANCIAL_METRICS

        db = get_db_sync()
        try:
            profiles: Dict[str, Any] = {
                p.stk_cd: p
                for p in db.query(MBS_IN_STK_PROFILE).all()
            }
            metrics: Dict[str, Any] = {}
            for m in (
                db.query(MBS_IN_FINANCIAL_METRICS)
                .order_by(
                    MBS_IN_FINANCIAL_METRICS.stk_cd,
                    MBS_IN_FINANCIAL_METRICS.base_ymd.desc(),
                )
                .all()
            ):
                if m.stk_cd not in metrics:
                    metrics[m.stk_cd] = m
            return profiles, metrics
        finally:
            db.close()

    try:
        profiles, metrics = await asyncio.to_thread(_query_enrichment)
    except Exception as e:
        log.warning("[Screener] profile/metrics DB load failed: %s", e)
        profiles, metrics = {}, {}

    # 3. 조인 — 캐시 base에 profile/metrics 병합
    result = []
    for stk_cd, b in base.items():
        p = profiles.get(stk_cd)
        m = metrics.get(stk_cd)
        result.append({
            'stk_cd':          stk_cd,
            'stk_nm':          (p.stk_nm if p else b['stk_nm']) or stk_cd,
            'curr':            (p.currency if p else b['curr']) or 'USD',
            'sector':          (p.sector if p else b['sector']) or '',
            'industry':        (p.industry if p else b['industry']) or '',
            'exchange':        (p.exchange if p else b['exchange']) or '',
            'market_cap':      float(p.market_cap)      if p and p.market_cap      else None,
            'beta':            float(p.beta)            if p and p.beta            else None,
            'pe_ratio':        float(m.pe_ratio)        if m and m.pe_ratio        else None,
            'pb_ratio':        float(m.pb_ratio)        if m and m.pb_ratio        else None,
            'roe':             float(m.roe)              if m and m.roe             else None,
            'roa':             float(m.roa)              if m and m.roa             else None,
            'profit_margin':   float(m.profit_margin)   if m and m.profit_margin   else None,
            'debt_to_equity':  float(m.debt_to_equity)  if m and m.debt_to_equity  else None,
            'current_ratio':   float(m.current_ratio)   if m and m.current_ratio   else None,
            'quick_ratio':     float(m.quick_ratio)     if m and m.quick_ratio     else None,
        })

    log.info("[Screener] Universe ready: %d symbols", len(result))
    return result


# ── yfinance 배치 가격 조회 (청크 동시 + single-flight + 캐시) ─────────────────

async def _yf_screener_quotes(symbols_key: str) -> Dict[str, Dict]:
    """청크 동시 다운로드. Returns {sym: {close_price, change_rate, volume, trade_value}}."""
    symbols = [s for s in symbols_key.split(',') if s]
    if not symbols:
        return {}
    raw = await cached_quotes(f"scrn:{symbols_key}", symbols, ttl=300)
    return {
        sym: {
            'close_price': q['price'],
            'change_rate': q['change_percent'],
            'volume':      q['volume'],
            'trade_value': q['volume'] * q['price'],
        }
        for sym, q in raw.items()
    }


# ── 필터 적용 ─────────────────────────────────────────────────────────────────

def _apply_filters(rows: List[Dict], filters: Dict[str, Any]) -> List[Dict]:
    result = rows
    f = filters

    def _n(row, key):
        v = row.get(key)
        return float(v) if v is not None else None

    # 시장 / 통화
    if f.get('market') == 'domestic':
        result = [r for r in result if r.get('curr') == 'KRW']
    elif f.get('market') == 'overseas':
        result = [r for r in result if r.get('curr') != 'KRW']

    # 섹터
    if f.get('sector'):
        sectors = f['sector'] if isinstance(f['sector'], list) else [f['sector']]
        sectors_lower = [s.lower() for s in sectors]
        result = [r for r in result if (r.get('sector') or '').lower() in sectors_lower]

    # 업종
    if f.get('industry'):
        result = [r for r in result if (r.get('industry') or '').lower() == f['industry'].lower()]

    # 거래소
    if f.get('exchange'):
        result = [r for r in result if (r.get('exchange') or '').upper() == f['exchange'].upper()]

    # 시가총액
    if f.get('market_cap_min') is not None:
        result = [r for r in result if _n(r, 'market_cap') is not None and _n(r, 'market_cap') >= f['market_cap_min']]
    if f.get('market_cap_max') is not None:
        result = [r for r in result if _n(r, 'market_cap') is not None and _n(r, 'market_cap') <= f['market_cap_max']]

    # 현재가
    if f.get('price_min') is not None:
        result = [r for r in result if _n(r, 'close_price') is not None and _n(r, 'close_price') >= f['price_min']]
    if f.get('price_max') is not None:
        result = [r for r in result if _n(r, 'close_price') is not None and _n(r, 'close_price') <= f['price_max']]

    # 등락률
    for key in ('change_rate_min', 'change_pct_min'):
        if f.get(key) is not None:
            result = [r for r in result if _n(r, 'change_rate') is not None and _n(r, 'change_rate') >= f[key]]
    for key in ('change_rate_max', 'change_pct_max'):
        if f.get(key) is not None:
            result = [r for r in result if _n(r, 'change_rate') is not None and _n(r, 'change_rate') <= f[key]]

    # 거래량
    if f.get('volume_min') is not None:
        result = [r for r in result if _n(r, 'volume') is not None and _n(r, 'volume') >= f['volume_min']]

    # Beta
    if f.get('beta_min') is not None:
        result = [r for r in result if _n(r, 'beta') is not None and _n(r, 'beta') >= f['beta_min']]
    if f.get('beta_max') is not None:
        result = [r for r in result if _n(r, 'beta') is not None and _n(r, 'beta') <= f['beta_max']]

    # PER
    if f.get('pe_ratio_min') is not None:
        result = [r for r in result if _n(r, 'pe_ratio') is not None and _n(r, 'pe_ratio') >= f['pe_ratio_min']]
    if f.get('pe_ratio_max') is not None:
        result = [r for r in result if _n(r, 'pe_ratio') is not None and _n(r, 'pe_ratio') <= f['pe_ratio_max']]

    # PBR
    if f.get('pb_ratio_min') is not None:
        result = [r for r in result if _n(r, 'pb_ratio') is not None and _n(r, 'pb_ratio') >= f['pb_ratio_min']]
    if f.get('pb_ratio_max') is not None:
        result = [r for r in result if _n(r, 'pb_ratio') is not None and _n(r, 'pb_ratio') <= f['pb_ratio_max']]

    # ROE
    if f.get('roe_min') is not None:
        result = [r for r in result if _n(r, 'roe') is not None and _n(r, 'roe') >= f['roe_min']]
    if f.get('roe_max') is not None:
        result = [r for r in result if _n(r, 'roe') is not None and _n(r, 'roe') <= f['roe_max']]

    # ROA
    if f.get('roa_min') is not None:
        result = [r for r in result if _n(r, 'roa') is not None and _n(r, 'roa') >= f['roa_min']]
    if f.get('roa_max') is not None:
        result = [r for r in result if _n(r, 'roa') is not None and _n(r, 'roa') <= f['roa_max']]

    # 순이익률
    if f.get('profit_margin_min') is not None:
        result = [r for r in result if _n(r, 'profit_margin') is not None and _n(r, 'profit_margin') >= f['profit_margin_min']]
    if f.get('profit_margin_max') is not None:
        result = [r for r in result if _n(r, 'profit_margin') is not None and _n(r, 'profit_margin') <= f['profit_margin_max']]

    # 부채비율 D/E
    if f.get('debt_to_equity_min') is not None:
        result = [r for r in result if _n(r, 'debt_to_equity') is not None and _n(r, 'debt_to_equity') >= f['debt_to_equity_min']]
    if f.get('debt_to_equity_max') is not None:
        result = [r for r in result if _n(r, 'debt_to_equity') is not None and _n(r, 'debt_to_equity') <= f['debt_to_equity_max']]

    # 유동비율
    if f.get('current_ratio_min') is not None:
        result = [r for r in result if _n(r, 'current_ratio') is not None and _n(r, 'current_ratio') >= f['current_ratio_min']]
    if f.get('current_ratio_max') is not None:
        result = [r for r in result if _n(r, 'current_ratio') is not None and _n(r, 'current_ratio') <= f['current_ratio_max']]

    # 당좌비율
    if f.get('quick_ratio_min') is not None:
        result = [r for r in result if _n(r, 'quick_ratio') is not None and _n(r, 'quick_ratio') >= f['quick_ratio_min']]
    if f.get('quick_ratio_max') is not None:
        result = [r for r in result if _n(r, 'quick_ratio') is not None and _n(r, 'quick_ratio') <= f['quick_ratio_max']]

    return result


# ── ScreenerService ───────────────────────────────────────────────────────────

class ScreenerService:

    PRESETS = {
        "value_stocks": {
            "name": "가치주",
            "description": "저평가된 우량주 (낮은 P/E, 높은 시총)",
            "filters": {"market_cap_min": 10_000_000_000, "pe_ratio_max": 15},
        },
        "growth_stocks": {
            "name": "성장주",
            "description": "빠르게 성장하는 Tech/Healthcare 기업",
            "filters": {"market_cap_min": 5_000_000_000, "sector": ["Technology", "Healthcare"]},
        },
        "large_cap": {
            "name": "대형주",
            "description": "시총 100B 이상 우량주",
            "filters": {"market_cap_min": 100_000_000_000},
        },
        "small_cap": {
            "name": "소형주",
            "description": "시총 300M~2B 성장 소형주",
            "filters": {"market_cap_min": 300_000_000, "market_cap_max": 2_000_000_000},
        },
        "tech_sector": {
            "name": "기술주",
            "description": "기술 섹터 전체",
            "filters": {"sector": ["Technology"]},
        },
        "high_roe": {
            "name": "고ROE 우량주",
            "description": "자기자본이익률(ROE) 15%+ 우량 기업",
            "filters": {"roe_min": 15, "market_cap_min": 1_000_000_000, "pe_ratio_max": 30},
            "is_hot": True,
        },
        "value_deep": {
            "name": "초저평가주",
            "description": "P/E 12 이하, P/B 2 이하 초저평가 기업",
            "filters": {"pe_ratio_max": 12, "pb_ratio_max": 2, "market_cap_min": 1_000_000_000},
        },
        "profitable": {
            "name": "고수익 기업",
            "description": "순이익률 15%+, 시총 5B 이상",
            "filters": {"profit_margin_min": 15, "market_cap_min": 5_000_000_000},
        },
        "momentum_up": {
            "name": "상승 모멘텀",
            "description": "당일 1% 이상 상승, 거래량 활발",
            "filters": {"change_pct_min": 1, "volume_min": 500_000},
            "is_hot": True,
        },
        "quality_large": {
            "name": "퀄리티 대형주",
            "description": "Tech/Consumer/Communication 섹터, ROE 10%+, 시총 50B+",
            "filters": {
                "sector": ["Technology", "Consumer Cyclical", "Communication Services"],
                "roe_min": 10,
                "market_cap_min": 50_000_000_000,
            },
        },
    }

    @staticmethod
    async def screen_stocks(filters: Dict[str, Any], limit: int = 100) -> List[Dict]:
        """DB 유니버스 + yfinance 가격 기반 스크리닝."""
        universe = await _load_screener_universe()
        if not universe:
            return []

        # DB 필터 조건으로 후보를 미리 줄여 yfinance 호출 수 최소화
        candidates = _apply_filters(universe, filters)
        candidates = candidates[:SCREENER_CANDIDATE_LIMIT]

        if not candidates:
            return []

        # yfinance 배치 가격 조회
        syms_key = ','.join(sorted(c['stk_cd'] for c in candidates))
        prices   = await _yf_screener_quotes(syms_key)

        # 가격 데이터 병합
        rows = []
        for c in candidates:
            q = prices.get(c['stk_cd'])
            if not q:
                continue
            rows.append({**c, **q})

        # 가격 기반 필터 재적용 (price_min/max, change_rate, volume)
        rows = _apply_filters(rows, {
            k: v for k, v in filters.items()
            if k in ('price_min', 'price_max', 'change_rate_min', 'change_rate_max',
                     'change_pct_min', 'change_pct_max', 'volume_min', 'volume_max')
        })

        return rows[:limit]

    # ── 저장된 스크리너 (SavedScreener 테이블 — 사용자 설정만 저장) ────────────

    @staticmethod
    def save_screener(
        db: Session, user_id: str, name: str,
        filters: Dict[str, Any], description: Optional[str] = None,
        run_frequency: str = "manual",
    ):
        from index_analyzer.models.orm import SavedScreener
        screener = SavedScreener(
            screener_id=f"scrn_{uuid.uuid4().hex[:16]}",
            user_id=user_id, name=name, description=description,
            filters=json.dumps(filters), is_active=True,
            run_frequency=run_frequency,
        )
        db.add(screener)
        db.commit()
        db.refresh(screener)
        return screener

    @staticmethod
    def update_screener(
        db: Session, screener_id: str, user_id: str,
        filters: Dict[str, Any], name: Optional[str] = None,
    ):
        from index_analyzer.models.orm import SavedScreener
        screener = db.query(SavedScreener).filter(
            SavedScreener.screener_id == screener_id,
            SavedScreener.user_id == user_id,
        ).first()
        if not screener:
            return None
        screener.filters = json.dumps(filters)
        if name is not None:
            screener.name = name
        db.commit()
        db.refresh(screener)
        return screener

    @staticmethod
    def get_user_screeners(db: Session, user_id: str):
        from index_analyzer.models.orm import SavedScreener
        return db.query(SavedScreener).filter(SavedScreener.user_id == user_id).all()

    @staticmethod
    async def run_saved_screener(
        db: Session, screener_id: str, user_id: str, limit: int = 100,
    ) -> Optional[Dict]:
        from datetime import datetime
        from index_analyzer.models.orm import SavedScreener
        screener = db.query(SavedScreener).filter(
            SavedScreener.screener_id == screener_id,
            SavedScreener.user_id == user_id,
        ).first()
        if not screener:
            return None
        filters = json.loads(screener.filters)
        results = await ScreenerService.screen_stocks(filters, limit)
        screener.last_run = datetime.utcnow()
        db.commit()
        return {"screener": screener.to_dict(), "results": results, "count": len(results)}

    @staticmethod
    def delete_screener(db: Session, screener_id: str, user_id: str) -> bool:
        from index_analyzer.models.orm import SavedScreener
        screener = db.query(SavedScreener).filter(
            SavedScreener.screener_id == screener_id,
            SavedScreener.user_id == user_id,
        ).first()
        if not screener:
            return False
        db.delete(screener)
        db.commit()
        return True

    @staticmethod
    def get_available_sectors(db: Session = None) -> List[str]:
        return [
            "Technology", "Healthcare", "Financials", "Consumer Cyclical",
            "Consumer Defensive", "Industrials", "Energy", "Utilities",
            "Real Estate", "Basic Materials", "Communication Services",
        ]

    @staticmethod
    def get_presets() -> List[dict]:
        return [
            {
                "preset_id":   k,
                "name":        v["name"],
                "description": v["description"],
                "filters":     v["filters"],
                "is_hot":      v.get("is_hot", False),
            }
            for k, v in ScreenerService.PRESETS.items()
        ]

    @staticmethod
    def get_preset_by_id(preset_id: str) -> Optional[dict]:
        p = ScreenerService.PRESETS.get(preset_id)
        if not p:
            return None
        return {"preset_id": preset_id, "name": p["name"], "description": p["description"], "filters": p["filters"]}
