"""13F 전 기관 요약 일괄 조회 — 보유종목을 읽지 않고 PORT/PORT_HIST 요약만 반환."""
from datetime import date

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import data_fetcher.providers_init  # noqa: F401
from data_fetcher.abstract_provider.standard_models.institutional_holdings import (
    InstitutionalHoldingsQueryParams,
    InstitutionsSummaryQueryParams,
)
from data_fetcher.providers.database import schema as fs
from data_fetcher.providers.database.models.institutional_holdings import DBInstitutionalHoldingsFetcher
from data_fetcher.providers.database.models.institutions_summary import DBInstitutionsSummaryFetcher
from data_fetcher.utils.registry import FetcherRegistry


def _db(tmp_path):
    path = tmp_path / "f.db"
    engine = create_engine(f"sqlite:///{path}")
    fs.Base.metadata.create_all(engine)
    s = sessionmaker(bind=engine)()
    for key, active in (("berkshire", True), ("bridgewater", True), ("closed", False)):
        s.add(fs.MBS_IN_INSTI_MST(institution_key=key, name=key.title(), is_active=active))
        s.add(fs.MBS_IN_INSTI_PORT(institution_key=key, name=key.title(), total_value=100.0, num_holdings=1))
        s.add(fs.MBS_IN_INSTI_HOLD(institution_key=key, is_sold=False, seq=0, symbol="AAPL", value=100.0))
    for period, val in (("2026-03-31", 90.0), ("2025-12-31", 80.0)):
        s.add(fs.MBS_IN_INSTI_PORT_HIST(institution_key="berkshire", period=period, total_value=val, base_ymd=date.today()))
    s.commit()
    s.close()
    engine.dispose()
    return str(path)


def _summaries(db_path, **params):
    q = InstitutionsSummaryQueryParams(**params)
    return DBInstitutionsSummaryFetcher.transform_data(q, DBInstitutionsSummaryFetcher.extract_data(q, db_path=db_path))


def test_latest_returns_all_active_without_holdings(tmp_path):
    rows = {r.institution_key: r for r in _summaries(_db(tmp_path))}
    assert set(rows) == {"berkshire", "bridgewater"}  # 비활성 기관 제외 (institutions_list 와 동일 기준)
    b = rows["berkshire"]
    assert b.total_value == 100.0 and b.num_holdings == 1
    assert b.stocks == [] and b.sold_positions == []
    assert b.available_periods == ["2026-03-31", "2025-12-31"]
    assert rows["bridgewater"].available_periods == []


def test_period_reads_history_only_for_institutions_with_that_quarter(tmp_path):
    rows = _summaries(_db(tmp_path), period="2025-12-31")
    assert [(r.institution_key, r.total_value, r.period_end) for r in rows] == [("berkshire", 80.0, "2025-12-31")]


def test_summary_only_detail_skips_holdings(tmp_path):
    q = InstitutionalHoldingsQueryParams(institution_key="berkshire", summary_only=True)
    [p] = DBInstitutionalHoldingsFetcher.transform_data(q, DBInstitutionalHoldingsFetcher.extract_data(q, db_path=_db(tmp_path)))
    assert p.total_value == 100.0 and p.stocks == []


def test_registered_on_db_provider():
    assert "db" in FetcherRegistry.list_providers("institutions_summary")
