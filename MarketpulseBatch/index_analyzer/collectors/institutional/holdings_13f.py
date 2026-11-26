"""13F Institutional Holdings Collector — SEC EDGAR 13F를 로컬에서 파싱해 DB 적재.

13F 원본 파싱은 메모리 부담이 커서 운영 서버에서 하지 않는다. 이 배치가 로컬에서
파싱·산출한 결과만 적재하고(MarketpulseBatch/jobs/sync_db_to_cloud.py로 클라우드 전송), 서버는 DB만 읽는다.

- 기관 목록(이름/CIK)은 **전체** 적재(MBS_IN_INSTI_MST) — 검색/리스트용.
- 포트폴리오는 featured + AUM 상위 TOP_N 기관만 수집(MBS_IN_INSTI_PORT/HOLD).
- 같은 대상의 13F 기반 분기 추정 수익률도 산출해 적재(MBS_IN_INSTI_PERF).
- featured + AUM 상위 HIST_TOP_N 기관은 최근 HIST_QUARTERS 분기 포트폴리오 이력도 적재
  (MBS_IN_INSTI_PORT_HIST/HOLD_HIST — 위젯 기준 분기 선택). 이미 적재된 분기는 건너뛴다.
  미적재 기관은 서버 온디맨드 폴백 없이 '미적재'로 표시된다.

실행: MarketpulseBatch/jobs/collect_13f.py (daily_ingest.bat 가 주 1회 호출 — 13F는 분기 공시).
QueryExecutor(순수 실행)를 in-process 로 쓰므로 로컬에서 직접 파싱한다.

fetcher(sec institutional_13f · 13f_filings · 13f_institutions)는 공시 원본만 주고,
비중 · 분기 대비 · 회전율 · 추정 수익률 계산은 이 배치가 한다 (analysis.py).
"""
import asyncio
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List

from ..base import Collector, Target, _to_dict
from . import analysis
from index_analyzer.utils.logger import get_logger
from ...ingest.repository import (
    store_fund_performance,
    store_institution_portfolio,
    store_institution_history,
    store_institutions_list,
    stored_institution_periods,
)

log = get_logger(__name__)

# 포트폴리오 웜캐시 대상 수(AUM 상위) 및 스캔 동시성 — 환경변수로 조정.
TOP_N = int(os.getenv("FETCHER_13F_TOP_N", "300"))
SCAN_WORKERS = int(os.getenv("FETCHER_13F_SCAN_WORKERS", "4"))
# AUM 스캔 대상 상한(0=전체). 테스트/부분수집 시 조정.
SCAN_LIMIT = int(os.getenv("FETCHER_13F_SCAN_LIMIT", "0"))
# 추정 수익률 산출 분기 수(스냅샷 수 — 행은 1 적음). 위젯 기본 조회(8)를 덮는 값.
PERF_QUARTERS = int(os.getenv("FETCHER_13F_PERF_QUARTERS", "8"))
# 포트폴리오 분기 이력 — 대상 기관 수(featured 외 AUM 상위)와 분기 수. 지난 분기 공시는 바뀌지 않아
# 없는 분기만 파싱하므로 첫 실행 이후엔 기관당 분기마다 1건만 늘어난다.
HIST_TOP_N = int(os.getenv("FETCHER_13F_HIST_TOP_N", "50"))
HIST_QUARTERS = int(os.getenv("FETCHER_13F_HIST_QUARTERS", "8"))

# featured 기관 — AUM 순위와 무관하게 웜캐시에 항상 포함(친숙한 slug 키 유지).
FEATURED_KEYS = [
    "berkshire", "soros", "bridgewater", "renaissance", "ark", "pershing",
    "tiger", "citadel", "vanguard", "blackrock", "statestreet", "fidelity",
    "millennium", "twosigma", "viking", "baupost", "thirdpoint", "appaloosa",
    "greenlight", "pointstate", "situational-awareness",
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


def _get(obj: Any, key: str) -> Any:
    return obj.get(key) if isinstance(obj, dict) else getattr(obj, key, None)


def _serialize_holding(stock: Any) -> Dict[str, Any]:
    """보유 종목(dict · 객체) → 저장 dict (portfolio_service._serialize 와 동일 필드)."""
    d = {f: _get(stock, f) for f in ("symbol", "name", "cusip", "value", "shares", "weight")}
    for f in ("prev_shares", "prev_value", "share_change", "share_change_pct",
              "value_change", "value_change_pct", "status"):
        v = _get(stock, f)
        if v is not None:
            d[f] = v
    return d


def _serialize_portfolio(p: Any) -> Dict[str, Any]:
    """포트폴리오(analysis.portfolio 의 dict · 객체) → 저장 dict.

    portfolio_service.get_institution_portfolio 가 노출하는 shape와 동일하게 맞춘다
    (DB fetcher가 이 shape로 복원 → portfolio_service 직렬화 무수정).
    """
    out: Dict[str, Any] = {}
    for f in ("id", "institution_key", "manager", "name", "description",
              "total_value", "num_holdings", "filing_date", "period_end", "category",
              "previous_filing_date", "previous_value", "value_change", "value_change_pct",
              "num_new_positions", "num_sold_out", "num_increased", "num_decreased",
              "turnover", "performance", "top_sectors"):
        out[f] = _get(p, f)
    out["stocks"] = [_serialize_holding(s) for s in (_get(p, "stocks") or [])]
    out["sold_positions"] = [_serialize_holding(s) for s in (_get(p, "sold_positions") or [])]
    return out


class Institutional13FCollector(Collector):
    """13F 기관 보유 수집기 (target 기반이 아니라 run() 커스텀)."""

    provider = "sec"
    model = "institutional_13f"

    def targets(self) -> List[Target]:  # 미사용 (run 오버라이드)
        return []

    def _fetch_sync(self, model: str, params: Dict[str, Any], provider: str = ""):
        import data_fetcher.providers_init  # noqa: F401 — provider 등록 보장
        from data_fetcher.query_executor import QueryExecutor
        res = asyncio.run(QueryExecutor().execute(provider or self.provider, model, params))
        return res.result if hasattr(res, "result") else res

    def _filing(self, key: str, **params) -> Dict[str, Any] | None:
        rows = self._fetch_sync("institutional_13f", {"institution_key": key, **params})
        return _to_dict(rows[0]) if rows else None

    # ── 조회 + 분석 (적재 shape 의 dict) ────────────────────────────────────

    def institutions(self, use_dynamic: bool = True, limit: int = 100) -> List[Dict[str, Any]]:
        rows = self._fetch_sync("13f_institutions", {"use_dynamic": use_dynamic, "limit": limit})
        return [_to_dict(r) for r in (rows or [])]

    def summary(self, key: str) -> Dict[str, Any] | None:
        """커버페이지만 — 이번 · 직전 분기 총가치 (AUM 스캔용)."""
        raw = self._filing(key, summary_only=True)
        return analysis.summary(raw, key) if raw else None

    def portfolio(self, key: str, period: str | None = None, limit: int = 1000) -> Dict[str, Any] | None:
        """이번(또는 period) · 직전 분기 공시 → 비중 · 분기 대비 · 매도 · 회전율 (적재 shape)."""
        raw = self._filing(key, period=period)
        port = analysis.portfolio(raw, key, limit) if raw else None
        return _serialize_portfolio(port) if port else None

    def performance(self, key: str, quarters: int = PERF_QUARTERS) -> List[Dict[str, Any]]:
        """최근 quarters 분기 공시(직전 분기 없이 하나씩) → 분기 추정 수익률 (최신 분기 먼저)."""
        filings = self._fetch_sync("13f_filings", {"institution_key": key, "limit": max(2, quarters)})
        snapshots, name, manager = [], None, None
        for f in filings or []:
            period = _get(f, "period")
            _rate_gate()
            try:
                raw = self._filing(key, period=period, with_previous=False)
            except Exception as exc:  # noqa: BLE001 — 한 분기 실패가 전체를 죽이면 안 된다
                log.warning("[13F] %s %s 파싱 실패: %s", key, period, exc)
                continue
            if raw and raw.get("holdings"):
                name, manager = raw.get("name"), raw.get("manager")
                snapshots.append({"period": period, "filing_date": raw.get("filing_date"),
                                  "holdings": raw["holdings"]})
        return analysis.fund_performance(snapshots, key, name, manager)

    # ── 적재 ──────────────────────────────────────────────────────────────

    def _store_performance(self, key: str) -> int:
        """기관의 13F 분기 추정 수익률을 산출해 교체 적재."""
        return store_fund_performance(key, self.performance(key, PERF_QUARTERS))

    def _store_history(self, key: str) -> int:
        """최근 HIST_QUARTERS 분기 중 이력 테이블에 없는 분기만 파싱해 적재. 반환: 새로 적재한 분기 수."""
        _rate_gate()
        filings = self._fetch_sync("13f_filings", {"institution_key": key, "limit": HIST_QUARTERS})
        have = stored_institution_periods(key)
        added = 0
        for f in filings or []:
            period = _get(f, "period")
            if not period or period in have:
                continue
            _rate_gate()
            port = self.portfolio(key, period=period)
            if not port or not port.get("stocks"):
                log.warning("[13F] %s %s: 보유내역 없음 — 이력 건너뜀", key, period)
                continue
            store_institution_history(key, period, port)
            added += 1
        return added

    def _summary_aum(self, key: str) -> float:
        """summary_only 조회로 기관의 13F 총가치(AUM 근사)만 싸게 가져온다."""
        _rate_gate()
        try:
            s = self.summary(key)
            return float((s or {}).get("total_value") or 0)
        except Exception:  # noqa: BLE001
            return 0.0

    def run(self) -> Dict[str, Any]:
        summary: Dict[str, Any] = {
            "collector": type(self).__name__,
            "institutions": 0, "scanned": 0, "portfolios": [], "performance": 0, "history": 0,
            "errors": [],
        }

        # 1) 전체 기관 목록(동적) 적재 → 실패 시 featured 폴백
        insts: List[Dict[str, Any]] = []
        try:
            insts = self.institutions(use_dynamic=True, limit=100000)
            if not insts:
                insts = self.institutions(use_dynamic=False, limit=100)
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
        hist_keys = set(FEATURED_KEYS) | set(top_keys[:HIST_TOP_N])

        # 3) 대상 포트폴리오 전체 파싱 + 적재 (플레이스홀더/빈 공시는 스킵)
        for key in target_keys:
            try:
                port = self.portfolio(key)
                if port is None:
                    summary["errors"].append(f"{key}: empty")
                    continue
                if not port.get("stocks"):
                    summary["errors"].append(f"{key}: no holdings")
                    continue
                store_institution_portfolio(key, port)
                summary["portfolios"].append(key)
            except Exception as exc:  # noqa: BLE001
                log.error("[13F] %s 수집 실패: %s", key, exc, exc_info=True)
                summary["errors"].append(f"{key}: {exc}")
                continue

            # 4) 같은 기관의 분기 추정 수익률 — 실패해도 포트폴리오 적재는 유지
            try:
                if self._store_performance(key):
                    summary["performance"] += 1
            except Exception as exc:  # noqa: BLE001
                log.error("[13F] %s 수익률 산출 실패: %s", key, exc, exc_info=True)
                summary["errors"].append(f"{key} performance: {exc}")

            # 5) 분기 이력 (기준 분기 선택용) — 실패해도 최신 포트폴리오는 유지
            if key in hist_keys and HIST_QUARTERS > 0:
                try:
                    summary["history"] += self._store_history(key)
                except Exception as exc:  # noqa: BLE001
                    log.error("[13F] %s 분기 이력 실패: %s", key, exc, exc_info=True)
                    summary["errors"].append(f"{key} history: {exc}")

        log.info(
            "[13F] 완료 — 기관 %d, 스캔 %d, 포트폴리오 %d, 수익률 %d, 이력 분기 %d, 오류 %d",
            summary["institutions"], summary["scanned"], len(summary["portfolios"]),
            summary["performance"], summary["history"], len(summary["errors"]),
        )
        return summary
