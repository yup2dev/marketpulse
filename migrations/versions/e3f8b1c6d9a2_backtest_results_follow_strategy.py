"""backtest results follow the strategy picked in the web

백테스트 결과 위젯(bt-run-*)이 저장한 단일 종목 실행(/backtest/runs/{run}) 대신, 맨 위 설정 패널(bt-settings)이
고른 포트폴리오 전략의 실행(/api/strategies/result)을 화면 변수로 따른다.
  - endpoint · 빈 화면 문구 · shared(화면 변수) 교체, 'run' 컨트롤과 그 선택지 삭제
  - 설정 패널(높이 2)이 맨 위에 들어오므로 기본 배치를 2칸 내린다
  - 거래 표: 종목 열 추가, 라벨을 편입/편출 · 보유 개월로

기본 제공 위젯의 시드는 DB 에 없는 위젯만 넣으므로 이미 들어가 있는 행은 여기서 고친다.
시드 그대로인 행(endpoint 가 예전 값)만 바꾼다 — 운영자가 손본 행은 건드리지 않는다.

Revision ID: e3f8b1c6d9a2
Revises: d2e7a9b4c5f1
Create Date: 2026-11-19 00:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e3f8b1c6d9a2'
down_revision: Union[str, Sequence[str], None] = 'd2e7a9b4c5f1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

WIDGETS = ['bt-run-summary', 'bt-run-equity', 'bt-run-monthly', 'bt-run-trades', 'bt-run-rolling']
OLD_ENDPOINT = '/backtest/runs/{run}'
NEW_ENDPOINT = ('/strategies/result?strategy={strategy}&start={bt_start}&end={bt_end}'
                '&benchmark={bt_bench}&cost={bt_cost}&rev={bt_rev}')
OLD_EMPTY = '저장한 백테스트 실행이 없어요 — Strategy 에서 실행한 뒤 Save results 를 눌러 주세요'
NEW_EMPTY = '전략 계산 재료(월별 패널)가 아직 없어요 — 로컬에서 build_quant.py 를 실행한 뒤 동기화해 주세요'
NEW_SHARED = 'strategy,bt_start,bt_end,bt_bench,bt_cost,bt_rev'
OLD_RUN_OPTIONS = '/backtest/runs|run_id|name|keep'
OLD_SERIES = 'strategy:전략,benchmark:보유'
NEW_SERIES = 'strategy:전략,benchmark:벤치마크'
SHIFT = 2

# (field_name, format, label, width, sub_field) — 시드의 bt-run-trades 와 같은 값
OLD_FIELDS = [
    ('_entry', 'muted', '진입일', 96, None), ('entryPrice', 'number', '진입가', None, None),
    ('_exit', 'muted', '청산일', 96, None), ('exitPrice', 'number', '청산가', None, None),
    ('bars', 'number', '보유 봉', None, None), ('returnPct', 'change', '수익률', None, None),
    ('_state', 'badge', '상태', 72, '_tone'),
]
NEW_FIELDS = [
    ('symbol', 'text', '종목', 72, None),
    ('_entry', 'muted', '편입일', 96, None), ('entryPrice', 'number', '편입가', None, None),
    ('_exit', 'muted', '편출일', 96, None), ('exitPrice', 'number', '편출가', None, None),
    ('bars', 'number', '보유 개월', None, None), ('returnPct', 'change', '수익률', None, None),
    ('_state', 'badge', '상태', 72, '_tone'),
]


def _ex(sql: str, **p):
    return op.get_bind().execute(sa.text(sql), p)


def _seeded(widget: str, endpoint: str) -> bool:
    return _ex("SELECT 1 FROM user_widgets WHERE widget_id = :w AND user_id IS NULL AND endpoint = :e",
               w=widget, e=endpoint).first() is not None


def _set_option(widget: str, name: str, value) -> None:
    _ex("DELETE FROM user_widget_options WHERE widget_id = :w AND opt_name = :n", w=widget, n=name)
    if value is not None:
        _ex("INSERT INTO user_widget_options (widget_id, opt_name, opt_value) VALUES (:w, :n, :v)", w=widget, n=name, v=value)


def _fields(widget: str, fields) -> None:
    _ex("DELETE FROM user_widget_fields WHERE widget_id = :w", w=widget)
    for seq, (name, fmt, label, width, sub) in enumerate(fields):
        _ex("INSERT INTO user_widget_fields (widget_id, field_seq, field_name, field_role, label, format, width, sub_field) "
            "VALUES (:w, :s, :n, 'COLUMN', :l, :f, :wd, :sub)", w=widget, s=seq, n=name, l=label, f=fmt, wd=width, sub=sub)


def upgrade() -> None:
    for w in WIDGETS:
        if not _seeded(w, OLD_ENDPOINT):
            continue
        _ex("UPDATE user_widgets SET endpoint = :e WHERE widget_id = :w AND user_id IS NULL", w=w, e=NEW_ENDPOINT)
        _ex("UPDATE user_widgets SET empty_text = :new WHERE widget_id = :w AND empty_text = :old", w=w, new=NEW_EMPTY, old=OLD_EMPTY)
        run = _ex("SELECT param_seq FROM user_widget_params WHERE widget_id = :w AND param_name = 'run'", w=w).scalar()
        if run is not None:
            _ex("DELETE FROM user_widget_param_options WHERE widget_id = :w AND param_seq = :s", w=w, s=run)
            _ex("DELETE FROM user_widget_params WHERE widget_id = :w AND param_seq = :s", w=w, s=run)
        _set_option(w, 'optionsFrom.run', None)
        _set_option(w, 'shared', NEW_SHARED)
        _ex("UPDATE user_widget_options SET opt_value = :new WHERE widget_id = :w AND opt_name = 'series' AND opt_value = :old",
            w=w, new=NEW_SERIES, old=OLD_SERIES)
        _ex("UPDATE user_widget_screens SET pos_y = pos_y + :d WHERE widget_id = :w AND screen = '/backtest' "
            "AND tab = 'results' AND pos_y IS NOT NULL", w=w, d=SHIFT)
        if w == 'bt-run-trades':
            _fields(w, NEW_FIELDS)


def downgrade() -> None:
    for seq_w in WIDGETS:
        w = seq_w
        if not _seeded(w, NEW_ENDPOINT):
            continue
        _ex("UPDATE user_widgets SET endpoint = :e WHERE widget_id = :w AND user_id IS NULL", w=w, e=OLD_ENDPOINT)
        _ex("UPDATE user_widgets SET empty_text = :old WHERE widget_id = :w AND empty_text = :new", w=w, new=NEW_EMPTY, old=OLD_EMPTY)
        # 'run' 컨트롤을 맨 앞(param_seq 0)에 되돌린다 — 다른 컨트롤은 한 칸씩 뒤로
        seqs = [r[0] for r in _ex("SELECT param_seq FROM user_widget_params WHERE widget_id = :w ORDER BY param_seq DESC", w=w)]
        for s in seqs:
            _ex("UPDATE user_widget_param_options SET param_seq = :n WHERE widget_id = :w AND param_seq = :s", w=w, s=s, n=s + 1)
            _ex("UPDATE user_widget_params SET param_seq = :n WHERE widget_id = :w AND param_seq = :s", w=w, s=s, n=s + 1)
        _ex("INSERT INTO user_widget_params (widget_id, param_seq, param_name, bind_type, param_value, label) "
            "VALUES (:w, 0, 'run', 'INPUT', 'latest', '실행')", w=w)
        _ex("INSERT INTO user_widget_param_options (widget_id, param_seq, option_seq, option_value, label) "
            "VALUES (:w, 0, 0, 'latest', '최근 실행')", w=w)
        _set_option(w, 'optionsFrom.run', OLD_RUN_OPTIONS)
        _set_option(w, 'shared', 'run')
        _ex("UPDATE user_widget_options SET opt_value = :old WHERE widget_id = :w AND opt_name = 'series' AND opt_value = :new",
            w=w, new=NEW_SERIES, old=OLD_SERIES)
        _ex("UPDATE user_widget_screens SET pos_y = pos_y - :d WHERE widget_id = :w AND screen = '/backtest' "
            "AND tab = 'results' AND pos_y IS NOT NULL", w=w, d=SHIFT)
        if w == 'bt-run-trades':
            _fields(w, OLD_FIELDS)
