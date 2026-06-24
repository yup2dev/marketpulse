"""KRX Bond Fetcher — KR 국고채/시장금리 (pykrx, 무료)

무료 universe 채권 소스가 마땅치 않아, pykrx 장외 국고채 수익률
(`bond.get_otc_treasury_yields`)을 채권 벤치마크 행으로 입수한다.
각 만기/상품(국고채 1·3·5·10년, 회사채, CD 등)을 1행으로 적재한다.
키 불필요(credentials=[]).
"""
import logging
import re
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.standard_models.bond_yield_benchmark import (
    BondYieldBenchmarkQueryParams,
    BondYieldBenchmarkData,
)
from data_fetcher.abstract_provider.abstract.fetcher import Fetcher

log = logging.getLogger(__name__)


class KRXBondQueryParams(BondYieldBenchmarkQueryParams):
    """KR 채권 벤치마크 조회 파라미터 (standard BondYieldBenchmark 경유)"""


class KRXBondData(BondYieldBenchmarkData):
    """KR 채권 벤치마크 데이터 (standard BondYieldBenchmark 경유)"""


def _classify(name: str) -> str:
    if "국고" in name or "국채" in name:
        return "treasury"
    if "회사채" in name or "회사" in name:
        return "corporate"
    if "통안" in name:
        return "msb"
    if "CD" in name.upper():
        return "cd"
    if "콜" in name:
        return "call"
    return "other"


def _maturity(name: str) -> Optional[str]:
    m = re.search(r"(\d+)\s*년", name)
    if m:
        return f"{m.group(1)}Y"
    m = re.search(r"(\d+)\s*일", name)
    if m:
        return f"{m.group(1)}D"
    m = re.search(r"(\d+)\s*개?월", name)
    if m:
        return f"{m.group(1)}M"
    return None


def _slug(name: str) -> str:
    s = re.sub(r"\s+", "_", name.strip())
    return "KR_" + re.sub(r"[^0-9A-Za-z가-힣_]", "", s)


class KRXBondFetcher(Fetcher[KRXBondQueryParams, KRXBondData]):
    """KR 국고채/시장금리 벤치마크 Fetcher (pykrx, 무료)"""

    require_credentials = False

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> KRXBondQueryParams:
        return KRXBondQueryParams(**params)

    @staticmethod
    def extract_data(
        query: KRXBondQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        from datetime import date as _date

        try:
            from pykrx import bond
        except ImportError as exc:  # pragma: no cover
            raise RuntimeError(
                "pykrx 미설치 — KR 채권 수집 불가. `pip install pykrx` 후 재시도."
            ) from exc

        today = _date.today().strftime("%Y%m%d")
        df = bond.get_otc_treasury_yields(today)
        if df is None or len(df) == 0:
            log.warning("[KRX bond] %s 수익률 데이터 없음", today)
            return []

        # 마지막(최신) 행을 벤치마크 스냅샷으로 사용. 컬럼 = 상품/만기.
        latest = df.iloc[-1]
        out: List[Dict[str, Any]] = []
        for col, val in latest.items():
            name = str(col).strip()
            if not name:
                continue
            try:
                rate = float(val)
            except (TypeError, ValueError):
                rate = None
            out.append({
                "ticker_cd": _slug(name),
                "ticker_nm": name,
                "bond_type": _classify(name),
                "maturity": _maturity(name),
                "yield_rate": rate,
            })
        log.info("[KRX bond] %d개 벤치마크", len(out))
        return out

    @staticmethod
    def transform_data(
        query: KRXBondQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any,
    ) -> List[KRXBondData]:
        results: List[KRXBondData] = []
        for item in data:
            ticker = item.get("ticker_cd", "")
            if not ticker:
                continue
            results.append(KRXBondData(**item))
        log.info("[KRX bond] transformed %d bonds", len(results))
        return results
