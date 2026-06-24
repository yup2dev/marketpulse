"""13F Institutional Holdings Collector — whalewisdom(=SEC EDGAR)로 13F를 긁어 DB 캐싱.

- 기관 목록(이름/CIK)은 **전체** 적재(MBS_IN_INSTI_MST) — 검색/리스트용, 비용 작음.
- holdings(포트폴리오)는 비용이 커서 **featured 20개만** 수집(MBS_IN_INSTI_PORT/HOLD).
  나머지 기관은 백엔드에서 온디맨드 폴백으로 처리한다.

데몬 스케줄러가 run()을 호출(주 1회 권장 — 13F는 분기 공시). 데몬은 _remote=None이라
whalewisdom이 in-process(leaf)로 실행된다(로컬 Fetcher 불필요).
"""
from typing import Any, Dict, List

from ..base import Collector, Target, _to_dict
from ...utils.logging import get_logger
from ...ingest.repository import store_institutions_list, store_institution_portfolio

log = get_logger(__name__)

# 캐싱(holdings) 대상 — featured 기관. (전체 목록은 동적 수집)
FEATURED_KEYS = [
    "berkshire", "soros", "bridgewater", "renaissance", "ark", "pershing",
    "tiger", "citadel", "vanguard", "blackrock", "statestreet", "fidelity",
    "millennium", "twosigma", "viking", "baupost", "thirdpoint", "appaloosa",
    "greenlight", "pointstate",
]


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

    def run(self) -> Dict[str, Any]:
        summary: Dict[str, Any] = {
            "collector": type(self).__name__,
            "institutions": 0, "portfolios": [], "errors": [],
        }

        # 1) 전체 기관 목록 적재 (동적 → 실패 시 featured 폴백)
        try:
            rows = self._fetch_sync("institutions_list", {"use_dynamic": True, "limit": 10000})
            insts = [_to_dict(r) for r in (rows or [])]
            if not insts:
                rows = self._fetch_sync("institutions_list", {"use_dynamic": False, "limit": 100})
                insts = [_to_dict(r) for r in (rows or [])]
            summary["institutions"] = store_institutions_list(insts)
            log.info("[13F] institutions_list 적재: %d", summary["institutions"])
        except Exception as exc:  # noqa: BLE001
            log.error("[13F] institutions_list 실패: %s", exc, exc_info=True)
            summary["errors"].append(f"institutions_list: {exc}")

        # 2) featured holdings 적재
        for key in FEATURED_KEYS:
            try:
                rows = self._fetch_sync(
                    "institutional_holdings",
                    {"institution_key": key, "limit": 1000, "summary_only": False},
                )
                obj = (rows or [None])[0]
                if obj is None:
                    summary["errors"].append(f"{key}: empty")
                    continue
                store_institution_portfolio(key, _serialize_portfolio(obj))
                summary["portfolios"].append(key)
            except Exception as exc:  # noqa: BLE001
                log.error("[13F] %s 수집 실패: %s", key, exc, exc_info=True)
                summary["errors"].append(f"{key}: {exc}")

        log.info(
            "[13F] 완료 — 기관 %d, 포트폴리오 %d, 오류 %d",
            summary["institutions"], len(summary["portfolios"]), len(summary["errors"]),
        )
        return summary
