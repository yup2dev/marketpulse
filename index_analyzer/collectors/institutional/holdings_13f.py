"""13F Institutional Holdings Collector — whalewisdom(=SEC EDGAR)로 13F를 긁어 DB 캐싱.

- 기관 목록(이름/CIK)은 **전체** 적재(MBS_IN_INSTI_MST) — 검색/리스트용, 비용 작음.
- holdings(포트폴리오)는 비용이 커서 **featured 20개만** 수집(MBS_IN_INSTI_PORT/HOLD).
  나머지 기관은 백엔드에서 온디맨드 폴백으로 처리한다.

데몬 스케줄러가 run()을 호출(주 1회 권장 — 13F는 분기 공시). 데몬은 _remote=None이라
whalewisdom이 in-process(leaf)로 실행된다(로컬 Fetcher 불필요).
"""
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List

from ..base import Collector, Target, _to_dict
from ...utils.logging import get_logger
from ...ingest.repository import store_institutions_list, store_institution_portfolio

log = get_logger(__name__)

# 포트폴리오 웜캐시 대상 수(AUM 상위) 및 스캔 동시성 — 환경변수로 조정.
TOP_N = int(os.getenv("FETCHER_13F_TOP_N", "300"))
SCAN_WORKERS = int(os.getenv("FETCHER_13F_SCAN_WORKERS", "4"))
# AUM 스캔 대상 상한(0=전체). 테스트/부분수집 시 조정.
SCAN_LIMIT = int(os.getenv("FETCHER_13F_SCAN_LIMIT", "0"))

# featured 기관 — AUM 순위와 무관하게 웜캐시에 항상 포함(친숙한 slug 키 유지).
FEATURED_KEYS = [
    "berkshire", "soros", "bridgewater", "renaissance", "ark", "pershing",
    "tiger", "citadel", "vanguard", "blackrock", "statestreet", "fidelity",
    "millennium", "twosigma", "viking", "baupost", "thirdpoint", "appaloosa",
    "greenlight", "pointstate",
]

# 전역 rate-gate — 병렬 스캔이 SEC 공정이용(10 req/s)을 넘지 않도록 요청 시작 간격 제한.
# 각 summary 조회가 내부적으로 ~2요청이므로 0.25s 간격(≈4 조회/s → ≈8~10 req/s) 목표.
_rate_lock = threading.Lock()
_rate_last = [0.0]


def _rate_gate(min_interval: float = 0.25) -> None:
    with _rate_lock:
        now = time.monotonic()
        wait = min_interval - (now - _rate_last[0])
        if wait > 0:
            time.sleep(wait)
        _rate_last[0] = time.monotonic()


def _serialize_holding(stock: Any) -> Dict[str, Any]:
    """보유 종목 객체 → 저장 dict (portfolio_service._serialize 와 동일 필드)."""
    d = {
        "symbol": getattr(stock, "symbol", None),
        "name":   getattr(stock, "name", None),
        "cusip":  getattr(stock, "cusip", None),
        "value":  getattr(stock, "value", None),
        "shares": getattr(stock, "shares", None),
        "weight": getattr(stock, "weight", None),
    }
    for f in ("prev_shares", "prev_value", "share_change", "share_change_pct",
              "value_change", "value_change_pct", "status"):
        v = getattr(stock, f, None)
        if v is not None:
            d[f] = v
    return d


def _serialize_portfolio(p: Any) -> Dict[str, Any]:
    """whalewisdom InstitutionalHoldingsData 객체 → 저장 dict.

    portfolio_service.get_institution_portfolio 가 노출하는 shape와 동일하게 맞춘다
    (DB fetcher가 이 shape로 복원 → portfolio_service 직렬화 무수정).
    """
    out: Dict[str, Any] = {}
    for f in ("id", "institution_key", "manager", "name", "description",
              "total_value", "num_holdings", "filing_date", "period_end", "category",
              "previous_filing_date", "previous_value", "value_change", "value_change_pct",
              "num_new_positions", "num_sold_out", "num_increased", "num_decreased",
              "turnover", "performance", "top_sectors"):
        out[f] = getattr(p, f, None)
    out["stocks"] = [_serialize_holding(s) for s in (getattr(p, "stocks", None) or [])]
    out["sold_positions"] = [_serialize_holding(s) for s in (getattr(p, "sold_positions", None) or [])]
    return out


class Institutional13FCollector(Collector):
    """13F 기관 보유 수집기 (target 기반이 아니라 run() 커스텀)."""

    provider = "whalewisdom"
    model = "institutional_holdings"

    def targets(self) -> List[Target]:  # 미사용 (run 오버라이드)
        return []

    def _fetch_sync(self, model: str, params: Dict[str, Any]):
        import data_fetcher.providers_init  # noqa: F401 — provider 등록 보장
        from data_fetcher.query_executor import QueryExecutor
        res = QueryExecutor.fetch_sync(self.provider, model, params, ttl=0)
        return res.result if hasattr(res, "result") else res

    def _summary_aum(self, key: str) -> float:
        """summary_only 조회로 기관의 13F 총가치(AUM 근사)만 싸게 가져온다."""
        _rate_gate()
        try:
            rows = self._fetch_sync(
                "institutional_holdings",
                {"institution_key": key, "summary_only": True, "limit": 1},
            )
            obj = (rows or [None])[0]
            return float(getattr(obj, "total_value", 0) or 0) if obj is not None else 0.0
        except Exception:  # noqa: BLE001
            return 0.0

    def run(self) -> Dict[str, Any]:
        summary: Dict[str, Any] = {
            "collector": type(self).__name__,
            "institutions": 0, "scanned": 0, "portfolios": [], "errors": [],
        }

        # 1) 전체 기관 목록(동적) 적재 → 실패 시 featured 폴백
        insts: List[Dict[str, Any]] = []
        try:
            rows = self._fetch_sync("institutions_list", {"use_dynamic": True, "limit": 100000})
            insts = [_to_dict(r) for r in (rows or [])]
            if not insts:
                rows = self._fetch_sync("institutions_list", {"use_dynamic": False, "limit": 100})
                insts = [_to_dict(r) for r in (rows or [])]
            summary["institutions"] = store_institutions_list(insts)
            log.info("[13F] institutions_list 적재: %d", summary["institutions"])
        except Exception as exc:  # noqa: BLE001
            log.error("[13F] institutions_list 실패: %s", exc, exc_info=True)
            summary["errors"].append(f"institutions_list: {exc}")

        # 2) 전 기관을 summary_only 로 병렬 스캔 → AUM 상위 TOP_N 선정
        keys = [i.get("key") or i.get("cik") for i in insts]
        keys = [k for k in keys if k]
        if SCAN_LIMIT > 0:
            keys = keys[:SCAN_LIMIT]
        aum: Dict[str, float] = {}
        if keys:
            log.info("[13F] AUM 스캔 시작: %d개 기관 (workers=%d)", len(keys), SCAN_WORKERS)
            with ThreadPoolExecutor(max_workers=SCAN_WORKERS) as ex:
                for k, v in zip(keys, ex.map(self._summary_aum, keys)):
                    aum[k] = v
            summary["scanned"] = len(aum)

        ranked = sorted(aum.items(), key=lambda kv: kv[1], reverse=True)
        top_keys = [k for k, v in ranked[:TOP_N] if v > 0]
        # featured 는 순위와 무관하게 항상 포함(중복 제거, 순서 유지)
        target_keys = list(dict.fromkeys(list(FEATURED_KEYS) + top_keys))
        log.info("[13F] 웜캐시 대상: %d개 (AUM 상위 %d + featured)", len(target_keys), TOP_N)

        # 3) 대상 포트폴리오 전체 파싱 + 적재 (플레이스홀더/빈 공시는 스킵)
        for key in target_keys:
            try:
                rows = self._fetch_sync(
                    "institutional_holdings",
                    {"institution_key": key, "limit": 1000, "summary_only": False},
                )
                obj = (rows or [None])[0]
                if obj is None:
                    summary["errors"].append(f"{key}: empty")
                    continue
                if not (getattr(obj, "stocks", None) or []):
                    summary["errors"].append(f"{key}: no holdings")
                    continue
                store_institution_portfolio(key, _serialize_portfolio(obj))
                summary["portfolios"].append(key)
            except Exception as exc:  # noqa: BLE001
                log.error("[13F] %s 수집 실패: %s", key, exc, exc_info=True)
                summary["errors"].append(f"{key}: {exc}")

        log.info(
            "[13F] 완료 — 기관 %d, 스캔 %d, 포트폴리오 %d, 오류 %d",
            summary["institutions"], summary["scanned"],
            len(summary["portfolios"]), len(summary["errors"]),
        )
        return summary
