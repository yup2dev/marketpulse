"""add mbs_in_quant_snapshot (퀀트 산출물 스냅샷 — 팩터 성과 · 모델 검증 · 국면 · 시그널)

Revision ID: a7b2d9e4c1f6
Revises: f6a1c8d3e9b5
Create Date: 2026-11-16 00:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a7b2d9e4c1f6'
down_revision: Union[str, Sequence[str], None] = 'f6a1c8d3e9b5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'mbs_in_quant_snapshot',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('universe', sa.String(length=30), nullable=False),
        sa.Column('dataset', sa.String(length=30), nullable=False),
        sa.Column('base_ymd', sa.Date(), nullable=False),
        sa.Column('payload', sa.Text(), nullable=False),
        sa.Column('meta', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('universe', 'dataset', name='uq_quant_snapshot'),
    )
    op.create_index(op.f('ix_mbs_in_quant_snapshot_universe'), 'mbs_in_quant_snapshot', ['universe'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_mbs_in_quant_snapshot_universe'), table_name='mbs_in_quant_snapshot')
    op.drop_table('mbs_in_quant_snapshot')
