"""13F 기준 분기 선택 — 배치 분기 이력 적재 → 서버 DB 조회 → ingest upsert."""
from datetime import date

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import data_fetcher.providers_init  # noqa: F401
from data_fetcher.abstract_provider.standard_models.institutional_holdings import (
    InstitutionalHoldingsQueryParams,
)
from data_fetcher.providers.database import schema as fs
from data_fetcher.providers.database.models.institutional_holdings import DBInstitutionalHoldingsFetcher


def _fetcher_db(tmp_path):
    path = tmp_path / "f.db"
    engine = create_engine(f"sqlite:///{path}")
    fs.Base.metadata.create_all(engine)
    s = sessionmaker(bind=engine)()
    s.add(fs.MBS_IN_INSTI_PORT(institution_key="berkshire", name="Berkshire", total_value=300.0, period_end="2026-08-14"))
    s.add(fs.MBS_IN_INSTI_HOLD(institution_key="berkshire", is_sold=False, seq=0, symbol="AAPL", value=300.0))
    for period, sym, val in (("2026-03-31", "AAPL", 250.0), ("2025-12-31", "BAC", 200.0)):
        s.add(fs.MBS_IN_INSTI_PORT_HIST(institution_key="berkshire", period=period, total_value=val, base_ymd=date.today()))
        s.add(fs.MBS_IN_INSTI_HOLD_HIST(institution_key="berkshire", period=period, is_sold=False, seq=0, symbol=sym, value=val))
    s.commit()
    s.close()
    engine.dispose()
    return str(path)


def _fetch(db_path, **params):
    q = InstitutionalHoldingsQueryParams(institution_key="berkshire", **params)
    raw = DBInstitutionalHoldingsFetcher.extract_data(q, db_path=db_path)
    return DBInstitutionalHoldingsFetcher.transform_data(q, raw)


def test_latest_lists_available_quarters_newest_first(tmp_path):
    [p] = _fetch(_fetcher_db(tmp_path))
    assert p.total_value == 300.0 and [s.symbol for s in p.stocks] == ["AAPL"]
    assert p.available_periods == ["2026-03-31", "2025-12-31"]


def test_period_reads_history_tables(tmp_path):
    [p] = _fetch(_fetcher_db(tmp_path), period="2025-12-31")
    assert p.total_value == 200.0 and p.period_end == "2025-12-31"
    assert [s.symbol for s in p.stocks] == ["BAC"]


def test_unloaded_period_is_empty(tmp_path):
    assert _fetch(_fetcher_db(tmp_path), period="2020-03-31") == []


def test_whalewisdom_finds_filing_and_previous_by_report_period(monkeypatch):
    from data_fetcher.providers.sec.models.fund_performance import SECFundPerformanceFetcher
    from data_fetcher.providers.whalewisdom.models import institutional_holdings as ww

    filings = [
        {"accession": "0001-26-000003", "filing_date": "2026-05-15", "period": "2026-03-31"},
        {"accession": "0001-26-000002", "filing_date": "2026-02-14", "period": "2025-12-31"},
        {"accession": "0001-25-000001", "filing_date": "2025-11-14", "period": "2025-09-30"},
    ]
    monkeypatch.setattr(SECFundPerformanceFetcher, "_list_13f_filings", staticmethod(lambda cik, limit: filings))
    out = ww.filings_for_period("1067983", "2025-12-31")
    assert [d for _, d in out] == ["2026-02-14", "2025-11-14"]       # 그 분기 + 직전 분기
    assert out[0][0].endswith("/1067983/000126000002/0001-26-000002-index.htm")
    assert ww.filings_for_period("1067983", "2019-12-31") == []


def test_batch_history_parses_only_missing_quarters(monkeypatch):
    from data_fetcher.providers.sec.models.fund_performance import SECFundPerformanceFetcher
    from data_fetcher.providers.sec.models.institutional_13f import SEC13FFetcher
    from index_analyzer.collectors.institutional import holdings_13f as h

    monkeypatch.setattr(h, "_rate_gate", lambda *a, **k: None)
    monkeypatch.setattr(SEC13FFetcher, "_resolve_institution", staticmethod(lambda k: {"cik": "1"}))
    monkeypatch.setattr(SECFundPerformanceFetcher, "_list_13f_filings", staticmethod(
        lambda cik, limit: [{"period": "2026-03-31"}, {"period": "2025-12-31"}]))
    monkeypatch.setattr(h, "stored_institution_periods", lambda k: {"2025-12-31"})
    asked, stored = [], []

    class _P:
        stocks = [object()]

    def fake_fetch(self, model, params, provider=""):
        asked.append(params.get("period"))
        return [_P()]

    monkeypatch.setattr(h.Institutional13FCollector, "_fetch_sync", fake_fetch)
    monkeypatch.setattr(h, "_serialize_portfolio", lambda p: {"stocks": []})
    monkeypatch.setattr(h, "store_institution_history", lambda k, period, port: stored.append(period))

    assert h.Institutional13FCollector()._store_history("berkshire") == 1
    assert asked == ["2026-03-31"] and stored == ["2026-03-31"]


def test_ingest_upserts_history_rows_without_updated_at(db_session):
    from app.backend.api.routes.ingest import _TABLES, _coerce_row, _upsert
    from app.backend.models.orm.ingest import MBS_IN_INSTI_HOLD_HIST

    cfg = _TABLES["mbs_in_insti_hold_hist"]
    row = {"institution_key": "berkshire", "period": "2025-12-31", "is_sold": 0, "seq": 0,
           "symbol": "BAC", "value": 1.0, "base_ymd": "2026-11-07"}
    for value in (1.0, 2.0):   # 같은 자연키 재전송 = 갱신
        _upsert(db_session, cfg["model"], cfg["conflict"], [_coerce_row(cfg["model"], {**row, "value": value})])
    db_session.commit()
    rows = db_session.query(MBS_IN_INSTI_HOLD_HIST).all()
    assert len(rows) == 1 and rows[0].value == 2.0
