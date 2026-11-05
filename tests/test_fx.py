"""환율: 배치 행 생성 · 서버 환율 조회/환산 · /api/fx/rate · 포트폴리오 summary 환산."""
from datetime import date
from decimal import Decimal

import pytest

from app.backend.services.fx_service import FXRateNotFound, convert_fields, get_rate
from index_analyzer.collectors.market.fx_rate import FXRateCollector
from app.backend.models.orm import MBS_IN_FX_STBD, Holding, Portfolio


def _add_rate(db, ymd, rate, chg=None, fx_cd="USDKRW"):
    db.add(MBS_IN_FX_STBD(
        fx_cd=fx_cd, base_curr=fx_cd[:3], quote_curr=fx_cd[3:],
        rate=Decimal(str(rate)), change_rate=chg, base_ymd=ymd,
    ))
    db.commit()


# ── 배치: 시세 → 적재 행 ─────────────────────────────────────────────────────

def test_build_rows_sorts_dedupes_and_computes_change():
    target = FXRateCollector().targets()[0]
    prices = [
        {"date": "2026-11-03", "close": 1340.0},
        {"date": "2026-10-31", "close": 1320.0},
        {"date": "2026-11-03T00:00:00", "close": 1353.2},   # 같은 날 중복 → 마지막 값
        {"date": "2026-11-01", "close": None},              # 결측 제외
    ]
    rows = FXRateCollector.build_rows(target, prices, "b1")
    assert [r["base_ymd"] for r in rows] == [date(2026, 10, 31), date(2026, 11, 3)]
    assert rows[0]["change_rate"] is None
    assert rows[1]["rate"] == 1353.2
    assert rows[1]["change_rate"] == pytest.approx(2.5152, abs=1e-4)
    assert rows[1]["fx_cd"] == "USDKRW" and rows[1]["quote_curr"] == "KRW"


# ── 서버: 환율 조회/환산 ─────────────────────────────────────────────────────

def test_get_rate_latest_and_as_of(db_session):
    _add_rate(db_session, date(2026, 11, 2), 1325.5)
    _add_rate(db_session, date(2026, 11, 3), 1340.0, 1.09)

    assert get_rate(db_session, "usd", "krw").rate == 1340.0
    past = get_rate(db_session, "USD", "KRW", on_or_before=date(2026, 11, 2))
    assert past.rate == 1325.5 and past.base_ymd == date(2026, 11, 2)


def test_get_rate_inverse_and_identity(db_session):
    _add_rate(db_session, date(2026, 11, 3), 1250.0, 25.0)
    inv = get_rate(db_session, "KRW", "USD")
    assert inv.inverted and inv.rate == pytest.approx(1 / 1250.0)
    assert inv.change_rate == pytest.approx(-20.0)   # 1/(1+0.25) - 1
    assert get_rate(db_session, "USD", "USD").rate == 1.0


def test_get_rate_missing_raises(db_session):
    with pytest.raises(FXRateNotFound):
        get_rate(db_session, "USD", "JPY")


def test_convert_fields_only_money(db_session):
    _add_rate(db_session, date(2026, 11, 3), 1300.0)
    fx = get_rate(db_session, "USD", "KRW")
    out = convert_fields({"total_cost": 10.0, "total_return_pct": 5.0, "x": None},
                         ("total_cost", "x"), fx)
    assert out == {"total_cost": 13000.0, "total_return_pct": 5.0, "x": None}


# ── API ──────────────────────────────────────────────────────────────────────

def test_fx_rate_endpoint(auth_client, db_session):
    client, _ = auth_client
    _add_rate(db_session, date(2026, 11, 3), 1340.0)

    res = client.get("/api/fx/rate?base=USD&quote=KRW")
    assert res.status_code == 200
    fx = res.json()["results"][0]
    assert fx["rate"] == 1340.0 and fx["as_of"] == "2026-11-03"

    assert client.get("/api/fx/rate?base=USD&quote=JPY").status_code == 404


def test_portfolio_summary_converted_on_server(auth_client, db_session):
    client, user_id = auth_client
    _add_rate(db_session, date(2026, 11, 3), 1300.0)
    db_session.add(Portfolio(portfolio_id="p1", user_id=user_id, name="t", currency="USD"))
    db_session.add(Holding(
        holding_id="h1", portfolio_id="p1", ticker_cd="AAPL",
        quantity=Decimal("2"), avg_cost=Decimal("100"),
        total_cost=Decimal("200"), market_value=Decimal("300"),
    ))
    db_session.commit()

    usd = client.get("/api/user-portfolio/portfolios/p1/summary").json()
    assert usd["currency"] == "USD" and "fx" not in usd

    krw = client.get("/api/user-portfolio/portfolios/p1/summary?currency=KRW").json()
    assert krw["currency"] == "KRW" and krw["base_currency"] == "USD"
    assert krw["total_cost"] == 260000.0
    assert krw["total_market_value"] == 390000.0
    assert krw["total_unrealized_pnl"] == 130000.0
    assert krw["total_return_pct"] == usd["total_return_pct"]
    assert krw["fx"]["rate"] == 1300.0
