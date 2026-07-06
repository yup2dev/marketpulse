"""한국투자증권(KIS) Open API — 국내주식 실시간 순위.

전 상장종목을 KIS 서버가 정렬해 상위 N개를 현재가·등락률·거래량·거래대금과 함께
돌려준다. 우리가 9,800종목 시세를 직접 받아 정렬할 필요가 없다(500캡/WS41 문제 회피).

위젯 정렬 → KIS 엔드포인트 매핑:
  gainers / losers     → 등락률 순위  ranking/fluctuation   (FHPST01700000)
  volume / trade_value → 거래량 순위  quotations/volume-rank (FHPST01710000)

반환 행 형식은 DBStockRankingFetcher와 동일:
  {stk_cd, stk_nm, curr, sector, close_price, change_rate, volume, trade_value}

⚠️ 국내(KRW) 전용. 해외 realtime 순위는 DB 스냅샷/Polygon 경로를 쓴다.
⚠️ TODO(라이브 검증): FID 파라미터·output 필드명은 KIS 최신 문서/실응답으로 확인.
"""
from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional

from pydantic import BaseModel

from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.providers.kis.rest import kis_get

log = logging.getLogger(__name__)

_PATH_FLUCT = "/uapi/domestic-stock/v1/ranking/fluctuation"
_TR_FLUCT = "FHPST01700000"

_PATH_VOLUME = "/uapi/domestic-stock/v1/quotations/volume-rank"
_TR_VOLUME = "FHPST01710000"

# market → FID_INPUT_ISCD (0000 전체 / 0001 코스피 / 1001 코스닥)
_MARKET_ISCD = {"all": "0000", "domestic": "0000", "kospi": "0001", "kosdaq": "1001"}

# 전일대비부호 4,5 = 하락
_NEG_SIGNS = {"4", "5"}


def _f(v: Any, default: float = 0.0) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def _i(v: Any, default: int = 0) -> int:
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return default


def _creds(credentials: Optional[Dict[str, str]]) -> tuple[str, str]:
    appkey = (credentials or {}).get("appkey") or os.getenv("KIS_APPKEY", "")
    appsecret = (credentials or {}).get("appsecret") or os.getenv("KIS_APPSECRET", "")
    if not appkey or not appsecret:
        raise RuntimeError("KIS appkey/appsecret required (credentials or KIS_APPKEY/SECRET).")
    return appkey, appsecret


async def fetch_kis_ranking(
    sort_by: str = "gainers",
    market: str = "all",
    limit: int = 50,
    env: str = "real",
    credentials: Optional[Dict[str, str]] = None,
) -> List[Dict[str, Any]]:
    """KIS 순위 REST 호출 → 표준 랭킹 행 리스트(상위 limit)."""
    appkey, appsecret = _creds(credentials)
    iscd = _MARKET_ISCD.get(market, "0000")

    if sort_by in ("gainers", "losers"):
        rows = await _fetch_fluctuation(sort_by, iscd, appkey, appsecret, env)
    else:  # volume | trade_value
        rows = await _fetch_volume(sort_by, iscd, appkey, appsecret, env)
    return rows[:limit]


async def _fetch_fluctuation(sort_by, iscd, appkey, appsecret, env) -> List[Dict[str, Any]]:
    params = {
        "fid_cond_mrkt_div_code": "J",
        "fid_cond_scr_div_code": "20170",
        "fid_input_iscd": iscd,
        "fid_rank_sort_cls_code": "0" if sort_by == "gainers" else "1",  # 0 상승률 1 하락률
        "fid_input_cnt_1": "0",
        "fid_prc_cls_code": "0",
        "fid_input_price_1": "",
        "fid_input_price_2": "",
        "fid_vol_cnt": "",
        "fid_trgt_cls_code": "0",
        "fid_trgt_exls_cls_code": "0",
        "fid_div_cls_code": "0",
        "fid_rsfl_rate1": "",
        "fid_rsfl_rate2": "",
    }
    data = await kis_get(_PATH_FLUCT, _TR_FLUCT, params, appkey, appsecret, env)
    return [_normalize(item) for item in (data.get("output") or [])]


async def _fetch_volume(sort_by, iscd, appkey, appsecret, env) -> List[Dict[str, Any]]:
    params = {
        "fid_cond_mrkt_div_code": "J",
        "fid_cond_scr_div_code": "20171",
        "fid_input_iscd": iscd,
        "fid_div_cls_code": "0",
        # 0 평균거래량(거래량순) / 3 거래금액순(거래대금)
        "fid_blng_cls_code": "3" if sort_by == "trade_value" else "0",
        "fid_trgt_cls_code": "0000000000",
        "fid_trgt_exls_cls_code": "0000000000",
        "fid_input_price_1": "",
        "fid_input_price_2": "",
        "fid_vol_cnt": "",
    }
    data = await kis_get(_PATH_VOLUME, _TR_VOLUME, params, appkey, appsecret, env)
    return [_normalize(item) for item in (data.get("output") or [])]


def _normalize(o: Dict[str, Any]) -> Dict[str, Any]:
    """KIS output 항목 → 표준 랭킹 행. 엔드포인트별 필드명 차이를 흡수."""
    code = o.get("mksc_shrn_iscd") or o.get("stck_shrn_iscd") or ""
    name = o.get("hts_kor_isnm") or code
    price = _f(o.get("stck_prpr"))
    pct = _f(o.get("prdy_ctrt"))
    sign = o.get("prdy_vrss_sign")
    if sign in _NEG_SIGNS and pct > 0:
        pct = -pct
    vol = _i(o.get("acml_vol"))
    # 거래대금: 응답에 있으면 사용, 없으면 price*vol 근사
    tval = _f(o.get("acml_tr_pbmn")) or (price * vol)
    return {
        "stk_cd": code,
        "stk_nm": name,
        "curr": "KRW",
        "sector": "",
        "close_price": price,
        "change_rate": round(pct, 4),
        "volume": vol,
        "trade_value": tval,
    }


# ── QueryExecutor provider 진입점 ───────────────────────────────────────────────
# 백엔드(WebServer)는 RemoteTransport로 'kis' 조회를 Fetcher(exe)에 위임하고,
# Fetcher가 보유한 자격증명(appkey/appsecret)으로 실제 KIS REST를 호출한다.

class KISRankingQueryParams(BaseModel):
    sort_by: str = "gainers"   # gainers | losers | volume | trade_value
    market: str = "domestic"   # all | domestic | kospi | kosdaq
    limit: int = 50


class KISRankingData(BaseModel):
    stk_cd: str
    stk_nm: str
    curr: str = "KRW"
    sector: str = ""
    close_price: float = 0.0
    change_rate: float = 0.0
    volume: int = 0
    trade_value: float = 0.0


class KISRankingFetcher(ApiFetcher[KISRankingQueryParams, KISRankingData]):
    """fetch_kis_ranking 래핑. 자격증명은 QueryExecutor가 env(API_ENV_MAPPING['KIS'])
    에서 {appkey, appsecret}로 로드해 전달한다."""

    api_name = "KIS"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> KISRankingQueryParams:
        return KISRankingQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: KISRankingQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        return await fetch_kis_ranking(
            sort_by=query.sort_by,
            market=query.market,
            limit=query.limit,
            env=os.getenv("KIS_ENV", "real"),
            credentials=credentials,
        )

    @staticmethod
    def transform_data(
        query: KISRankingQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any,
    ) -> List[KISRankingData]:
        return [KISRankingData(**row) for row in (data or [])]
