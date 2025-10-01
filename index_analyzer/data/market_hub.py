from datetime import datetime, timedelta, timezone
from typing import Dict, Any

from .yahoo_provider import YahooProvider
from .tradingview_provider import TradingViewProvider


class MarketDataHub:
    def __init__(self) -> None:
        self.yahoo = YahooProvider()
        self.tv = TradingViewProvider()

    def fetch_series(self, plan: Dict[str, Any]) -> Dict[str, Any]:
        out: Dict[str, Any] = {"equity": {}, "commodity": {}, "macro": {}, "tv": {}}
        w = plan.get("window", {})
        try:
            start = datetime.fromisoformat(w.get("start"))
            end = datetime.fromisoformat(w.get("end"))
        except Exception:
            now = datetime.now(timezone.utc)
            start, end = now - timedelta(days=7), now + timedelta(days=7)
        for t in plan.get("targets", []):
            typ = t.get("type")
            if typ == "equity" and t.get("ticker"):
                tk = t["ticker"]
                out["equity"][tk] = self.yahoo.fetch(tk, start, end) or []
                tv_sym = tk.split(".")[0]
                tv_data = self.tv.fetch(tv_sym, None, start, end, "1D")
                if tv_data is not None:
                    out["tv"][tv_sym] = tv_data
            elif typ == "commodity" and t.get("symbol"):
                sym = t["symbol"]
                out["commodity"][sym] = self.yahoo.fetch(sym, start, end) or []
            elif typ == "macro":
                if t.get("ticker"):
                    tk = t["ticker"]
                    out["macro"][tk] = self.yahoo.fetch(tk, start, end) or []
        return out