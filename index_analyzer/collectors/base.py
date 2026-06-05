"""Collector ABC — targets() → fetch() → store() 공통 오케스트레이션.

무료 provider(nasdaqtrader/krx)를 QueryExecutor 로 호출해 universe 를 입수하고
ingest.repository 로 적재한다. 데몬 스케줄러에서 run() 을 호출한다.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from ..utils.logging import get_logger
from ..ingest.repository import store_universe, StoreResult

log = get_logger(__name__)


@dataclass
class Target:
    """수집 대상 한 건 (지수/거래소/자산)."""
    indx_cd: str                       # 'KOSPI' | 'NASDAQ' | 'NYSE_ARCA' | 'KRX_ETF' | 'KR_BOND' ...
    params: Dict[str, Any]             # fetcher 쿼리 파라미터 (예: {"market": "NASDAQ"})
    index_meta: Dict[str, Any]         # MBS_IN_INDX_STBD 메타 (indx_nm, indx_type, region)
    data_source: str                   # MBS_IN_STBD_MST.data_source
    country: str = "US"
    curr: str = "USD"
    asset_type: str = "stock"          # 'stock' | 'etf' | 'bond'
    link_member: bool = True           # INDX_MEMBER 연결 (bond=False)
    snapshot: Optional[str] = None     # 'etf' | 'bond' → 전용 스냅샷 테이블 적재
    model: Optional[str] = None        # fetcher 모델 override (없으면 collector.model)


def _to_dict(item: Any) -> Dict[str, Any]:
    """fetch 결과 원소(pydantic 또는 dict)를 dict 로 정규화."""
    if hasattr(item, "model_dump"):
        return item.model_dump(mode="json")
    if isinstance(item, dict):
        return item
    return dict(item)


class Collector(ABC):
    """수집기 베이스. provider/model 을 지정하고 targets() 만 구현하면 된다."""

    provider: str                      # data_fetcher provider 키
    model: str = "listing"             # fetcher 모델 키

    @abstractmethod
    def targets(self) -> List[Target]:
        """수집 대상 목록."""

    def fetch(self, target: Target) -> List[Dict[str, Any]]:
        """QueryExecutor 위임 — 무료 provider 이므로 creds 불필요. ttl=0 으로 항상 fresh."""
        import data_fetcher.providers_init  # noqa: F401 — provider 자동 등록 보장
        from data_fetcher.query_executor import QueryExecutor

        model = target.model or self.model
        result = QueryExecutor.fetch_sync(
            self.provider, model, target.params, ttl=0,
        )
        rows = result.result if hasattr(result, "result") else result
        return [_to_dict(r) for r in (rows or [])]

    def store(self, target: Target, rows: List[Dict[str, Any]]) -> StoreResult:
        return store_universe(
            indx_cd=target.indx_cd,
            index_meta=target.index_meta,
            rows=rows,
            data_source=target.data_source,
            country=target.country,
            curr=target.curr,
            asset_type=target.asset_type,
            link_member=target.link_member,
            snapshot=target.snapshot,
        )

    def run(self) -> Dict[str, Any]:
        """전체 대상 수집 → 적재. 대상별 결과 요약 반환."""
        summary: Dict[str, Any] = {"collector": type(self).__name__, "targets": []}
        for target in self.targets():
            try:
                rows = self.fetch(target)
                log.info("[%s] %s fetch: %d종목", self.provider, target.indx_cd, len(rows))
                result = self.store(target, rows)
                summary["targets"].append(result.as_dict())
            except Exception as exc:
                log.error("[%s] %s 수집 실패: %s", self.provider, target.indx_cd, exc, exc_info=True)
                summary["targets"].append({"indx_cd": target.indx_cd, "error": str(exc)})
        return summary
