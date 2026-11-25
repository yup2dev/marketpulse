"""종목 비교 — 종목마다 시세(quote) + 주요 지표(key_metrics) 두 모델을 한 행으로 합친다 (순수 함수).

칸 이름은 표준 모델(quote · key_metrics)의 것이라 어느 provider 로 받아도 같은 조합이다.
"""
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


MIN_SYMBOLS, MAX_SYMBOLS = 2, 4


class CompareData(BaseModel):
    symbol: str
    name: Optional[str] = None
    price: Optional[float] = None
    change: Optional[float] = None
    change_percent: Optional[float] = None
    market_cap: Optional[float] = None
    volume: Optional[float] = None
    pe_ratio: Optional[float] = None
    eps: Optional[float] = None
    beta: Optional[float] = None
    dividend_yield: Optional[float] = None
    roe: Optional[float] = None
    roa: Optional[float] = None
    debt_to_equity: Optional[float] = None
    profit_margin: Optional[float] = None
    revenue_growth: Optional[float] = None
    week_52_high: Optional[float] = None
    week_52_low: Optional[float] = None
    error: Optional[str] = Field(default=None, description="이 종목을 못 불렀을 때")


def parse_symbols(symbols: str) -> List[str]:
    codes = [s.strip().upper() for s in str(symbols).split(",") if s.strip()]
    if not MIN_SYMBOLS <= len(codes) <= MAX_SYMBOLS:
        raise ValueError(f"종목은 {MIN_SYMBOLS}~{MAX_SYMBOLS}개")
    return codes


def _first(rows: Any) -> Dict[str, Any]:
    return rows[0] if isinstance(rows, list) and rows else {}


def compare_from(codes: List[str], data: Dict[str, Any]) -> List[CompareData]:
    """종목 × (quote, key_metrics) 행 → 종목마다 한 행. 둘 중 하나라도 못 받은 종목은 error 행.

    data 키는 "{종목}:quote" · "{종목}:metrics".
    """
    out = []
    for sym in codes:
        q, m = data.get(f"{sym}:quote") or [], data.get(f"{sym}:metrics") or []
        if not q or not m:
            out.append(CompareData(symbol=sym, error="Failed to fetch data"))
            continue
        q, m = _first(q), _first(m)
        out.append(CompareData(
            symbol=sym, name=q.get("name") or sym, price=q.get("last_price", q.get("price")), change=q.get("change"),
            change_percent=q.get("change_percent"), market_cap=m.get("market_cap"), volume=q.get("volume"),
            pe_ratio=m.get("pe_ratio"), eps=m.get("eps_trailing"), beta=m.get("beta"),
            dividend_yield=m.get("dividend_yield"), roe=m.get("roe"), roa=m.get("roa"),
            debt_to_equity=m.get("debt_to_equity"), profit_margin=m.get("net_margin"),
            revenue_growth=m.get("revenue_growth"), week_52_high=m.get("week_52_high"),
            week_52_low=m.get("week_52_low"),
        ))
    return out
