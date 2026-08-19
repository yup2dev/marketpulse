"""CFTC COT Positioning Fetcher — 주간 비상업(투기) 순포지션 + 변화 속도.

소스: CFTC Public Reporting (Socrata) `6dca-aqww`
      = Legacy Futures-Only, "Commitments of Traders" 전체 히스토리.
      API 키 불필요 (앱 토큰 없이도 조회 가능, 익명 쿼터 적용).

엔 캐리 용도로는 contract='JAPANESE YEN' 이 IMM 스펙 순포지션에 해당한다.
지표의 후행성/커버리지 한계는 standard model 도큐스트링 참조.
"""
import logging
import statistics
from datetime import timedelta
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.abstract_provider.standard_models.cot_positioning import (
    CotPositioningData,
    CotPositioningQueryParams,
)

log = logging.getLogger(__name__)

COT_URL = "https://publicreporting.cftc.gov/resource/6dca-aqww.json"

#: z-score 산출용 과거 구간(주). 3년치.
_ZSCORE_LOOKBACK = 156

#: 파생값 워밍업 주 수 = z-score 구간 + 4주 변화분.
#: start_date로 조회할 때 이만큼 앞에서부터 받아와야 구간 첫 행부터 z-score/4주변화가 채워진다.
_WARMUP_WEEKS = _ZSCORE_LOOKBACK + 4


class CFTCCotPositioningQueryParams(CotPositioningQueryParams):
    """CFTC COT 조회 파라미터 (standard CotPositioning 경유)."""


class CFTCCotPositioningData(CotPositioningData):
    """CFTC COT 주간 순포지션 (standard CotPositioning 경유)."""


def _as_int(value: Any) -> Optional[int]:
    if value in (None, "", "."):
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


class CFTCCotPositioningFetcher(
    ApiFetcher[CFTCCotPositioningQueryParams, CFTCCotPositioningData]
):
    """CFTC COT 주간 포지션 — 순포지션 수준 + 1주/4주 변화 + z-score."""

    api_name = "CFTC"
    require_credentials = False

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> CFTCCotPositioningQueryParams:
        return CFTCCotPositioningQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: CFTCCotPositioningQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        from data_fetcher.utils.provider_helpers import amake_json_request

        # 계약명에 작은따옴표가 들어가면 SoQL 문자열이 깨지므로 이스케이프한다.
        contract = str(query.contract).replace("'", "''")
        where = [f"contract_market_name='{contract}'"]

        if query.start_date:
            # 날짜 구간 조회: 워밍업만큼 앞당겨 받아야 구간 첫 행의 파생값이 비지 않는다.
            warmup_start = query.start_date - timedelta(weeks=_WARMUP_WEEKS)
            where.append(
                f"report_date_as_yyyy_mm_dd >= '{warmup_start.isoformat()}T00:00:00'"
            )
            if query.end_date:
                where.append(
                    f"report_date_as_yyyy_mm_dd <= '{query.end_date.isoformat()}T23:59:59'"
                )
            # 주간 데이터라 구간 길이에서 필요한 행 수가 정해진다. 여유 있게 상한을 준다.
            fetch_limit = 50000
        else:
            # 날짜가 없으면 기존 방식 — 최근 weeks + 워밍업 만큼만 가져온다.
            fetch_limit = int(query.weeks) + _WARMUP_WEEKS

        params = {
            "$where": " AND ".join(where),
            "$order": "report_date_as_yyyy_mm_dd DESC",
            "$limit": fetch_limit,
        }
        rows = await amake_json_request(COT_URL, params=params, timeout=30)
        if not isinstance(rows, list) or not rows:
            raise ValueError(
                f"CFTC COT: no rows for contract '{query.contract}'. "
                "계약명은 정확히 일치해야 한다 (예: 'JAPANESE YEN', 'EURO FX')."
            )
        return rows

    @staticmethod
    def transform_data(
        query: CFTCCotPositioningQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any,
    ) -> List[CFTCCotPositioningData]:
        # API는 최신순(DESC)으로 준다 → 오름차순으로 뒤집어 시계열 파생값을 계산한다.
        rows = sorted(data, key=lambda r: r.get("report_date_as_yyyy_mm_dd") or "")

        parsed: List[Dict[str, Any]] = []
        for row in rows:
            raw_date = row.get("report_date_as_yyyy_mm_dd") or ""
            long_ = _as_int(row.get("noncomm_positions_long_all"))
            short_ = _as_int(row.get("noncomm_positions_short_all"))
            oi = _as_int(row.get("open_interest_all"))
            c_long = _as_int(row.get("comm_positions_long_all"))
            c_short = _as_int(row.get("comm_positions_short_all"))

            net = (long_ - short_) if (long_ is not None and short_ is not None) else None
            parsed.append({
                "report_date": raw_date[:10],
                "contract": row.get("contract_market_name"),
                "open_interest": oi,
                "noncomm_long": long_,
                "noncomm_short": short_,
                # 원본 필드명에 오타가 있다(positions → postions). 그대로 읽어야 한다.
                "noncomm_spread": _as_int(row.get("noncomm_postions_spread_all")),
                "net_noncomm": net,
                "net_noncomm_pct_oi": (
                    round(net / oi * 100, 2) if net is not None and oi else None
                ),
                "comm_long": c_long,
                "comm_short": c_short,
                "net_comm": (
                    c_long - c_short if (c_long is not None and c_short is not None) else None
                ),
            })

        nets = [p["net_noncomm"] for p in parsed]
        for i, p in enumerate(parsed):
            net = nets[i]
            if net is None:
                continue
            if i >= 1 and nets[i - 1] is not None:
                p["net_change_1w"] = net - nets[i - 1]
            if i >= 4 and nets[i - 4] is not None:
                p["net_change_4w"] = net - nets[i - 4]

            # z-score: 직전 _ZSCORE_LOOKBACK주 대비 (당주 제외 — 자기 자신을 기준에 넣지 않는다)
            window = [n for n in nets[max(0, i - _ZSCORE_LOOKBACK):i] if n is not None]
            if len(window) >= 30:
                sd = statistics.pstdev(window)
                if sd > 0:
                    p["net_zscore"] = round((net - statistics.fmean(window)) / sd, 2)

        # 파생값 계산이 끝난 뒤 잘라 반환 (최신이 마지막 = 차트 오름차순).
        # start_date가 있으면 날짜로, 없으면 기존대로 주 수로 자른다.
        if query.start_date:
            start_iso = query.start_date.isoformat()
            end_iso = query.end_date.isoformat() if query.end_date else None
            trimmed = [
                p for p in parsed
                if p["report_date"] >= start_iso
                and (end_iso is None or p["report_date"] <= end_iso)
            ]
        else:
            trimmed = parsed[-int(query.weeks):] if query.weeks else parsed
        return [CFTCCotPositioningData(**p) for p in trimmed]
