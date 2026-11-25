"""Standard Model: Stock Ranking (기간별 종목 등락 랭킹)

DB 시계열 기반 기간 랭킹(1d/1w/1mo/3mo/6mo/1y)의 공통 인터페이스.
시장 거르기 · 정렬 규칙(in_market · rank)은 여기 하나 — 실시간 랭킹(yahoo · KIS)도 같은 규칙을 쓴다.
"""
from typing import Any, Dict, Iterable, List, Literal, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class StockRankingQueryParams(BaseQueryParams):
    """종목 랭킹 조회 표준 파라미터"""

    period: Literal["1d", "1w", "1mo", "3mo", "6mo", "1y"] = Field(
        default="1d", description="랭킹 산정 기간"
    )
    market: Literal["all", "domestic", "overseas"] = Field(
        default="all", description="domestic = 원화 종목, overseas = 그 외"
    )
    sort_by: Optional[Literal["gainers", "losers", "volume", "trade_value"]] = Field(
        default=None, description="정렬 — gainers · losers 는 오른(내린) 종목만. 비우면 정렬하지 않는다"
    )
    limit: Optional[int] = Field(default=None, ge=1, description="최대 종목 수")


class StockRankingData(BaseData):
    """기간별 종목 랭킹 표준 데이터"""

    stk_cd: str = Field(description="종목 코드")
    stk_nm: Optional[str] = Field(default="", description="종목명")
    curr: Optional[str] = Field(default="USD", description="통화")
    sector: Optional[str] = Field(default="", description="섹터")
    close_price: Optional[float] = Field(default=None, description="종가")
    change_rate: Optional[float] = Field(default=None, description="기간 등락률 (%)")
    volume: int = Field(default=0, description="거래량")
    trade_value: float = Field(default=0.0, description="거래대금")


def in_market(row: Dict[str, Any], market: str) -> bool:
    if market == "domestic":
        return row.get("curr") == "KRW"
    if market == "overseas":
        return row.get("curr") != "KRW"
    return True


def rank(rows: Iterable[Dict[str, Any]], sort_by: Optional[str]) -> List[Dict[str, Any]]:
    """gainers · losers 는 오른 · 내린 종목만 등락률 순, volume · trade_value 는 큰 순."""
    rows = list(rows)
    if sort_by == "gainers":
        return sorted([r for r in rows if (r.get("change_rate") or 0) > 0],
                      key=lambda r: r.get("change_rate") or 0, reverse=True)
    if sort_by == "losers":
        return sorted([r for r in rows if (r.get("change_rate") or 0) < 0],
                      key=lambda r: r.get("change_rate") or 0)
    if sort_by in ("volume", "trade_value"):
        return sorted(rows, key=lambda r: r.get(sort_by) or 0, reverse=True)
    return rows
