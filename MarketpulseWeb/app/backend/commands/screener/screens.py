"""
종목 스크리너 서비스 — db provider equity_screener + yfinance 실시간 가격
- 유니버스 · 프로필 · 재무지표 · 재무 조건: db provider equity_screener (fetcher)
- 실시간 가격/등락률/거래량: yfinance 배치 다운로드 → 가격 조건은 여기서 건다
"""
import json
import logging
import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.backend.commands._base import to_quote_symbol
from app.backend.commands.stock.quotes import cached_quotes
from data_fetcher.core.obbject import OBBject
from app.backend.core.execution import ServerExecutor

log = logging.getLogger(__name__)

SCREENER_CANDIDATE_LIMIT = 500

# 가격 조건 — 시세를 붙인 뒤에 건다 (나머지는 equity_screener 의 파라미터)
PRICE_KEYS = ('price_min', 'price_max', 'change_rate_min', 'change_rate_max',
              'change_pct_min', 'change_pct_max', 'volume_min', 'volume_max')


def _screener_params(filters: Dict[str, Any]) -> Dict[str, Any]:
    """화면 필터 → equity_screener 파라미터. 섹터 목록은 쉼표 글로."""
    params = {k: v for k, v in filters.items() if k not in PRICE_KEYS and v not in (None, '', [])}
    if isinstance(params.get('sector'), list):
        params['sector'] = ','.join(params['sector'])
    params['limit'] = SCREENER_CANDIDATE_LIMIT
    return params


async def _candidates(filters: Dict[str, Any]) -> List[Dict]:
    """db provider equity_screener — 재무 조건을 통과한 종목 (시세 조회용 심볼로 정규화, 기존 응답 칸 이름)."""
    raw = await ServerExecutor.fetch("db", "equity_screener", _screener_params(filters))
    return [
        {
            'stk_cd': to_quote_symbol(r.symbol, r.exchange or '', r.currency or ''),
            'stk_nm': r.name or r.symbol, 'curr': r.currency or 'USD',
            'sector': r.sector or '', 'industry': r.industry or '', 'exchange': r.exchange or '',
            'market_cap': r.market_cap, 'beta': r.beta, 'pe_ratio': r.pe_ratio, 'pb_ratio': r.pb_ratio,
            'roe': r.roe, 'roa': r.roa, 'profit_margin': r.profit_margin,
            'debt_to_equity': r.debt_to_equity, 'current_ratio': r.current_ratio, 'quick_ratio': r.quick_ratio,
        }
        for r in OBBject.unwrap(raw) or []
    ]


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


# ── 가격 조건 (시세를 붙인 뒤) ────────────────────────────────────────────────

def _apply_price_filters(rows: List[Dict], f: Dict[str, Any]) -> List[Dict]:
    def within(row, key, lo, hi):
        v = row.get(key)
        if lo is None and hi is None:
            return True
        if v is None:
            return False
        return (lo is None or float(v) >= lo) and (hi is None or float(v) <= hi)

    lo_chg = next((f[k] for k in ('change_rate_min', 'change_pct_min') if f.get(k) is not None), None)
    hi_chg = next((f[k] for k in ('change_rate_max', 'change_pct_max') if f.get(k) is not None), None)
    return [
        r for r in rows
        if within(r, 'close_price', f.get('price_min'), f.get('price_max'))
        and within(r, 'change_rate', lo_chg, hi_chg)
        and within(r, 'volume', f.get('volume_min'), f.get('volume_max'))
    ]


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
        """db provider equity_screener + yfinance 가격 기반 스크리닝."""
        candidates = await _candidates(filters)
        if not candidates:
            return []

        # yfinance 배치 가격 조회
        syms_key = ','.join(sorted(c['stk_cd'] for c in candidates))
        prices   = await _yf_screener_quotes(syms_key)

        # 가격 데이터 병합 — 시세 미확보 종목도 유지(가격 필드 None).
        # 로컬 Fetcher 미실행으로 yahoo 시세가 전부 비어도 DB 조건 결과는 반환한다.
        # (가격 기반 필터를 걸면 None 행은 걸러진다)
        rows = [{'close_price': None, 'change_rate': None, 'volume': None,
                 **c, **(prices.get(c['stk_cd']) or {})} for c in candidates]
        rows = _apply_price_filters(rows, filters)

        return rows[:limit]

    # ── 저장된 스크리너 (SavedScreener 테이블 — 사용자 설정만 저장) ────────────

    @staticmethod
    def save_screener(
        db: Session, user_id: str, name: str,
        filters: Dict[str, Any], description: Optional[str] = None,
        run_frequency: str = "manual",
    ):
        from app.backend.models.orm import SavedScreener
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
        from app.backend.models.orm import SavedScreener
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
        from app.backend.models.orm import SavedScreener
        return db.query(SavedScreener).filter(SavedScreener.user_id == user_id).all()

    @staticmethod
    async def run_saved_screener(
        db: Session, screener_id: str, user_id: str, limit: int = 100,
    ) -> Optional[Dict]:
        from datetime import datetime
        from app.backend.models.orm import SavedScreener
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
        from app.backend.models.orm import SavedScreener
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
