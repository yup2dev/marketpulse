"""add mbs_in_stk_period_rtn · mbs_in_sector_perf (배치가 미리 계산한 기간별 수익률 · 섹터 성과)

서버(512MB)가 조회 때마다 종가를 모아 수익률을 계산하거나 섹터를 집계하지 않도록,
로컬 배치(build_market_stats)가 계산해 /api/ingest 로 올린다. 서버는 읽고 정렬만 한다.

Revision ID: c4a9e2f7b1d8
Revises: b8d4e1f6a2c9
Create Date: 2026-11-25 00:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c4a9e2f7b1d8'
down_revision: Union[str, Sequence[str], None] = 'b8d4e1f6a2c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'mbs_in_stk_period_rtn',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('stk_cd', sa.String(length=20), nullable=False),
        sa.Column('period', sa.String(length=10), nullable=False),
        sa.Column('stk_nm', sa.String(length=100), nullable=True),
        sa.Column('sector', sa.String(length=100), nullable=True),
        sa.Column('curr', sa.String(length=10), nullable=True),
        sa.Column('base_ymd', sa.Date(), nullable=False),
        sa.Column('close_price', sa.DECIMAL(precision=20, scale=4), nullable=True),
        sa.Column('ref_ymd', sa.Date(), nullable=True),
        sa.Column('ref_close', sa.DECIMAL(precision=20, scale=4), nullable=True),
        sa.Column('change_rate', sa.DECIMAL(precision=12, scale=4), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('stk_cd', 'period', name='uq_stk_period_rtn'),
    )
    op.create_index(op.f('ix_mbs_in_stk_period_rtn_stk_cd'), 'mbs_in_stk_period_rtn', ['stk_cd'], unique=False)
    op.create_index(op.f('ix_mbs_in_stk_period_rtn_period'), 'mbs_in_stk_period_rtn', ['period'], unique=False)

    op.create_table(
        'mbs_in_sector_perf',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('universe', sa.String(length=30), nullable=False),
        sa.Column('sector', sa.String(length=100), nullable=False),
        sa.Column('stock_count', sa.Integer(), nullable=False),
        sa.Column('total_market_cap', sa.DECIMAL(precision=24, scale=2), nullable=True),
        sa.Column('stocks', sa.Text(), nullable=False),
        sa.Column('base_ymd', sa.Date(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('universe', 'sector', name='uq_sector_perf'),
    )
    op.create_index(op.f('ix_mbs_in_sector_perf_universe'), 'mbs_in_sector_perf', ['universe'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_mbs_in_sector_perf_universe'), table_name='mbs_in_sector_perf')
    op.drop_table('mbs_in_sector_perf')
    op.drop_index(op.f('ix_mbs_in_stk_period_rtn_period'), table_name='mbs_in_stk_period_rtn')
    op.drop_index(op.f('ix_mbs_in_stk_period_rtn_stk_cd'), table_name='mbs_in_stk_period_rtn')
    op.drop_table('mbs_in_stk_period_rtn')
