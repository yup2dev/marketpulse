"""quant dashboard follows the picked strategy · quant portfolios

퀀트 화면(/quantlib)을 시안(QuantMain · QuantStrategy · QuantPortfolio)에 맞춘다.
  - 메인(대시보드) 위젯이 머리줄에서 고른 전략(화면 변수 strategy — /backtest 와 같은 변수)을 따른다:
    팩터 표 · 팩터 성과 · ML 모델의 endpoint 에 &strategy={strategy}, 옵션 shared 에 strategy.
    팩터 표 스위치는 읽기 전용(sub_field 없음 — 전략이 쓰는 팩터만 켜짐), 팩터 성과는 transform quant_returns.
  - 시그널 융합(quant-signals)은 메인 배치에서 빼고 숨긴다(use_yn=N) — 그 자리에 '이번 달 순위'(quant-ranking)가 온다
    (새 위젯은 시드가 넣는다 — DB 에 없는 기본 제공 위젯만 넣으므로 여기서는 옛 배치만 뺀다).
  - user_quant_portfolios (+ _items): 유니버스 안에서 직접 고른 종목 · 비중 · 리밸런싱 (전략과 무관).

시드 그대로인 행만 바꾼다 — 운영자가 손본 행은 건드리지 않는다.

Revision ID: b8d3f1a6c2e7
Revises: a7c2e9f4b1d6
Create Date: 2026-11-23 00:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b8d3f1a6c2e7'
down_revision: Union[str, Sequence[str], None] = 'a7c2e9f4b1d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

OLD_EP = '/quant/{d}?universe={universe}'
NEW_EP = '/quant/{d}?universe={universe}&strategy={strategy}'
# widget → (옛 shared, 새 shared, endpoint 를 바꿀 데이터셋들: 위젯 endpoint 또는 옵션 이름 → 데이터셋)
WIDGETS = {
    'quant-factors': ('universe,quant_off', {'': 'factors'}),
    'quant-factor-returns': ('universe', {'': 'factor_returns', 'tab.q.endpoint': 'quantiles'}),
    'quant-models': ('universe', {'': 'models'}),
}
NEW_SHARED = 'universe,strategy'
RETURNS_NOTE = ('상위 20% 롱 · 하위 20% 숏 · 최근 5년 · 비용 없음', '{strategy} · 상위 20% 롱 · 하위 20% 숏 · 최근 5년 · 비용 없음')
FACTORS_NOTE = ('{used} · 동일 비중 · {members}종목', '{used} · {members}종목')
SIGNALS_POS = ('quant-signals', '/quantlib', 'factors', 7, 7, 5, 6)


def _ex(sql: str, **p):
    return op.get_bind().execute(sa.text(sql), p)


def _has(table: str) -> bool:
    return table in sa.inspect(op.get_bind()).get_table_names()


def _option(widget: str, name: str):
    return _ex("SELECT opt_value FROM user_widget_options WHERE widget_id = :w AND opt_name = :n",
               w=widget, n=name).scalar()


def _set_option(widget: str, name: str, value) -> None:
    _ex("DELETE FROM user_widget_options WHERE widget_id = :w AND opt_name = :n", w=widget, n=name)
    if value is not None:
        _ex("INSERT INTO user_widget_options (widget_id, opt_name, opt_value) VALUES (:w, :n, :v)", w=widget, n=name, v=value)


def _builtin(widget: str) -> bool:
    return _ex("SELECT 1 FROM user_widgets WHERE widget_id = :w AND user_id IS NULL", w=widget).first() is not None


def _endpoints(widget: str, datasets: dict, old: str, new: str) -> None:
    for opt, d in datasets.items():
        a, b = old.replace('{d}', d), new.replace('{d}', d)
        if opt:
            if _option(widget, opt) == a:
                _set_option(widget, opt, b)
        else:
            _ex("UPDATE user_widgets SET endpoint = :b WHERE widget_id = :w AND user_id IS NULL AND endpoint = :a",
                w=widget, a=a, b=b)


def _note(widget: str, old: str, new: str) -> None:
    _ex("UPDATE user_widgets SET source_note = :new WHERE widget_id = :w AND user_id IS NULL AND source_note = :old",
        w=widget, old=old, new=new)


def _widgets(up: bool) -> None:
    for w, (old_shared, datasets) in WIDGETS.items():
        if not _builtin(w):
            continue
        before, after = (old_shared, NEW_SHARED) if up else (NEW_SHARED, old_shared)
        if _option(w, 'shared') != before:
            continue   # 운영자가 손본 행
        _set_option(w, 'shared', after)
        _endpoints(w, datasets, *((OLD_EP, NEW_EP) if up else (NEW_EP, OLD_EP)))

    f = 'quant-factors'
    if _builtin(f):
        sub_before, sub_after = ('quant_off', None) if up else (None, 'quant_off')
        cond = "sub_field = 'quant_off'" if up else "sub_field IS NULL"
        _ex(f"UPDATE user_widget_fields SET sub_field = :s WHERE widget_id = :w AND field_name = '_toggle' AND {cond}",
            w=f, s=sub_after)
        _note(f, *(FACTORS_NOTE if up else FACTORS_NOTE[::-1]))

    r = 'quant-factor-returns'
    if _builtin(r):
        a, b = ('quant_meta', 'quant_returns') if up else ('quant_returns', 'quant_meta')
        _ex("UPDATE user_widgets SET transform = :b WHERE widget_id = :w AND user_id IS NULL AND transform = :a", w=r, a=a, b=b)
        if _option(r, 'tab.q.transform') == a:
            _set_option(r, 'tab.q.transform', b)
        _note(r, *(RETURNS_NOTE if up else RETURNS_NOTE[::-1]))

    w, screen, tab, x, y, ww, h = SIGNALS_POS
    if _builtin(w):
        if up:
            _ex("DELETE FROM user_widget_screens WHERE widget_id = :w AND screen = :s AND tab = :t "
                "AND pos_x = :x AND pos_y = :y", w=w, s=screen, t=tab, x=x, y=y)
            _ex("UPDATE user_widgets SET use_yn = 'N' WHERE widget_id = :w AND user_id IS NULL", w=w)
        else:
            _ex("UPDATE user_widgets SET use_yn = 'Y' WHERE widget_id = :w AND user_id IS NULL", w=w)
            if not _ex("SELECT 1 FROM user_widget_screens WHERE widget_id = :w AND screen = :s", w=w, s=screen).first():
                _ex("INSERT INTO user_widget_screens (widget_id, screen, tab, pos_x, pos_y, pos_w, pos_h) "
                    "VALUES (:w, :s, :t, :x, :y, :ww, :h)", w=w, s=screen, t=tab, x=x, y=y, ww=ww, h=h)


def upgrade() -> None:
    # create_all(앱 기동)이 먼저 만들었을 수 있다 — 있으면 건너뛴다
    if not _has('user_quant_portfolios'):
        op.create_table(
            'user_quant_portfolios',
            sa.Column('portfolio_id', sa.String(length=50), primary_key=True),
            sa.Column('user_id', sa.String(length=50), sa.ForeignKey('users.user_id'), nullable=False),
            sa.Column('name', sa.String(length=100), nullable=False),
            sa.Column('universe', sa.String(length=30), nullable=False, server_default='sp500'),
            sa.Column('weighting', sa.String(length=10), nullable=False, server_default='equal'),
            sa.Column('cash_pct', sa.Float(), nullable=False, server_default='0'),
            sa.Column('rebalance', sa.String(length=1), nullable=False, server_default='Q'),
            sa.Column('cost_bps', sa.Float(), nullable=False, server_default='10'),
            sa.Column('created_at', sa.DateTime()),
            sa.Column('updated_at', sa.DateTime()),
        )
        op.create_index('ix_user_quant_portfolios_user_id', 'user_quant_portfolios', ['user_id'])
    if not _has('user_quant_portfolio_items'):
        op.create_table(
            'user_quant_portfolio_items',
            sa.Column('portfolio_id', sa.String(length=50),
                      sa.ForeignKey('user_quant_portfolios.portfolio_id', ondelete='CASCADE'), primary_key=True),
            sa.Column('stk_cd', sa.String(length=20), primary_key=True),
            sa.Column('seq', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('weight', sa.Float()),
        )
    if _has('user_widgets'):
        _widgets(up=True)


def downgrade() -> None:
    if _has('user_widgets'):
        _widgets(up=False)
        _ex("DELETE FROM user_widget_screens WHERE widget_id = 'quant-ranking'")
    op.drop_table('user_quant_portfolio_items')
    op.drop_table('user_quant_portfolios')
