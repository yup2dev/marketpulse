"""13F 분석(배치) — 비중 · 분기 대비 · 신규/매도 · 회전율, 분기 추정 수익률.

fetcher 에서 옮긴 계산이라 규칙이 그대로인지 본다. 실제 공시로는 Berkshire 로 옮기기 전후 결과가
같음을 확인했다 (분기 지정 포트폴리오 110종목 전 칸 · 추정 수익률 2분기).
"""
import pytest

from index_analyzer.collectors.institutional import analysis as a


def _h(cusip, value, shares, symbol="", share_type="SH", put_call=None, name=None):
    return {"cusip": cusip, "symbol": symbol, "name": name or cusip, "value": value, "shares": shares,
            "share_type": share_type, "put_call": put_call}


RAW = {
    "name": "Fund", "manager": "M", "report_period": "2026-09-30", "filing_date": "2026-11-14",
    "previous_filing_date": "2026-08-14",
    "holdings": [
        _h("AAA", 600.0, 60, "AAA"),      # 늘림 (50 → 60)
        _h("BBB", 300.0, 10, "BBB"),      # 줄임 (20 → 10)
        _h("NEW", 100.0, 5, "NEW"),       # 신규
        _h("BND", 999.0, 1, share_type="PRN"),   # 채권 — 보통주 아님
    ],
    "previous_holdings": [
        _h("AAA", 400.0, 50, "AAA"),
        _h("BBB", 500.0, 20, "BBB"),
        _h("OUT", 100.0, 4, "OUT"),       # 매도
    ],
}


def test_portfolio_weights_and_quarter_changes():
    p = a.portfolio(RAW, "fund")
    assert (p["total_value"], p["num_holdings"]) == (1000.0, 3)             # PRN 제외
    by = {s["symbol"]: s for s in p["stocks"]}
    assert [s["symbol"] for s in p["stocks"]] == ["AAA", "BBB", "NEW"]      # 가치 큰 순
    assert by["AAA"]["weight"] == 60.0 and by["AAA"]["status"] == "increased"
    assert by["AAA"]["share_change"] == 10 and by["AAA"]["share_change_pct"] == 20.0
    assert by["BBB"]["status"] == "decreased" and by["BBB"]["value_change_pct"] == -40.0
    assert by["NEW"]["status"] == "new" and by["NEW"]["prev_shares"] is None
    [sold] = p["sold_positions"]
    assert sold["symbol"] == "OUT" and sold["status"] == "sold" and sold["share_change_pct"] == -100.0
    assert (p["num_new_positions"], p["num_sold_out"], p["num_increased"], p["num_decreased"]) == (1, 1, 1, 1)
    assert p["previous_value"] == 1000.0 and p["value_change_pct"] == 0.0
    # 회전율 = Σ|주식 변화 × 이번 분기 주가| / 총가치 — AAA 10주 × 10 + BBB 10주 × 30 = 400
    assert p["turnover"] == 40.0
    assert p["period_end"] == "2026-09-30"


def test_portfolio_without_previous_quarter_has_no_status():
    p = a.portfolio({**RAW, "previous_holdings": []}, "fund")
    assert all(s["status"] is None for s in p["stocks"]) and p["sold_positions"] == []
    assert p["previous_value"] is None and p["value_change"] is None
    assert a.portfolio({**RAW, "holdings": []}, "fund") is None


def test_summary_change():
    s = a.summary({"name": "F", "summary": {"total_value": 110, "num_holdings": 3},
                   "previous_summary": {"total_value": 100}}, "fund")
    assert (s["total_value"], s["previous_value"], s["value_change"], s["value_change_pct"]) == (110, 100, 10, 10.0)
    assert a.summary({"summary": {"total_value": 5}}, "fund")["value_change_pct"] is None


def test_fund_performance_implied_price_returns():
    q1 = [_h("A", 100.0, 10), _h("B", 100.0, 10), _h("S", 50.0, 10)]
    q2 = [_h("A", 110.0, 10), _h("B", 90.0, 10), _h("S", 150.0, 10),     # S 주가 3배 → 분할 의심으로 제외
          _h("OPT", 50.0, 1, put_call="Put")]                              # 파생 — 산출 제외, 비중만
    rows = a.fund_performance([
        {"period": "2026-06-30", "filing_date": "2026-08-14", "holdings": q1},
        {"period": "2026-09-30", "filing_date": "2026-11-14", "holdings": q2},
    ], "fund", "F", "M")
    [r] = rows
    assert r["period"] == "2026-09-30" and r["return_pct"] == pytest.approx(0.0)   # +10% · -10% 같은 비중
    assert (r["matched_positions"], r["excluded_positions"]) == (2, 1)
    assert r["coverage_pct"] == 80.0                                         # 200 / 250
    assert r["derivative_weight_pct"] == pytest.approx(50 / 400 * 100, abs=0.1)
    assert r["top_contributor"] == "A" and r["top_detractor"] == "B"
    assert a.fund_performance(rows[:1], "fund", "F", "M") == []


def test_split_holdings_merges_same_cusip_lines():
    eq, total, deriv = a.split_holdings([_h("A", 10.0, 1), _h("A", 30.0, 3), _h("C", 5.0, 1, put_call="Call")])
    assert eq["A"]["value"] == 40.0 and eq["A"]["shares"] == 4.0 and total == 40.0 and deriv == 5.0
