"""quant portfolio strategies managed in the web

- mbs_in_quant_panel: 월별 패널(월말 × 종목 — 종가 · 다음 달 수익률 · 팩터 z · 표본 밖 ML 확률).
  로컬 배치(build_quant.py)가 적재하고 sync 로 서버에 온다. 서버는 이걸로 웹의 전략을 학습 없이 바로 백테스트한다.
- user_quant_strategies (+ _factors): 사용자가 웹에서 만든 포트폴리오 전략. user_id NULL = 기본 제공
  (서비스가 처음 읽을 때 넣는다 — services/quant_strategy_service.py BUILTIN_STRATEGIES).

Revision ID: d2e7a9b4c5f1
Revises: c1d6f4a8b3e9
Create Date: 2026-11-19 00:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd2e7a9b4c5f1'
down_revision: Union[str, Sequence[str], None] = 'c1d6f4a8b3e9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

FACTOR_COLS = ['mom_12_1', 'mom_6_1', 'rev_1m', 'lowvol', 'high52', 'trend']
PROB_COLS = ['p_gbt', 'p_mlp', 'p_logit', 'p_avg', 'p_stack']


def _has(table: str) -> bool:
    return table in sa.inspect(op.get_bind()).get_table_names()


def upgrade() -> None:
    # create_all(앱 기동)이 먼저 만들었을 수 있다 — 있으면 건너뛴다
    if not _has('mbs_in_quant_panel'):
        op.create_table(
            'mbs_in_quant_panel',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('universe', sa.String(length=30), nullable=False),
            sa.Column('base_ymd', sa.Date(), nullable=False),
            sa.Column('stk_cd', sa.String(length=20), nullable=False),
            sa.Column('close', sa.Float()),
            sa.Column('fwd_ret', sa.Float()),
            *[sa.Column(c, sa.Float()) for c in FACTOR_COLS + PROB_COLS],
            sa.Column('created_at', sa.DateTime()),
            sa.Column('updated_at', sa.DateTime()),
            sa.UniqueConstraint('universe', 'base_ymd', 'stk_cd', name='uq_quant_panel'),
        )
        op.create_index('ix_quant_panel_universe_ymd', 'mbs_in_quant_panel', ['universe', 'base_ymd'])

    if not _has('user_quant_strategies'):
        op.create_table(
            'user_quant_strategies',
            sa.Column('strategy_id', sa.String(length=50), primary_key=True),
            sa.Column('user_id', sa.String(length=50), sa.ForeignKey('users.user_id'), nullable=True),
            sa.Column('name', sa.String(length=100), nullable=False),
            sa.Column('description', sa.String(length=300)),
            sa.Column('universe', sa.String(length=30), nullable=False, server_default='sp500'),
            sa.Column('score_kind', sa.String(length=10), nullable=False, server_default='factor'),
            sa.Column('model', sa.String(length=20)),
            sa.Column('top_n', sa.Integer(), nullable=False, server_default='30'),
            sa.Column('rebalance', sa.String(length=1), nullable=False, server_default='M'),
            sa.Column('sort_seq', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('use_yn', sa.String(length=1), nullable=False, server_default='Y'),
            sa.Column('created_at', sa.DateTime()),
            sa.Column('updated_at', sa.DateTime()),
        )
        op.create_index('ix_user_quant_strategies_user_id', 'user_quant_strategies', ['user_id'])

    if not _has('user_quant_strategy_factors'):
        op.create_table(
            'user_quant_strategy_factors',
            sa.Column('strategy_id', sa.String(length=50),
                      sa.ForeignKey('user_quant_strategies.strategy_id', ondelete='CASCADE'), primary_key=True),
            sa.Column('factor_id', sa.String(length=20), primary_key=True),
            sa.Column('weight', sa.Float(), nullable=False, server_default='1'),
        )


def downgrade() -> None:
    op.drop_table('user_quant_strategy_factors')
    op.drop_index('ix_user_quant_strategies_user_id', table_name='user_quant_strategies')
    op.drop_table('user_quant_strategies')
    op.drop_index('ix_quant_panel_universe_ymd', table_name='mbs_in_quant_panel')
    op.drop_table('mbs_in_quant_panel')
