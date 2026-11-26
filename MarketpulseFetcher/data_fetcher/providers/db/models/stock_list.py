"""
DB Stock List Fetcher

MBS_IN_STBD_MST(is_active=True) 우선, 실패 시 MBS_IN_STK_STBD distinct fallback.
architecture.md의 DB Provider 패턴(DBIndexConstituentsFetcher)을 따른다.
"""
import logging
from typing import Any, Dict, List, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.base_fetchers import DbFetcher
from data_fetcher.abstract_provider.standard_models import (
    StockListQueryParams,
    StockListData,
)

log = logging.getLogger(__name__)


class DBStockListQueryParams(StockListQueryParams):
    """마스터 테이블 필터 — 관심종목 · 산업 화면이 종목 몇 개 또는 한 섹터만 고를 때."""

    symbols: Optional[str] = Field(default=None, description="종목 코드 (쉼표로 여러 개)")
    country: Optional[str] = Field(default=None, description="국가 (예: US, KR)")
    sector: Optional[str] = Field(default=None, description="섹터")
    industry: Optional[str] = Field(default=None, description="산업")


def _codes(text: Optional[str]) -> List[str]:
    return [c.strip().upper() for c in (text or "").split(",") if c.strip()]


# ── Fetcher ───────────────────────────────────────────────────────────────────

class DBStockListFetcher(DbFetcher[DBStockListQueryParams, StockListData]):
    """DB 종목 리스트 Fetcher — MBS_IN_STBD_MST 우선, MBS_IN_STK_STBD fallback"""

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> DBStockListQueryParams:
        return DBStockListQueryParams(**params)

    @classmethod
    def extract_data(
        cls,
        query: DBStockListQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        """
        DB에서 종목 목록 추출.
        1차: MBS_IN_STBD_MST (is_active 컬럼 보유)
        2차: MBS_IN_STK_STBD distinct stk_cd (time-series)
        """
        from data_fetcher.providers.db.schema import MBS_IN_STBD_MST, MBS_IN_STK_STBD

        # 1차: 마스터 테이블
        try:
            with cls.db_session(**kwargs) as session:
                q = session.query(MBS_IN_STBD_MST)
                if query.active_only:
                    q = q.filter(MBS_IN_STBD_MST.is_active == True)  # noqa: E712
                codes = _codes(query.symbols)
                if codes:
                    q = q.filter(MBS_IN_STBD_MST.ticker_cd.in_(codes))
                for col in ("country", "sector", "industry"):
                    if getattr(query, col):
                        q = q.filter(getattr(MBS_IN_STBD_MST, col) == getattr(query, col))
                rows = q.all()
                if rows or codes or query.country or query.sector or query.industry:
                    log.info(
                        "[DBStockListFetcher] mbs_in_stbd_mst: %d rows", len(rows)
                    )
                    return [r.to_dict() for r in rows]
        except Exception as exc:
            log.warning("[DBStockListFetcher] mbs_in_stbd_mst failed: %s", exc)

        # 2차: 시세 테이블 distinct
        try:
            with cls.db_session(**kwargs) as session:
                rows = (
                    session.query(
                        MBS_IN_STK_STBD.stk_cd,
                        MBS_IN_STK_STBD.stk_nm,
                        MBS_IN_STK_STBD.curr,
                        MBS_IN_STK_STBD.sector,
                    )
                    .distinct(MBS_IN_STK_STBD.stk_cd)
                    .all()
                )
                data = [
                    {
                        "ticker_cd": r.stk_cd,
                        "ticker_nm": r.stk_nm or r.stk_cd,
                        "asset_type": "stock",
                        "curr": r.curr or "USD",
                        "sector": r.sector or "",
                        "industry": "",
                        "exchange": "",
                        "is_active": True,
                    }
                    for r in rows
                    if r.stk_cd
                ]
                if data:
                    log.info(
                        "[DBStockListFetcher] mbs_in_stk_stbd fallback: %d rows", len(data)
                    )
                return data
        except Exception as exc:
            log.warning("[DBStockListFetcher] mbs_in_stk_stbd failed: %s", exc)

        return []

    @staticmethod
    def transform_data(
        query: DBStockListQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any,
    ) -> List[StockListData]:
        results = []
        for item in data:
            try:
                ticker_cd = item.get("ticker_cd") or item.get("stk_cd") or ""
                if not ticker_cd:
                    continue
                results.append(
                    StockListData(
                        ticker_cd=ticker_cd,
                        ticker_nm=item.get("ticker_nm") or item.get("stk_nm") or ticker_cd,
                        asset_type=item.get("asset_type") or "stock",
                        curr=item.get("curr") or "USD",
                        sector=item.get("sector") or "",
                        industry=item.get("industry") or "",
                        exchange=item.get("exchange") or "",
                        country=item.get("country"),
                        is_active=item.get("is_active") is not False,   # 비어 있으면 활성
                    )
                )
            except Exception as exc:
                log.warning("[DBStockListFetcher] transform error: %s", exc)
        log.info("[DBStockListFetcher] transformed: %d stocks", len(results))
        return results
