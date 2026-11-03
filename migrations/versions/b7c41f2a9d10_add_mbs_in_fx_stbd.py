"""add mbs_in_fx_stbd (일별 환율)

Revision ID: b7c41f2a9d10
Revises: 8e3578555658
Create Date: 2026-11-03 00:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b7c41f2a9d10'
down_revision: Union[str, Sequence[str], None] = '8e3578555658'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'mbs_in_fx_stbd',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('fx_cd', sa.String(length=20), nullable=False),
        sa.Column('base_curr', sa.String(length=10), nullable=False),
        sa.Column('quote_curr', sa.String(length=10), nullable=False),
        sa.Column('rate', sa.DECIMAL(precision=20, scale=6), nullable=False),
        sa.Column('change_rate', sa.DECIMAL(precision=10, scale=4), nullable=True),
        sa.Column('base_ymd', sa.Date(), nullable=False),
        sa.Column('data_source', sa.String(length=50), nullable=True),
        sa.Column('ingest_batch_id', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('fx_cd', 'base_ymd', name='uq_fx_date'),
    )
    op.create_index('idx_in_fx_cd_date', 'mbs_in_fx_stbd', ['fx_cd', 'base_ymd'], unique=False)
    op.create_index(op.f('ix_mbs_in_fx_stbd_fx_cd'), 'mbs_in_fx_stbd', ['fx_cd'], unique=False)
    op.create_index(op.f('ix_mbs_in_fx_stbd_base_ymd'), 'mbs_in_fx_stbd', ['base_ymd'], unique=False)
    op.create_index(op.f('ix_mbs_in_fx_stbd_ingest_batch_id'), 'mbs_in_fx_stbd', ['ingest_batch_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_mbs_in_fx_stbd_ingest_batch_id'), table_name='mbs_in_fx_stbd')
    op.drop_index(op.f('ix_mbs_in_fx_stbd_base_ymd'), table_name='mbs_in_fx_stbd')
    op.drop_index(op.f('ix_mbs_in_fx_stbd_fx_cd'), table_name='mbs_in_fx_stbd')
    op.drop_index('idx_in_fx_cd_date', table_name='mbs_in_fx_stbd')
    op.drop_table('mbs_in_fx_stbd')
