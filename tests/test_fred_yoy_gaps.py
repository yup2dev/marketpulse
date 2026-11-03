"""FRED 결측월('.')을 지나는 YoY — 날짜 매칭인지 (위치 기준이면 13개월 변화가 된다)."""
import pytest

from data_fetcher.providers.fred.models.phillips_curve import (
    FREDPhillipsCurveFetcher,
    PhillipsCurveQueryParams,
)
from data_fetcher.providers.fred.models.regime_history import (
    FREDRegimeHistoryFetcher,
    RegimeHistoryQueryParams,
)
from data_fetcher.providers.fred.utils.yoy import pct_change_at, shift_month, yoy_at

# 실제 FRED CPIAUCSL — 2025-10 은 셧다운으로 '.'
_CPI = [("2026-09", "336.298"), ("2026-08", "334.131"), ("2026-07", "332.813"),
        ("2026-06", "332.568"), ("2026-05", "333.979"), ("2026-04", "332.407"),
        ("2026-03", "330.293"), ("2026-02", "327.460"), ("2026-01", "326.588"),
        ("2025-12", "326.031"), ("2025-11", "325.063"), ("2025-10", "."),
        ("2025-09", "324.245"), ("2025-08", "323.291"), ("2025-07", "322.169")]
CPI_OBS = [{"date": f"{d}-01", "value": v} for d, v in sorted(_CPI)]
TRUE_YOY_2026_09 = 336.298 / 324.245 * 100 - 100        # 3.717
WRONG_13M = 336.298 / 323.291 * 100 - 100               # 4.023 (위치 기준 결과)


@pytest.mark.parametrize("ymd,n,expected", [
    ("2026-09-01", -12, "2025-09-01"), ("2026-01-01", -1, "2025-12-01"),
    ("2026-03-01", -3, "2025-12-01"), ("2025-12-01", 1, "2026-01-01"),
    ("2026-01-01", -25, "2023-12-01"),
])
def test_shift_month(ymd, n, expected):
    assert shift_month(ymd, n) == expected


def test_yoy_at_missing_points():
    by = {"2026-09-01": 110.0, "2025-09-01": 100.0}
    assert yoy_at(by, "2026-09-01") == pytest.approx(10.0)
    assert yoy_at(by, "2026-08-01") is None              # 현재값 없음
    assert pct_change_at(by, "2026-09-01", 1) is None    # 전월 없음
    assert yoy_at({"2026-09-01": 1.0, "2025-09-01": 0.0}, "2026-09-01") is None


def test_regime_history_cpi_yoy_crosses_gap():
    q = RegimeHistoryQueryParams()
    data = {"gdp": [{"date": "2026-09-01", "value": "2.0"}], "cpi": CPI_OBS}
    row = FREDRegimeHistoryFetcher.transform_data(q, data).result[0]
    assert row.cpi_yoy == pytest.approx(round(TRUE_YOY_2026_09, 2))
    assert row.cpi_yoy != pytest.approx(round(WRONG_13M, 2))


def test_phillips_curve_inflation_crosses_gap():
    q = PhillipsCurveQueryParams()
    data = {"unemployment": [{"date": "2026-09-01", "value": "4.3"}], "cpi": CPI_OBS}
    row = FREDPhillipsCurveFetcher.transform_data(q, data)[0]
    assert row.inflation == pytest.approx(round(TRUE_YOY_2026_09, 1))   # 3.7 (전엔 4.0)
