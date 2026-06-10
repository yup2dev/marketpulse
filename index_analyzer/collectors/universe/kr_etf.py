"""KR ETF Collector — KRX 상장 ETF (krx/pykrx, 무료).

KR ETF 는 KOSPI/KOSDAQ 구분 없는 단일 시장이라 indx_cd='KRX_ETF' 하나로 묶는다.
"""
from typing import List

from ..base import Collector, Target


class KRETFCollector(Collector):
    provider = "krx"
    model = "listing"

    def targets(self) -> List[Target]:
        return [
            Target(
                indx_cd="KRX_ETF",
                params={"asset_class": "etf"},
                index_meta={"indx_nm": "KRX ETF", "indx_type": "exchange", "region": "KR"},
                data_source="krx_etf",
                country="KR",
                curr="KRW",
                asset_type="etf",
                link_member=True,
                snapshot="etf",
            ),
        ]
