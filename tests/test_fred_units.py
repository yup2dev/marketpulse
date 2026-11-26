"""fred 파생 칸 — 직접 계산하지 않고 FRED units(pch · pc1 · chg · ch1) · FRED 이동평균 시리즈로 받는다.

FREDGenericSeriesFetcher.fetch_data 를 바꿔 어떤 units 를 요청하는지, 받은 값이 어느 칸에 붙는지 본다.
"""
import asyncio
from types import SimpleNamespace

import pytest

from data_fetcher.providers.api.fred.models import (
    cpi, employment, gdp, initial_claims, interest_rate, pmi, retail_sales,
)
from data_fetcher.providers.api.fred.models.generic_series import FREDGenericSeriesFetcher
from data_fetcher.providers.api.fred.utils.units import attach_units, with_units


def _row(d, v, sid="X"):
    return SimpleNamespace(date=d, value=v, series_id=sid,
                           model_dump=lambda d=d, v=v, sid=sid: {"date": d, "value": v, "series_id": sid})


@pytest.fixture
def fake_series(monkeypatch):
    """units(또는 series_id)별로 값을 돌려주는 가짜 generic series — 받은 요청을 기록한다."""
    calls, table = [], {}

    async def fetch(params, credentials=None, **kwargs):
        calls.append(dict(params))
        key = params.get("units") or params["series_id"]
        out = table.get(key, table.get(None, []))
        if isinstance(out, BaseException):
            raise out
        return out

    monkeypatch.setattr(FREDGenericSeriesFetcher, "fetch_data", fetch)
    return SimpleNamespace(calls=calls, table=table)


def _fetch(fetcher, params=None):
    return asyncio.run(fetcher.fetch_data(params or {}, {"api_key": "x"}))


def test_with_units_and_attach():
    base = {"series_id": "CPIAUCSL", "limit": 400}
    assert with_units(base, {"a": "pch", "b": "pc1"}) == [
        base, {**base, "units": "pch"}, {**base, "units": "pc1"}]

    rows = attach_units([[_row("2026-01-01", 300.0)], [_row("2026-01-01", 0.3)], RuntimeError("x")],
                        {"change_month": "pch", "change_year": "pc1"})
    assert rows == [{"date": "2026-01-01", "value": 300.0, "series_id": "X",
                     "change_month": 0.3, "change_year": None}]          # units 실패는 그 칸만 비운다
    with pytest.raises(RuntimeError):
        attach_units([RuntimeError("base"), []], {"a": "pch"})          # 원 시리즈 실패는 올린다


def test_cpi_uses_pch_pc1(fake_series):
    fake_series.table.update({
        None: [_row("2026-02-01", 310.0), _row("2026-01-01", 300.0)],        # desc 로 온다
        "pch": [_row("2026-02-01", 3.33), _row("2026-01-01", 0.5)],
        "pc1": [_row("2026-02-01", 2.9)],
    })
    rows = _fetch(cpi.FREDCPIFetcher)
    assert sorted(c.get("units") or "lin" for c in fake_series.calls) == ["lin", "pc1", "pch"]
    assert [(str(r.date), r.change_month, r.change_year) for r in rows] == [
        ("2026-01-01", 0.5, None), ("2026-02-01", 3.33, 2.9)]


def test_order_bug_fixed_values_come_from_fred(fake_series):
    """예전엔 desc 로 받은 그대로 돌며 '직전'을 다음 날짜와 비교했다 — 이제 값은 FRED 가 준다."""
    fake_series.table.update({
        None: [_row("2026-03-01", 4.5), _row("2026-02-01", 4.25)],
        "chg": [_row("2026-03-01", 0.25), _row("2026-02-01", 0.0)],
    })
    rows = _fetch(interest_rate.FREDInterestRateFetcher, {"rate_type": "federal_funds"})
    assert [(str(r.date), r.change_day) for r in rows] == [("2026-02-01", 0.0), ("2026-03-01", 25.0)]  # %p → bp
    assert not hasattr(rows[0], "change_week")


def test_employment_units(fake_series):
    fake_series.table.update({
        None: [_row("2026-02-01", 160000.0)],
        "chg": [_row("2026-02-01", 150.4)], "pch": [_row("2026-02-01", 0.09)], "ch1": [_row("2026-02-01", 1800.0)],
    })
    [r] = _fetch(employment.FREDEmploymentFetcher, {"employment_type": "nonfarm_payroll"})
    assert (r.change_month, r.change_month_percent, r.change_year) == (150, 0.09, 1800)


def test_gdp_and_retail_pch(fake_series):
    fake_series.table.update({None: [_row("2026-04-01", 2.1)], "pch": [_row("2026-04-01", 5.0)]})
    assert _fetch(gdp.FREDGDPFetcher)[0].growth_rate == 5.0
    assert _fetch(retail_sales.FREDRetailSalesFetcher)[0].month_over_month_change == 5.0
    assert {c.get("units") for c in fake_series.calls} == {None, "pch"}


def test_moving_averages_are_fred_series(fake_series):
    fake_series.table.update({
        "ICSA": [_row("2026-11-07", 220000.0), _row("2026-11-14", 230000.0)],
        "IC4WSA": [_row("2026-11-14", 225500.0)],
        "CFNAI": [_row("2026-09-01", 0.1)], "CFNAIMA3": [_row("2026-09-01", -0.05)],
    })
    claims = _fetch(initial_claims.FREDInitialClaimsFetcher)
    assert [(r.claims, r.ma_4w) for r in claims] == [(220.0, None), (230.0, 225.5)]

    [p] = _fetch(pmi.FREDPMIFetcher)
    assert (p.cfnai, p.cfnai_ma3) == (0.1, -0.05)
    assert {"IC4WSA", "CFNAIMA3"} <= {c["series_id"] for c in fake_series.calls}
