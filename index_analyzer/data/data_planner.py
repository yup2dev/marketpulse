from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional

from ..models.schemas import AnalysisConfig


class RelatedDataPlanner:
    def __init__(self, acfg: AnalysisConfig) -> None:
        self.acfg = acfg

    def build(self, mapped: Dict[str, Any], base_time: Optional[datetime], sentiment: str) -> Dict[str, Any]:
        if not base_time:
            base_time = datetime.now(timezone.utc)
        start = base_time - timedelta(days=self.acfg.data_window_days)
        end = base_time + timedelta(days=self.acfg.data_window_days)
        plan = {"window": {"start": start.isoformat(), "end": end.isoformat()}, "targets": [], "recommend": []}
        for c in mapped.get("companies", []):
            plan["targets"].append({"type": "equity", "ticker": c.get("ticker"), "sector": c.get("sector")})
        for cm in mapped.get("commodities", []):
            plan["targets"].append({"type": "commodity", "symbol": cm.get("symbol")})
        for m in mapped.get("macro", []):
            t = {"type": "macro"}
            if m.get("fred"):
                t["fred_series"] = m["fred"]
            if m.get("ticker"):
                t["ticker"] = m["ticker"]
            plan["targets"].append(t)
        if sentiment == "good":
            seen = {c.get("sector") for c in mapped.get("companies", []) if c.get("sector")}
            plan["recommend"] = sorted([s for s in seen if s])
        elif sentiment == "bad":
            plan["recommend"] = ["Defensives", "Utilities", "Gold"]
        return plan