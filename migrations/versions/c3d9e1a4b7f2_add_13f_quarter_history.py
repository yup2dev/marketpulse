"""add mbs_in_insti_port_hist / mbs_in_insti_hold_hist (13F 분기 이력)

Revision ID: c3d9e1a4b7f2
Revises: b7c41f2a9d10
Create Date: 2026-11-07 00:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c3d9e1a4b7f2'
down_revision: Union[str, Sequence[str], None] = 'b7c41f2a9d10'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'mbs_in_insti_port_hist',
        sa.Column('institution_key', sa.String(length=100), nullable=False),
        sa.Column('period', sa.String(length=20), nullable=False),
        sa.Column('id', sa.String(length=120), nullable=True),
        sa.Column('manager', sa.String(length=300), nullable=True),
        sa.Column('name', sa.String(length=300), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('total_value', sa.Float(), nullable=True),
        sa.Column('num_holdings', sa.Integer(), nullable=True),
        sa.Column('filing_date', sa.String(length=20), nullable=True),
        sa.Column('category', sa.String(length=50), nullable=True),
        sa.Column('previous_filing_date', sa.String(length=20), nullable=True),
        sa.Column('previous_value', sa.Float(), nullable=True),
        sa.Column('value_change', sa.Float(), nullable=True),
        sa.Column('value_change_pct', sa.Float(), nullable=True),
        sa.Column('num_new_positions', sa.Integer(), nullable=True),
        sa.Column('num_sold_out', sa.Integer(), nullable=True),
        sa.Column('num_increased', sa.Integer(), nullable=True),
        sa.Column('num_decreased', sa.Integer(), nullable=True),
        sa.Column('turnover', sa.Float(), nullable=True),
        sa.Column('top_sectors', sa.JSON(), nullable=True),
        sa.Column('base_ymd', sa.Date(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('institution_key', 'period'),
    )
    op.create_index(op.f('ix_mbs_in_insti_port_hist_base_ymd'), 'mbs_in_insti_port_hist', ['base_ymd'], unique=False)

    op.create_table(
        'mbs_in_insti_hold_hist',
        sa.Column('institution_key', sa.String(length=100), nullable=False),
        sa.Column('period', sa.String(length=20), nullable=False),
        sa.Column('is_sold', sa.Boolean(), nullable=False),
        sa.Column('seq', sa.Integer(), nullable=False),
        sa.Column('symbol', sa.String(length=20), nullable=True),
        sa.Column('name', sa.String(length=300), nullable=True),
        sa.Column('cusip', sa.String(length=20), nullable=True),
        sa.Column('value', sa.Float(), nullable=True),
        sa.Column('shares', sa.BigInteger(), nullable=True),
        sa.Column('weight', sa.Float(), nullable=True),
        sa.Column('prev_shares', sa.BigInteger(), nullable=True),
        sa.Column('prev_value', sa.Float(), nullable=True),
        sa.Column('share_change', sa.BigInteger(), nullable=True),
        sa.Column('share_change_pct', sa.Float(), nullable=True),
        sa.Column('value_change', sa.Float(), nullable=True),
        sa.Column('value_change_pct', sa.Float(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=True),
        sa.Column('base_ymd', sa.Date(), nullable=True),
        sa.PrimaryKeyConstraint('institution_key', 'period', 'is_sold', 'seq'),
    )
    op.create_index(op.f('ix_mbs_in_insti_hold_hist_symbol'), 'mbs_in_insti_hold_hist', ['symbol'], unique=False)
    op.create_index(op.f('ix_mbs_in_insti_hold_hist_base_ymd'), 'mbs_in_insti_hold_hist', ['base_ymd'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_mbs_in_insti_hold_hist_base_ymd'), table_name='mbs_in_insti_hold_hist')
    op.drop_index(op.f('ix_mbs_in_insti_hold_hist_symbol'), table_name='mbs_in_insti_hold_hist')
    op.drop_table('mbs_in_insti_hold_hist')
    op.drop_index(op.f('ix_mbs_in_insti_port_hist_base_ymd'), table_name='mbs_in_insti_port_hist')
    op.drop_table('mbs_in_insti_port_hist')
