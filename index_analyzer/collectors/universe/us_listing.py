"""US Universe Collector — NYSE/NASDAQ 전 종목 (nasdaqtrader, 무료)."""
from typing import List

from ..base import Collector, Target


class USUniverseCollector(Collector):
    provider = "nasdaqtrader"
    model = "listing"

    def targets(self) -> List[Target]:
        return [
            Target(
                indx_cd="NASDAQ",
                params={"market": "NASDAQ"},
                index_meta={"indx_nm": "나스닥", "indx_type": "exchange", "region": "US"},
                data_source="nasdaqtrader_nasdaq",
                country="US",
            ),
            Target(
                indx_cd="NYSE",
                params={"market": "NYSE"},
                index_meta={"indx_nm": "뉴욕증권거래소", "indx_type": "exchange", "region": "US"},
                data_source="nasdaqtrader_nyse",
                country="US",
            ),
        ]
