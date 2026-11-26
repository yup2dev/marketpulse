"""add data_model_routes ((provider, model) 실행 위치 — Y 로컬 전용 · N 서버)

어디서 실행할지를 fetcher 코드(예전 QueryExecutor 의 yahoo · 13F 고정 목록)가 아니라 이 표가 정한다.
읽는 곳은 웹 백엔드의 실행 계층(core/execution) 하나. 행은 기동할 때 routes.sync_routes 가 넣는다.

Revision ID: d7e3a9c5f1b2
Revises: c4a9e2f7b1d8
Create Date: 2026-11-26 00:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd7e3a9c5f1b2'
down_revision: Union[str, Sequence[str], None] = 'c4a9e2f7b1d8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'data_model_routes',
        sa.Column('provider', sa.String(length=50), nullable=False),
        sa.Column('model', sa.String(length=100), nullable=False),
        sa.Column('local_yn', sa.String(length=1), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('updated_by', sa.String(length=50), nullable=True),
        sa.PrimaryKeyConstraint('provider', 'model'),
    )


def downgrade() -> None:
    op.drop_table('data_model_routes')
