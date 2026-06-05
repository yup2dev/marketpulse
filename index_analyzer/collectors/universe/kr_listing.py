"""KR Universe Collector — KOSPI/KOSDAQ 전 종목 (krx/pykrx, 무료)."""
from typing import List

from ..base import Collector, Target


class KRUniverseCollector(Collector):
    provider = "krx"
    model = "listing"

    def targets(self) -> List[Target]:
        return [
            Target(
                indx_cd="KOSPI",
                params={"market": "KOSPI"},
                index_meta={"indx_nm": "코스피", "indx_type": "exchange", "region": "KR"},
                data_source="krx_kospi",
                country="KR",
            ),
            Target(
                indx_cd="KOSDAQ",
                params={"market": "KOSDAQ"},
                index_meta={"indx_nm": "코스닥", "indx_type": "exchange", "region": "KR"},
                data_source="krx_kosdaq",
                country="KR",
            ),
        ]
