"""FX Rate Collector — 일별 환율 → mbs_in_fx_stbd.

yahoo `stock_price` fetcher(FX 티커 `KRW=X` 등)를 QueryExecutor로 호출해 일별 종가를
받고, 전일比 등락률을 계산해 (fx_cd, base_ymd) 기준으로 UPSERT한다. 재실행해도 덮어쓴다.

실행: scripts/collect_fx.py (daily_ingest.bat) → sync_db_to_cloud.py → 서버 /api/ingest.
서버는 이 테이블만 읽어 통화 환산을 계산한다(요청 시 외부 호출 없음).
"""
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, Dict, List

from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from ..base import Collector, Target
from ...utils.db import default_db, generate_batch_id
from ...utils.logging import get_logger

log = get_logger(__name__)


@dataclass(frozen=True)
class FXPair:
    fx_cd: str        # 'USDKRW'
    base_curr: str    # 'USD'
    quote_curr: str   # 'KRW'
    yahoo_symbol: str # 'KRW=X' (Yahoo: 1 USD 당 KRW)


# 필요한 통화쌍을 여기 추가한다.
FX_PAIRS: List[FXPair] = [
    FXPair("USDKRW", "USD", "KRW", "KRW=X"),
]


def _ymd(value: Any) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value)[:10])


class FXRateCollector(Collector):
    provider = "yahoo"
    model = "stock_price"

    def __init__(self, period: str = "1mo") -> None:
        self.period = period

    def targets(self) -> List[Target]:
        return [
            Target(
                indx_cd=p.fx_cd,
                params={"symbol": p.yahoo_symbol, "period": self.period, "interval": "1d"},
                index_meta={"base_curr": p.base_curr, "quote_curr": p.quote_curr},
                data_source="yahoo_fx",
                asset_type="fx",
                link_member=False,
            )
            for p in FX_PAIRS
        ]

    @staticmethod
    def build_rows(target: Target, prices: List[Dict[str, Any]], batch_id: str) -> List[Dict[str, Any]]:
        """일별 시세 → 적재 행. 같은 날짜 중복은 마지막 값, 전일比는 정렬 후 계산."""
        by_day: Dict[date, float] = {}
        for p in prices:
            close = p.get("close")
            if p.get("date") is None or close is None or float(close) <= 0:
                continue
            by_day[_ymd(p["date"])] = float(close)

        rows: List[Dict[str, Any]] = []
        prev = None
        for day in sorted(by_day):
            rate = by_day[day]
            chg = round((rate - prev) / prev * 100, 4) if prev else None
            rows.append({
                "fx_cd": target.indx_cd,
                "base_curr": target.index_meta["base_curr"],
                "quote_curr": target.index_meta["quote_curr"],
                "rate": round(rate, 6),
                "change_rate": chg,
                "base_ymd": day,
                "data_source": target.data_source,
                "ingest_batch_id": batch_id,
            })
            prev = rate
        return rows

    def store(self, target: Target, rows: List[Dict[str, Any]]) -> Dict[str, Any]:  # type: ignore[override]
        from index_analyzer.models.orm import MBS_IN_FX_STBD

        if not rows:
            return {"fx_cd": target.indx_cd, "upserted": 0}
        now = datetime.utcnow()
        for r in rows:
            r.setdefault("created_at", now)
            r["updated_at"] = now

        stmt = sqlite_insert(MBS_IN_FX_STBD.__table__)
        stmt = stmt.on_conflict_do_update(
            index_elements=["fx_cd", "base_ymd"],
            set_={c: stmt.excluded[c] for c in
                  ("rate", "change_rate", "data_source", "ingest_batch_id", "updated_at")},
        )
        session = default_db.get_session()
        try:
            session.execute(stmt, rows)
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()
        return {
            "fx_cd": target.indx_cd,
            "upserted": len(rows),
            "latest": rows[-1]["base_ymd"].isoformat(),
            "rate": rows[-1]["rate"],
        }

    def run(self) -> Dict[str, Any]:
        default_db.create_tables()  # mbs_in_fx_stbd 보장
        batch_id = "fx_" + generate_batch_id()
        summary: Dict[str, Any] = {"collector": type(self).__name__, "targets": []}
        for target in self.targets():
            try:
                prices = self.fetch(target)
                rows = self.build_rows(target, prices, batch_id)
                summary["targets"].append(self.store(target, rows))
                log.info("[fx] %s: %d일 적재", target.indx_cd, len(rows))
            except Exception as exc:
                log.error("[fx] %s 수집 실패: %s", target.indx_cd, exc, exc_info=True)
                summary["targets"].append({"fx_cd": target.indx_cd, "error": str(exc)})
        return summary
