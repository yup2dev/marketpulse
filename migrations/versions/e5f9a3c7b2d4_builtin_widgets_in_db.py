"""builtin widgets in db

기본 제공 위젯(홈 위젯)의 정의를 코드가 아니라 user_widgets 계열 테이블의 행으로 둔다.

    user_widgets          user_id NULL 허용(= 기본 제공) · provider/model NULL 허용
                          + title/endpoint/data_path/source/… /size (기본 제공 위젯이 쓰는 칸)
    user_widget_params    + label
    user_widget_fields    + width / sub_field / quote_field
    user_widget_screens   + tab / pos_x·y·w·h (기본 배치)
    새 테이블              user_widget_param_options / user_widget_tabs /
                          user_widget_tab_items / user_widget_options

구성은 models/orm/user.py 참고. 기본 제공 위젯의 행은 서비스가 처음 읽을 때 넣는다
(services/builtin_widget_seed.py — widget_types 와 같은 방식).

Revision ID: e5f9a3c7b2d4
Revises: d4e8f2b6a1c3
Create Date: 2026-11-12 00:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e5f9a3c7b2d4'
down_revision: Union[str, Sequence[str], None] = 'd4e8f2b6a1c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('user_widgets') as b:
        b.alter_column('user_id', existing_type=sa.String(length=50), nullable=True)
        b.alter_column('provider', existing_type=sa.String(length=50), nullable=True)
        b.alter_column('model', existing_type=sa.String(length=100), nullable=True)
        b.add_column(sa.Column('title', sa.String(length=100), nullable=True))
        b.add_column(sa.Column('endpoint', sa.String(length=300), nullable=True))
        b.add_column(sa.Column('data_path', sa.String(length=100), nullable=True))
        b.add_column(sa.Column('source', sa.String(length=100), nullable=True))
        b.add_column(sa.Column('source_note', sa.String(length=200), nullable=True))
        b.add_column(sa.Column('transform', sa.String(length=50), nullable=True))
        b.add_column(sa.Column('quote_key', sa.String(length=50), nullable=True))
        b.add_column(sa.Column('refresh_sec', sa.Integer(), nullable=True))
        b.add_column(sa.Column('live_yn', sa.String(length=1), nullable=False, server_default='N'))
        b.add_column(sa.Column('default_symbol', sa.String(length=20), nullable=True))
        b.add_column(sa.Column('empty_text', sa.String(length=200), nullable=True))
        b.add_column(sa.Column('size_w', sa.Integer(), nullable=True))
        b.add_column(sa.Column('size_h', sa.Integer(), nullable=True))
        b.add_column(sa.Column('min_w', sa.Integer(), nullable=True))
        b.add_column(sa.Column('min_h', sa.Integer(), nullable=True))

    with op.batch_alter_table('user_widget_params') as b:
        b.add_column(sa.Column('label', sa.String(length=100), nullable=True))

    with op.batch_alter_table('user_widget_fields') as b:
        b.add_column(sa.Column('width', sa.Integer(), nullable=True))
        b.add_column(sa.Column('sub_field', sa.String(length=100), nullable=True))
        b.add_column(sa.Column('quote_field', sa.String(length=50), nullable=True))

    with op.batch_alter_table('user_widget_screens') as b:
        b.add_column(sa.Column('tab', sa.String(length=50), nullable=True))
        b.add_column(sa.Column('pos_x', sa.Integer(), nullable=True))
        b.add_column(sa.Column('pos_y', sa.Integer(), nullable=True))
        b.add_column(sa.Column('pos_w', sa.Integer(), nullable=True))
        b.add_column(sa.Column('pos_h', sa.Integer(), nullable=True))

    op.create_table(
        'user_widget_param_options',
        sa.Column('widget_id', sa.String(length=50), nullable=False),
        sa.Column('param_seq', sa.Integer(), nullable=False),
        sa.Column('option_seq', sa.Integer(), nullable=False),
        sa.Column('option_value', sa.String(length=100), nullable=False),
        sa.Column('label', sa.String(length=100), nullable=False),
        sa.Column('option_params', sa.String(length=300), nullable=True),
        sa.ForeignKeyConstraint(
            ['widget_id', 'param_seq'],
            ['user_widget_params.widget_id', 'user_widget_params.param_seq'],
        ),
        sa.PrimaryKeyConstraint('widget_id', 'param_seq', 'option_seq'),
    )

    op.create_table(
        'user_widget_tabs',
        sa.Column('widget_id', sa.String(length=50), nullable=False),
        sa.Column('tab_seq', sa.Integer(), nullable=False),
        sa.Column('tab_code', sa.String(length=30), nullable=False),
        sa.Column('label', sa.String(length=100), nullable=False),
        sa.Column('filter', sa.String(length=50), nullable=True),
        sa.Column('empty_text', sa.String(length=200), nullable=True),
        sa.ForeignKeyConstraint(['widget_id'], ['user_widgets.widget_id']),
        sa.PrimaryKeyConstraint('widget_id', 'tab_seq'),
    )

    op.create_table(
        'user_widget_tab_items',
        sa.Column('widget_id', sa.String(length=50), nullable=False),
        sa.Column('tab_seq', sa.Integer(), nullable=False),
        sa.Column('item_seq', sa.Integer(), nullable=False),
        sa.Column('symbol', sa.String(length=30), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.ForeignKeyConstraint(
            ['widget_id', 'tab_seq'],
            ['user_widget_tabs.widget_id', 'user_widget_tabs.tab_seq'],
        ),
        sa.PrimaryKeyConstraint('widget_id', 'tab_seq', 'item_seq'),
    )

    op.create_table(
        'user_widget_options',
        sa.Column('widget_id', sa.String(length=50), nullable=False),
        sa.Column('opt_name', sa.String(length=50), nullable=False),
        sa.Column('opt_value', sa.String(length=300), nullable=False),
        sa.ForeignKeyConstraint(['widget_id'], ['user_widgets.widget_id']),
        sa.PrimaryKeyConstraint('widget_id', 'opt_name'),
    )


def downgrade() -> None:
    # 기본 제공 위젯(user_id NULL)은 옛 스키마에 둘 수 없다 — 자식 행부터 지운다
    builtin = "(SELECT widget_id FROM user_widgets WHERE user_id IS NULL)"
    for table in ('user_widget_tab_items', 'user_widget_tabs', 'user_widget_param_options',
                  'user_widget_options', 'user_widget_params', 'user_widget_fields',
                  'user_widget_screens'):
        op.execute(f"DELETE FROM {table} WHERE widget_id IN {builtin}")
    op.execute("DELETE FROM user_widgets WHERE user_id IS NULL")

    op.drop_table('user_widget_options')
    op.drop_table('user_widget_tab_items')
    op.drop_table('user_widget_tabs')
    op.drop_table('user_widget_param_options')

    with op.batch_alter_table('user_widget_screens') as b:
        for col in ('pos_h', 'pos_w', 'pos_y', 'pos_x', 'tab'):
            b.drop_column(col)
    with op.batch_alter_table('user_widget_fields') as b:
        for col in ('quote_field', 'sub_field', 'width'):
            b.drop_column(col)
    with op.batch_alter_table('user_widget_params') as b:
        b.drop_column('label')
    with op.batch_alter_table('user_widgets') as b:
        for col in ('min_h', 'min_w', 'size_h', 'size_w', 'empty_text', 'default_symbol', 'live_yn',
                    'refresh_sec', 'quote_key', 'transform', 'source_note', 'source', 'data_path',
                    'endpoint', 'title'):
            b.drop_column(col)
        b.alter_column('model', existing_type=sa.String(length=100), nullable=False)
        b.alter_column('provider', existing_type=sa.String(length=50), nullable=False)
        b.alter_column('user_id', existing_type=sa.String(length=50), nullable=False)
