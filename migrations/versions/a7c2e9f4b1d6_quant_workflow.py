"""quant workflow — factor switches, step highlight, 4+8 first row

퀀트 화면(/quantlib)을 시안(캔버스 https://claude.ai/artifact/DFm1eYtd4yVjoiwX4Ejmrd · Quant)에 맞춘다.
  - 팩터 표(quant-factors): 켜고 끄기 스위치 열 · 비중 열(켠 팩터 동일 비중) 추가, 적중 열 빼기,
    꺼 둔 팩터는 화면 변수 quant_off 에 모인다 → 머리줄 '백테스트로 보내기'가 켠 팩터로 전략을 만든다
  - 네 위젯 모두 옵션 highlight(화면 변수 quant_step) — 머리줄 단계 ①②③ 을 누르면 그 단계 패널 테두리 강조
  - 첫 줄 배치 5+7 → 4+8 (팩터 · 팩터 성과)

기본 제공 위젯의 시드는 DB 에 없는 위젯만 넣으므로 이미 들어가 있는 행은 여기서 고친다.
시드 그대로인 행(옵션 shared 가 예전 값)만 바꾼다 — 운영자가 손본 행은 건드리지 않는다.

Revision ID: a7c2e9f4b1d6
Revises: e3f8b1c6d9a2
Create Date: 2026-11-23 00:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a7c2e9f4b1d6'
down_revision: Union[str, Sequence[str], None] = 'e3f8b1c6d9a2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

FACTORS = 'quant-factors'
RETURNS = 'quant-factor-returns'
STEP = {FACTORS: 'factor', RETURNS: 'factor', 'quant-models': 'ml', 'quant-signals': 'fusion'}

OLD_NOTE = '{members}종목 · 기준 {asOf}'
NEW_NOTE = '{used} · 동일 비중 · {members}종목'

# (field_name, format, label, width, sub_field) — 시드의 quant-factors 와 같은 값
OLD_FIELDS = [
    ('name', 'text', '팩터', None, None),
    ('_ic', 'value', 'IC', 64, None),
    ('_icir', 'value_muted', 'ICIR', 56, None),
    ('_hit', 'value_muted', '적중', 52, None),
    ('ls_ann', 'change', '연 롱숏', 76, None),
    ('_kind', 'badge', '', 52, '_tone'),
]
NEW_FIELDS = [
    ('_toggle', 'switch', '', 44, 'quant_off'),
    ('name', 'text', '팩터', None, None),
    ('_w', 'value_muted', '비중', 48, None),
    ('_ic', 'value', 'IC', 60, None),
    ('_icir', 'value_muted', 'ICIR', 52, None),
    ('ls_ann', 'change', '연 롱숏', 72, None),
    ('_kind', 'badge', '', 52, '_tone'),
]

# (widget, 예전 x, w) → (새 x, w) — /quantlib · factors 첫 줄
OLD_POS = {FACTORS: (0, 5), RETURNS: (5, 7)}
NEW_POS = {FACTORS: (0, 4), RETURNS: (4, 8)}


def _ex(sql: str, **p):
    return op.get_bind().execute(sa.text(sql), p)


def _option(widget: str, name: str):
    return _ex("SELECT opt_value FROM user_widget_options WHERE widget_id = :w AND opt_name = :n",
               w=widget, n=name).scalar()


def _set_option(widget: str, name: str, value) -> None:
    _ex("DELETE FROM user_widget_options WHERE widget_id = :w AND opt_name = :n", w=widget, n=name)
    if value is not None:
        _ex("INSERT INTO user_widget_options (widget_id, opt_name, opt_value) VALUES (:w, :n, :v)", w=widget, n=name, v=value)


def _builtin(widget: str) -> bool:
    return _ex("SELECT 1 FROM user_widgets WHERE widget_id = :w AND user_id IS NULL", w=widget).first() is not None


def _fields(widget: str, fields) -> None:
    _ex("DELETE FROM user_widget_fields WHERE widget_id = :w", w=widget)
    for seq, (name, fmt, label, width, sub) in enumerate(fields):
        _ex("INSERT INTO user_widget_fields (widget_id, field_seq, field_name, field_role, label, format, width, sub_field) "
            "VALUES (:w, :s, :n, 'COLUMN', :l, :f, :wd, :sub)", w=widget, s=seq, n=name, l=label, f=fmt, wd=width, sub=sub)


def _move(widget: str, old, new) -> None:
    _ex("UPDATE user_widget_screens SET pos_x = :nx, pos_w = :nw WHERE widget_id = :w AND screen = '/quantlib' "
        "AND tab = 'factors' AND pos_x = :ox AND pos_w = :ow", w=widget, nx=new[0], nw=new[1], ox=old[0], ow=old[1])
    _ex("UPDATE user_widgets SET size_w = :nw WHERE widget_id = :w AND user_id IS NULL AND size_w = :ow",
        w=widget, nw=new[1], ow=old[1])


def upgrade() -> None:
    for w, step in STEP.items():
        if _builtin(w) and _option(w, 'highlight') is None:
            _set_option(w, 'highlight', f'quant_step:{step}')

    if _builtin(FACTORS) and _option(FACTORS, 'shared') == 'universe':
        _set_option(FACTORS, 'shared', 'universe,quant_off')
        _set_option(FACTORS, 'muteBy', '_off')
        _ex("UPDATE user_widget_options SET opt_value = '400' WHERE widget_id = :w AND opt_name = 'minWidth' AND opt_value = '420'",
            w=FACTORS)
        _ex("UPDATE user_widgets SET source_note = :new WHERE widget_id = :w AND user_id IS NULL AND source_note = :old",
            w=FACTORS, new=NEW_NOTE, old=OLD_NOTE)
        _fields(FACTORS, NEW_FIELDS)

    for w in (FACTORS, RETURNS):
        if _builtin(w):
            _move(w, OLD_POS[w], NEW_POS[w])


def downgrade() -> None:
    for w in (FACTORS, RETURNS):
        if _builtin(w):
            _move(w, NEW_POS[w], OLD_POS[w])

    if _builtin(FACTORS) and _option(FACTORS, 'shared') == 'universe,quant_off':
        _set_option(FACTORS, 'shared', 'universe')
        _set_option(FACTORS, 'muteBy', None)
        _ex("UPDATE user_widget_options SET opt_value = '420' WHERE widget_id = :w AND opt_name = 'minWidth' AND opt_value = '400'",
            w=FACTORS)
        _ex("UPDATE user_widgets SET source_note = :old WHERE widget_id = :w AND user_id IS NULL AND source_note = :new",
            w=FACTORS, new=NEW_NOTE, old=OLD_NOTE)
        _fields(FACTORS, OLD_FIELDS)

    for w, step in STEP.items():
        if _option(w, 'highlight') == f'quant_step:{step}':
            _set_option(w, 'highlight', None)
