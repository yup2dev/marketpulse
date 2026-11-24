"""industry catalog

산업 화면의 카탈로그 — 산업 → 데이터셋 → 계열, 관련 기업 업종 연결 (models/industry_catalog.py).

    industries                산업 (목록 한 줄)
    industry_datasets         데이터셋 — provider 모델 하나 + 고정 파라미터(쿼리스트링)
    industry_dataset_series   계열 — 그 모델을 부를 때 덧붙일 파라미터
    industry_sectors          관련 기업 — 종목 마스터의 업종 값과 대조

기본 행은 서비스가 처음 읽을 때 넣는다 (services/industry_seed.py).

Revision ID: b7d3e9a1c5f2
Revises: d2a8f5c1e9b4
Create Date: 2026-11-25 00:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b7d3e9a1c5f2'
down_revision: Union[str, Sequence[str], None] = 'd2a8f5c1e9b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'industries',
        sa.Column('industry_code', sa.String(length=30), primary_key=True),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('sort_seq', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('new_yn', sa.String(length=1), nullable=False, server_default='N'),
        sa.Column('use_yn', sa.String(length=1), nullable=False, server_default='Y'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )
    op.create_table(
        'industry_datasets',
        sa.Column('dataset_id', sa.String(length=50), primary_key=True),
        sa.Column('industry_code', sa.String(length=30),
                  sa.ForeignKey('industries.industry_code', ondelete='CASCADE'), nullable=False),
        sa.Column('group_name', sa.String(length=50), nullable=True),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('provider', sa.String(length=50), nullable=False),
        sa.Column('model', sa.String(length=100), nullable=False),
        sa.Column('params', sa.String(length=300), nullable=True),
        sa.Column('frequency', sa.String(length=1), nullable=False, server_default='M'),
        sa.Column('unit', sa.String(length=30), nullable=True),
        sa.Column('source', sa.String(length=100), nullable=True),
        sa.Column('note', sa.String(length=300), nullable=True),
        sa.Column('sort_seq', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('use_yn', sa.String(length=1), nullable=False, server_default='Y'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_industry_datasets_industry_code', 'industry_datasets', ['industry_code'])
    op.create_table(
        'industry_dataset_series',
        sa.Column('dataset_id', sa.String(length=50),
                  sa.ForeignKey('industry_datasets.dataset_id', ondelete='CASCADE'), primary_key=True),
        sa.Column('series_seq', sa.Integer(), primary_key=True),
        sa.Column('series_code', sa.String(length=50), nullable=False),
        sa.Column('label', sa.String(length=100), nullable=False),
        sa.Column('series_params', sa.String(length=300), nullable=False),
    )
    op.create_table(
        'industry_sectors',
        sa.Column('industry_code', sa.String(length=30),
                  sa.ForeignKey('industries.industry_code', ondelete='CASCADE'), primary_key=True),
        sa.Column('market', sa.String(length=10), primary_key=True),
        sa.Column('sector_name', sa.String(length=200), primary_key=True),
        sa.Column('match_field', sa.String(length=20), nullable=False, server_default='sector'),
    )


def downgrade() -> None:
    op.drop_table('industry_sectors')
    op.drop_table('industry_dataset_series')
    op.drop_index('ix_industry_datasets_industry_code', table_name='industry_datasets')
    op.drop_table('industry_datasets')
    op.drop_table('industries')
