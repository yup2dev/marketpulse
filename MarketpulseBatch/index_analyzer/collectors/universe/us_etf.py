"""US ETF Collector — NASDAQ/NYSE ARCA/AMEX/BZX/IEX 상장 ETF (nasdaqtrader, 무료).

ETF 는 상장 거래소(venue)별로 INDX_MEMBER 에 연결한다(지수별 분류).
"""
from typing import List

from ..base import Collector, Target

# (venue indx_cd, market 파라미터, 표시명)
_VENUES = [
    ("NASDAQ",        "NASDAQ",        "나스닥"),
    ("NYSE_ARCA",     "NYSE_ARCA",     "NYSE ARCA"),
    ("NYSE_AMERICAN", "NYSE_AMERICAN", "NYSE American"),
    ("CBOE_BZX",      "CBOE_BZX",      "Cboe BZX"),
    ("IEX",           "IEX",           "IEX"),
]


class USETFCollector(Collector):
    provider = "nasdaqtrader"
    model = "listing"

    def targets(self) -> List[Target]:
        out: List[Target] = []
        for indx_cd, market, nm in _VENUES:
            out.append(Target(
                indx_cd=indx_cd,
                params={"market": market, "asset_class": "etf"},
                index_meta={"indx_nm": nm, "indx_type": "exchange", "region": "US"},
                data_source=f"nasdaqtrader_{indx_cd.lower()}_etf",
                country="US",
                curr="USD",
                asset_type="etf",
                link_member=True,
                snapshot="etf",
            ))
        return out
