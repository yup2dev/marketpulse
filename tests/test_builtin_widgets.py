"""기본 제공 위젯 — 기본값 파일(app/backend/builtin_widgets) ↔ DB 동기화."""
import json

import pytest

from app.backend.models.orm import UserWidget, UserWidgetSeed
from app.backend.services import builtin_widgets as bw
from app.backend.services import user_widget_service as uws


@pytest.fixture
def files(tmp_path, monkeypatch):
    """기본값 파일을 임시 폴더로 — 테스트가 고쳐도 저장소 파일은 그대로."""
    bw.write_specs(bw.load_specs(), tmp_path)
    monkeypatch.setattr(bw, "WIDGET_DIR", tmp_path)
    monkeypatch.setattr(uws, "_SKIPPED", set())
    return tmp_path


def _edit(directory, wid, **changes):
    spec = json.loads((directory / f"{wid}.json").read_text(encoding="utf-8"))
    spec.update(changes)
    bw.write_specs([spec], directory)
    return spec


def _spec(db, wid):
    db.expire_all()
    return bw.row_to_spec(db.get(UserWidget, wid))


@pytest.mark.parametrize("spec", bw.load_specs(), ids=lambda s: s["widget_id"])
def test_every_file_is_valid_and_round_trips(spec):
    uws._validate_spec(spec)
    assert bw.row_to_spec(bw.build_row(spec)) == spec
    # 파일은 내보내기 모양 그대로다 (손으로 고쳐도 export 하면 같은 글이 나온다)
    path = bw.WIDGET_DIR / f"{spec['widget_id']}.json"
    assert path.read_text(encoding="utf-8") == bw.dump(spec)


def test_file_ids_are_unique_and_ordered():
    specs = bw.load_specs()
    assert len({s["widget_id"] for s in specs}) == len(specs)
    assert len({s["sort_seq"] for s in specs}) == len(specs), "sort_seq 가 겹치면 메뉴 순서가 흔들려요"


def test_a_fresh_db_gets_every_file(files, db_session):
    changed = uws._sync_builtin(db_session)
    specs = bw.load_specs()
    assert sorted(changed) == sorted(s["widget_id"] for s in specs)
    assert db_session.query(UserWidgetSeed).count() == len(specs)
    for s in specs:
        assert _spec(db_session, s["widget_id"]) == s
    assert uws._sync_builtin(db_session) == []   # 두 번째는 할 일이 없다


def test_a_changed_file_reaches_an_untouched_row(files, db_session):
    uws._sync_builtin(db_session)
    new = _edit(files, "quant-ranking", title="새 제목", fields=[{"field_name": "rank", "field_role": "COLUMN", "format": "rank"}])
    assert uws._sync_builtin(db_session) == ["quant-ranking"]
    assert _spec(db_session, "quant-ranking") == new


def test_a_row_edited_in_the_db_is_left_alone_until_reset(files, db_session):
    uws._sync_builtin(db_session)
    db_session.query(UserWidget).filter_by(widget_id="mini-chart").update({"default_symbol": "AAPL"})
    db_session.commit()
    new = _edit(files, "mini-chart", title="파일에서 바꾼 제목")

    assert uws._sync_builtin(db_session) == []
    row = _spec(db_session, "mini-chart")
    assert row["default_symbol"] == "AAPL" and row.get("title") != "파일에서 바꾼 제목"
    assert uws._sync_builtin(db_session) == []   # 다시 봐도 그대로 (로그도 한 번만)

    assert uws._sync_builtin(db_session, force={"mini-chart"}) == ["mini-chart"]
    assert _spec(db_session, "mini-chart") == new


def test_rows_from_before_the_files_are_brought_in_line(files, db_session):
    """지문 기록이 없는 행(예전 시드 · 마이그레이션이 넣은 것)은 파일대로 맞춘다 — 기본 제공 행은 API 로 못 고친다."""
    uws._sync_builtin(db_session)
    db_session.query(UserWidget).filter_by(widget_id="quant-models").update({"description": "옛 설명"})
    db_session.query(UserWidgetSeed).delete()
    db_session.commit()

    assert uws._sync_builtin(db_session) == ["quant-models"]
    assert _spec(db_session, "quant-models")["description"] != "옛 설명"
    assert db_session.query(UserWidgetSeed).count() == len(bw.load_specs())


def test_deleted_rows_come_back_and_rows_without_a_file_stay(files, db_session):
    uws._sync_builtin(db_session)
    db_session.delete(db_session.get(UserWidget, "fear-greed"))
    db_session.add(UserWidget(widget_id="old-widget", user_id=None, name="옛 위젯", view_type="table", use_yn="N"))
    db_session.commit()

    assert uws._sync_builtin(db_session) == ["fear-greed"]
    assert db_session.get(UserWidget, "old-widget") is not None


def test_use_yn_n_hides_a_widget(files, auth_client):
    client, _ = auth_client
    _edit(files, "key-events", use_yn="N")
    widgets = {w["widget_id"] for w in client.get("/api/user-widgets/builtin").json()["widgets"]}
    assert "key-events" not in widgets and "mini-chart" in widgets


def test_a_bad_code_value_is_refused(files, db_session):
    _edit(files, "quant-ranking", transform="no_such_transform")
    with pytest.raises(uws.UserWidgetError):
        uws._sync_builtin(db_session)
