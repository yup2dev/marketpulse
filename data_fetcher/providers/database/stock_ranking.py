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
        from sqlalchemy import text

        # 전역 MAX(base_ymd)를 쓰면 거래일이 다른 시장(US 06-05 vs KR 06-08)이
        # 통째로 누락되므로, 종목별 '자기 최신일' 기준으로 계산한다.
        # 계산 전체를 SQL로 내려 종목당 1행만 받는다 — 테이블 전체 fetchall은
        # 수십만 행 규모에서 앱 컨테이너(mem_limit 300m)를 OOM시킨다.
        # (idx_in_stk_cd_date (stk_cd, base_ymd) 인덱스 전제, date()는 SQLite 함수)
        # NOTE: mbs_in_stk_stbd에는 volume 컬럼이 없다(도큐스트링 참조) — volume은 0.
        period = query.period
        days = _PERIOD_DAYS.get(period)   # 1d면 None

        with cls.db_session(**kwargs) as session:
            if days is None:
                rows = session.execute(text(
                    "WITH span AS ("
                    "  SELECT stk_cd, MAX(base_ymd) AS max_ymd"
                    "  FROM mbs_in_stk_stbd GROUP BY stk_cd"
                    ") "
                    "SELECT c.stk_cd, c.stk_nm, c.sector, c.curr, c.close_price, "
                    "       c.change_rate AS chg_1d, NULL AS ref_close, NULL AS first_close "
                    "FROM span s "
                    "JOIN mbs_in_stk_stbd c ON c.stk_cd = s.stk_cd AND c.base_ymd = s.max_ymd "
                    "WHERE c.close_price IS NOT NULL"
                )).fetchall()
            else:
                # ref_close: 최신일-N일 이하의 가장 최근 종가.
                # first_close: 그런 과거 종가가 없을 때 폴백(자기 최초 거래일 종가).
                rows = session.execute(text(
                    "WITH span AS ("
                    "  SELECT stk_cd, MAX(base_ymd) AS max_ymd, MIN(base_ymd) AS min_ymd"
                    "  FROM mbs_in_stk_stbd GROUP BY stk_cd"
                    ") "
                    "SELECT c.stk_cd, c.stk_nm, c.sector, c.curr, c.close_price, "
                    "       NULL AS chg_1d, "
                    "       (SELECT t.close_price FROM mbs_in_stk_stbd t "
                    "         WHERE t.stk_cd = s.stk_cd "
                    "           AND t.base_ymd < s.max_ymd "
                    "           AND t.base_ymd <= date(s.max_ymd, :offset) "
                    "           AND t.close_price IS NOT NULL "
                    "         ORDER BY t.base_ymd DESC LIMIT 1) AS ref_close, "
                    "       (SELECT t.close_price FROM mbs_in_stk_stbd t "
                    "         WHERE t.stk_cd = s.stk_cd AND t.base_ymd = s.min_ymd "
                    "           AND s.min_ymd < s.max_ymd) AS first_close "
                    "FROM span s "
                    "JOIN mbs_in_stk_stbd c ON c.stk_cd = s.stk_cd AND c.base_ymd = s.max_ymd "
                    "WHERE c.close_price IS NOT NULL"
                ), {'offset': f'-{days} day'}).fetchall()

        out: List[Dict[str, Any]] = []
        for stk_cd, stk_nm, sector, curr, close, chg_1d, ref_close, first_close in rows:
            close = float(close)
            if days is None:
                chg = float(chg_1d) if chg_1d is not None else None
            else:
                ref = float(ref_close) if ref_close is not None else (
                    float(first_close) if first_close is not None else None)
                chg = ((close - ref) / ref * 100) if ref else None

            out.append({
                'stk_cd':      stk_cd,
                'stk_nm':      stk_nm or stk_cd,
                'curr':        curr or 'USD',
                'sector':      sector or '',
                'close_price': close,
                'change_rate': round(chg, 4) if chg is not None else None,
                'volume':      0,
                'trade_value': 0.0,
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
