"""add user widget config tables

사용자 정의 위젯 (API → 매핑 → 위젯 → 화면 등록):
    user_widgets / user_widget_params / user_widget_fields / user_widget_screens
위젯 목록 관리:
    widget_types (위젯 종류 — 관리자) / user_widget_prefs / user_widget_pref_screens (기본 위젯의 사용자별 설정)
구성은 models/orm/user.py 참고. widget_types 의 기본 행은 서비스가 처음 읽을 때 넣는다.

Revision ID: d4e8f2b6a1c3
Revises: c3d9e1a4b7f2
Create Date: 2026-11-11 00:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd4e8f2b6a1c3'
down_revision: Union[str, Sequence[str], None] = 'c3d9e1a4b7f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'user_widgets',
        sa.Column('widget_id', sa.String(length=50), nullable=False),
        sa.Column('user_id', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('group_name', sa.String(length=100), nullable=True),
        sa.Column('provider', sa.String(length=50), nullable=False),
        sa.Column('model', sa.String(length=100), nullable=False),
        sa.Column('view_type', sa.String(length=30), nullable=False),
        sa.Column('use_yn', sa.String(length=1), nullable=False),
        sa.Column('sort_seq', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.user_id']),
        sa.PrimaryKeyConstraint('widget_id'),
    )
    op.create_index(op.f('ix_user_widgets_user_id'), 'user_widgets', ['user_id'], unique=False)

    op.create_table(
        'user_widget_params',
        sa.Column('widget_id', sa.String(length=50), nullable=False),
        sa.Column('param_seq', sa.Integer(), nullable=False),
        sa.Column('param_name', sa.String(length=100), nullable=False),
        sa.Column('bind_type', sa.String(length=10), nullable=False),
        sa.Column('param_value', sa.String(length=500), nullable=True),
        sa.Column('var_name', sa.String(length=50), nullable=True),
        sa.ForeignKeyConstraint(['widget_id'], ['user_widgets.widget_id']),
        sa.PrimaryKeyConstraint('widget_id', 'param_seq'),
    )

    op.create_table(
        'user_widget_fields',
        sa.Column('widget_id', sa.String(length=50), nullable=False),
        sa.Column('field_seq', sa.Integer(), nullable=False),
        sa.Column('field_name', sa.String(length=100), nullable=False),
        sa.Column('field_role', sa.String(length=10), nullable=False),
        sa.Column('label', sa.String(length=200), nullable=True),
        sa.Column('format', sa.String(length=20), nullable=False),
        sa.ForeignKeyConstraint(['widget_id'], ['user_widgets.widget_id']),
        sa.PrimaryKeyConstraint('widget_id', 'field_seq'),
    )

    op.create_table(
        'user_widget_screens',
        sa.Column('widget_id', sa.String(length=50), nullable=False),
        sa.Column('screen', sa.String(length=50), nullable=False),
        sa.ForeignKeyConstraint(['widget_id'], ['user_widgets.widget_id']),
        sa.PrimaryKeyConstraint('widget_id', 'screen'),
    )

    op.create_table(
        'widget_types',
        sa.Column('type_code', sa.String(length=30), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('renderer', sa.String(length=20), nullable=False),
        sa.Column('use_yn', sa.String(length=1), nullable=False),
        sa.Column('sort_seq', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('type_code'),
    )

    op.create_table(
        'user_widget_prefs',
        sa.Column('user_id', sa.String(length=50), nullable=False),
        sa.Column('widget_type', sa.String(length=100), nullable=False),
        sa.Column('use_yn', sa.String(length=1), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.user_id']),
        sa.PrimaryKeyConstraint('user_id', 'widget_type'),
    )

    op.create_table(
        'user_widget_pref_screens',
        sa.Column('user_id', sa.String(length=50), nullable=False),
        sa.Column('widget_type', sa.String(length=100), nullable=False),
        sa.Column('screen', sa.String(length=50), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.user_id']),
        sa.PrimaryKeyConstraint('user_id', 'widget_type', 'screen'),
    )


def downgrade() -> None:
    op.drop_table('user_widget_pref_screens')
    op.drop_table('user_widget_prefs')
    op.drop_table('widget_types')
    op.drop_table('user_widget_screens')
    op.drop_table('user_widget_fields')
    op.drop_table('user_widget_params')
    op.drop_index(op.f('ix_user_widgets_user_id'), table_name='user_widgets')
    op.drop_table('user_widgets')
