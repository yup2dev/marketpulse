"""add data_model_hints — 파라미터 다중 선택 · 필드 표시 힌트 (데이터 카탈로그)

Fetcher QueryParams 의 multiple_items_allowed 와 Data 필드의 json_schema_extra(x-unit_measurement ·
x-frontend_multiply · x-widget_config)를 카탈로그에 실어, 위젯 만드는 화면의 초안이 쓴다.
행은 기동할 때 data_catalog.sync_catalog 가 채운다. 있는 표에 칼럼을 더하지 않고 새 표로 둔다 —
운영 서버는 create_all 로 없는 표만 만들기 때문이다.

Revision ID: a8c2e6f4b1d9
Revises: d7e3a9c5f1b2
Create Date: 2026-11-27 00:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a8c2e6f4b1d9'
down_revision: Union[str, Sequence[str], None] = 'd7e3a9c5f1b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'data_model_hints',
        sa.Column('provider', sa.String(length=50), nullable=False),
        sa.Column('model', sa.String(length=100), nullable=False),
        sa.Column('target', sa.String(length=5), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('multiple_yn', sa.String(length=1), nullable=False),
        sa.Column('unit', sa.String(length=20), nullable=True),
        sa.Column('multiply', sa.Float(), nullable=True),
        sa.Column('prefix', sa.String(length=10), nullable=True),
        sa.Column('suffix', sa.String(length=10), nullable=True),
        sa.Column('hidden_yn', sa.String(length=1), nullable=False),
        sa.PrimaryKeyConstraint('provider', 'model', 'target', 'name'),
    )


def downgrade() -> None:
    op.drop_table('data_model_hints')
