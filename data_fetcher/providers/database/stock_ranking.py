"""DB Stock Ranking Fetcher

mbs_in_stk_stbd(주식 상태판 — 일별 시세 시계열)에서 기간별 랭킹을 계산한다.
적재 배치가 base_ymd별로 종가를 누적해주면, 최신 종가 vs N일 전 종가로 기간
등락률을 산출한다. 외부 API(yfinance) 호출 없이 DB만으로 응답한다.

period:
  1d  → 최신 스냅샷의 change_rate(전일比) 그대로 사용
  1w~1y → 최신 종가 vs (최신일 - N일)에 가장 가까운 과거 종가 비교

주의: mbs_in_stk_stbd에는 거래량(volume) 컬럼이 없어 volume/trade_value는 0이다.
      (volume 기준 정렬은 realtime 탭의 라이브 경로에서만 의미가 있음)
"""
import logging
from datetime import timedelta
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.standard_models.stock_ranking import (
    StockRankingQueryParams,
    StockRankingData,
)
from data_fetcher.abstract_provider.abstract.base_fetchers import DbFetcher

log = logging.getLogger(__name__)

# 기간 → 일수 (달력 기준 근사; 가장 가까운 과거 거래일을 찾는다)
_PERIOD_DAYS = {
    '1w': 7, '1mo': 30, '3mo': 90, '6mo': 180, '1y': 365,
}


class DBStockRankingQueryParams(StockRankingQueryParams):
    """DB 종목 랭킹 조회 파라미터 (standard StockRanking 경유)"""


class DBStockRankingData(StockRankingData):
    """DB 종목 랭킹 데이터 (standard StockRanking 경유)"""


class DBStockRankingFetcher(DbFetcher[DBStockRankingQueryParams, DBStockRankingData]):
    """mbs_in_stk_stbd 일별 시계열 기반 기간 랭킹."""

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> DBStockRankingQueryParams:
        return DBStockRankingQueryParams(**params)

    @classmethod
    def extract_data(
        cls,
        query: DBStockRankingQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        from datetime import date
        from itertools import groupby
        from sqlalchemy import text

        with cls.db_session(**kwargs) as session:
            # 종목별 전 일별 시계열을 (stk_cd, base_ymd) 순으로 한 번에 로드.
            # 전역 MAX(base_ymd)를 쓰면 거래일이 다른 시장(US 06-05 vs KR 06-08)이
            # 통째로 누락되므로, 종목별 '자기 최신일' 기준으로 계산한다.
            # NOTE: mbs_in_stk_stbd에는 volume 컬럼이 없다(도큐스트링 참조) —
            # 기존 SQL이 volume을 SELECT해 OperationalError로 깨져 있던 것을 0 상수로 정정.
            rows = session.execute(text(
                "SELECT stk_cd, stk_nm, sector, curr, close_price, change_rate, "
                "0 AS volume, base_ymd FROM mbs_in_stk_stbd ORDER BY stk_cd, base_ymd"
            )).fetchall()
            if not rows:
                return []

            period = query.period
            days = _PERIOD_DAYS.get(period)   # 1d면 None

            out: List[Dict[str, Any]] = []
            for stk_cd, grp in groupby(rows, key=lambda r: r[0]):
                recs = list(grp)              # base_ymd 오름차순
                last = recs[-1]
                close = float(last[4]) if last[4] is not None else None
                if close is None:
                    continue
                vol = int(last[6]) if last[6] is not None else 0

                if period == '1d':
                    chg = float(last[5]) if last[5] is not None else None
                else:
                    # 종목 자기 최신일 - N일 이하의 가장 최근 종가를 기준으로 등락률 계산
                    target = (date.fromisoformat(last[7]) - timedelta(days=days)).isoformat()
                    ref = None
                    for r in reversed(recs[:-1]):
                        if r[7] <= target and r[4] is not None:
                            ref = float(r[4])
                            break
                    if ref is None and len(recs) >= 2 and recs[0][4] is not None:
                        ref = float(recs[0][4])
                    chg = ((close - ref) / ref * 100) if ref else None

                out.append({
                    'stk_cd':      stk_cd,
                    'stk_nm':      last[1] or stk_cd,
                    'curr':        last[3] or 'USD',
                    'sector':      last[2] or '',
                    'close_price': close,
                    'change_rate': round(chg, 4) if chg is not None else None,
                    'volume':      vol,
                    'trade_value': vol * close,
                })
            return out

    @staticmethod
    def transform_data(
        query: DBStockRankingQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any,
    ) -> List[DBStockRankingData]:
        results: List[DBStockRankingData] = []
        for item in (data or []):
            try:
                results.append(DBStockRankingData(**item))
            except Exception as exc:
                log.warning("[DBStockRankingFetcher] transform error: %s", exc)
        return results
