"""
DB Stock List Fetcher

MBS_IN_STBD_MST(is_active=True) 우선, 실패 시 MBS_IN_STK_STBD distinct fallback.
architecture.md의 DB Provider 패턴(DBIndexConstituentsFetcher)을 따른다.
"""
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.fetcher import Fetcher
from data_fetcher.abstract_provider.standard_models import (
    StockListQueryParams,
    StockListData,
)

log = logging.getLogger(__name__)

_DB_PATH = Path(__file__).parent.parent.parent.parent / "data" / "marketpulse.db"


# ── Fetcher ───────────────────────────────────────────────────────────────────

class DBStockListFetcher(Fetcher[StockListQueryParams, StockListData]):
    """DB 종목 리스트 Fetcher — MBS_IN_STBD_MST 우선, MBS_IN_STK_STBD fallback"""

    require_credentials = False

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> StockListQueryParams:
        return StockListQueryParams(**params)

    @staticmethod
    def extract_data(
        query: StockListQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        """
        DB에서 종목 목록 추출.
        1차: MBS_IN_STBD_MST (is_active 컬럼 보유)
        2차: MBS_IN_STK_STBD distinct stk_cd (time-series)
        """
        from index_analyzer.utils.db import get_sqlite_db
        from index_analyzer.models.orm import MBS_IN_STBD_MST, MBS_IN_STK_STBD

        db_path = kwargs.get("db_path", _DB_PATH)
        db = get_sqlite_db(str(db_path))

        # 1차: 마스터 테이블
        try:
            session = db.get_session()
            try:
                q = session.query(MBS_IN_STBD_MST)
                if query.active_only:
                    q = q.filter(MBS_IN_STBD_MST.is_active == True)  # noqa: E712
                rows = q.all()
                if rows:
                    log.info(
                        "[DBStockListFetcher] mbs_in_stbd_mst: %d rows", len(rows)
                    )
                    return [r.to_dict() for r in rows]
            finally:
                session.close()
        except Exception as exc:
            log.warning("[DBStockListFetcher] mbs_in_stbd_mst failed: %s", exc)

        # 2차: 시세 테이블 distinct
        try:
            session = db.get_session()
            try:
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
            finally:
                session.close()
        except Exception as exc:
            log.warning("[DBStockListFetcher] mbs_in_stk_stbd failed: %s", exc)

        return []

    @staticmethod
    def transform_data(
        query: StockListQueryParams,
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
                        is_active=bool(item.get("is_active", True)),
                    )
                )
            except Exception as exc:
                log.warning("[DBStockListFetcher] transform error: %s", exc)
        log.info("[DBStockListFetcher] transformed: %d stocks", len(results))
        return results
