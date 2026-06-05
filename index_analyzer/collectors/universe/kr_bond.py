"""KR Bond Collector — KR 국고채/시장금리 벤치마크 (krx/pykrx, 무료).

BOND 는 국가별 분류만(지수 소속 없음). STBD_MST(asset_type='bond') + BOND_STBD 스냅샷.
"""
from typing import List

from ..base import Collector, Target


class KRBondCollector(Collector):
    provider = "krx"
    model = "bond"

    def targets(self) -> List[Target]:
        return [
            Target(
                indx_cd="KR_BOND",
                params={},
                index_meta={"indx_nm": "KR 채권", "indx_type": "bond", "region": "KR"},
                data_source="krx_bond",
                country="KR",
                curr="KRW",
                asset_type="bond",
                link_member=False,   # 채권은 지수 소속 없음 (국가별 분류만)
                snapshot="bond",
            ),
        ]
