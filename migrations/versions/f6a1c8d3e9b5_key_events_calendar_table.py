"""key events as a calendar table

홈의 '주요 일정' 위젯을 한 줄 목록에서 경제 캘린더 표(시간 · 국가 · 지표 · 실제 · 예상 · 이전)로 바꾼다.
6열이 3칸 폭에 들어가지 않아 홈 첫 줄의 기본 배치도 지수 9 + 일정 3 → 지수 8 + 일정 4 로 옮긴다.

기본 제공 위젯의 시드(services/builtin_widget_seed.py)는 DB 에 없는 위젯만 넣으므로,
이미 들어가 있는 행은 여기서 고친다. 시드 그대로인 행만 바꾼다 — 운영자가 손본 행은 건드리지 않는다
(주요 일정이 아직 목록(view_type='list')일 때, 배치가 처음 값 그대로일 때만).
새 DB 는 시드가 처음부터 표로 넣으므로 이 마이그레이션은 아무것도 하지 않는다.

Revision ID: f6a1c8d3e9b5
Revises: e5f9a3c7b2d4
Create Date: 2026-11-14 00:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f6a1c8d3e9b5'
down_revision: Union[str, Sequence[str], None] = 'e5f9a3c7b2d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

EVENTS = 'key-events'
TILES = 'index-tiles'

# (field_name, field_role, label, format, width) — 시드의 KEY_EVENT_FIELDS 와 같은 값
TABLE_FIELDS = [
    ('time', 'COLUMN', '시간', 'muted', 62),
    ('_cc', 'COLUMN', '국가', 'muted', 38),
    ('event', 'COLUMN', '지표', 'text', None),
    ('actual', 'COLUMN', '실제', 'value', 60),
    ('consensus', 'COLUMN', '예상', 'value_muted', 60),
    ('previous', 'COLUMN', '이전', 'value_muted', 68),
]
TABLE_OPTIONS = {'rowHeight': '28', 'fixed': 'true', 'minWidth': '0'}

LIST_FIELDS = [
    ('time', 'TIME', None, 'text', None),
    ('event', 'TITLE', None, 'text', None),
    ('country', 'SUB', None, 'text', None),
    ('_value', 'VALUE', None, 'text', None),
    ('_muted', 'VALUE_MUTED', None, 'text', None),
    ('_dot', 'DOT', None, 'text', None),
]
LIST_OPTIONS = {'rowHeight': '30', 'consensusLabel': '예상'}


def _view_type(bind):
    return bind.execute(
        sa.text("SELECT view_type FROM user_widgets WHERE widget_id = :w AND user_id IS NULL"), {'w': EVENTS},
    ).scalar()


def _replace_rows(bind, fields, options):
    bind.execute(sa.text("DELETE FROM user_widget_fields WHERE widget_id = :w"), {'w': EVENTS})
    for seq, (name, role, label, fmt, width) in enumerate(fields):
        bind.execute(
            sa.text(
                "INSERT INTO user_widget_fields (widget_id, field_seq, field_name, field_role, label, format, width) "
                "VALUES (:w, :seq, :name, :role, :label, :fmt, :width)"
            ),
            {'w': EVENTS, 'seq': seq, 'name': name, 'role': role, 'label': label, 'fmt': fmt, 'width': width},
        )
    bind.execute(sa.text("DELETE FROM user_widget_options WHERE widget_id = :w"), {'w': EVENTS})
    for name, value in options.items():
        bind.execute(
            sa.text("INSERT INTO user_widget_options (widget_id, opt_name, opt_value) VALUES (:w, :n, :v)"),
            {'w': EVENTS, 'n': name, 'v': value},
        )


def _move(bind, widget, old, new):
    """홈 기본 배치 (x, w) 와 위젯 기본 폭 — 처음 값(old) 그대로일 때만 new 로."""
    (old_x, old_w), (new_x, new_w) = old, new
    bind.execute(
        sa.text(
            "UPDATE user_widget_screens SET pos_x = :nx, pos_w = :nw "
            "WHERE widget_id = :w AND screen = '/' AND pos_x = :ox AND pos_w = :ow"
        ),
        {'w': widget, 'nx': new_x, 'nw': new_w, 'ox': old_x, 'ow': old_w},
    )
    bind.execute(
        sa.text("UPDATE user_widgets SET size_w = :nw WHERE widget_id = :w AND user_id IS NULL AND size_w = :ow"),
        {'w': widget, 'nw': new_w, 'ow': old_w},
    )


def upgrade() -> None:
    bind = op.get_bind()
    if _view_type(bind) != 'list':
        return   # 위젯이 아직 없거나(새 DB — 시드가 표로 넣는다) 이미 바뀌었다
    bind.execute(
        sa.text("UPDATE user_widgets SET view_type = 'table' WHERE widget_id = :w AND user_id IS NULL"), {'w': EVENTS},
    )
    _replace_rows(bind, TABLE_FIELDS, TABLE_OPTIONS)
    _move(bind, EVENTS, (9, 3), (8, 4))
    _move(bind, TILES, (0, 9), (0, 8))


def downgrade() -> None:
    bind = op.get_bind()
    if _view_type(bind) != 'table':
        return
    bind.execute(
        sa.text("UPDATE user_widgets SET view_type = 'list' WHERE widget_id = :w AND user_id IS NULL"), {'w': EVENTS},
    )
    _replace_rows(bind, LIST_FIELDS, LIST_OPTIONS)
    _move(bind, EVENTS, (8, 4), (9, 3))
    _move(bind, TILES, (0, 8), (0, 9))
