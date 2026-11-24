"""user screen groups

화면 단위 파라미터 그룹 (OpenBB apps.json 의 groups) — models/orm/user.py UserScreenGroup.

    user_screen_groups   (screen, tab, group_code, widget_id) → param_name · source_yn · required_yn

기본 행은 서비스가 기본 제공 위젯을 읽을 때 넣는다 (services/builtin_widget_seed.py SCREEN_GROUPS).

Revision ID: c4e8a2f6d1b9
Revises: b7d3e9a1c5f2
Create Date: 2026-11-25 00:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c4e8a2f6d1b9'
down_revision: Union[str, Sequence[str], None] = 'b7d3e9a1c5f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'user_screen_groups',
        sa.Column('screen', sa.String(length=50), primary_key=True),
        sa.Column('tab', sa.String(length=50), primary_key=True, server_default=''),
        sa.Column('group_code', sa.String(length=50), primary_key=True),
        sa.Column('widget_id', sa.String(length=50),
                  sa.ForeignKey('user_widgets.widget_id', ondelete='CASCADE'), primary_key=True),
        sa.Column('param_name', sa.String(length=100), nullable=False),
        sa.Column('source_yn', sa.String(length=1), nullable=False, server_default='N'),
        sa.Column('required_yn', sa.String(length=1), nullable=False, server_default='Y'),
    )


def downgrade() -> None:
    op.drop_table('user_screen_groups')
