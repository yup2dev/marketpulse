"""data catalog + widget origins

위젯 만들기 화면이 고르는 데이터 목록을 DB 표로 둔다 — Fetcher 등록 정보에서 서버가 채운다
(services/data_catalog.sync_catalog, 기동할 때 · POST /api/admin/data-catalog/sync).

    data_sources            출처
    data_models             표준 모델
    data_model_providers    (provider, model) — 모델 하나를 여러 출처가 준다
    data_model_params       (provider, model, param_name)
    data_model_fields       (provider, model, field_name)
    user_widget_origins     복사해 만든 위젯의 원본과 그때의 지문 (원본이 바뀌면 알리기만 한다)

앱이 뜰 때 create_all 이 이미 만들었을 수 있다 — 있으면 넘어간다.

Revision ID: b8d4e1f6a2c9
Revises: a3f7c2e8d5b1
Create Date: 2026-11-25 00:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b8d4e1f6a2c9'
down_revision: Union[str, Sequence[str], None] = 'a3f7c2e8d5b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has(table: str) -> bool:
    return table in sa.inspect(op.get_bind()).get_table_names()


def _pair_fk() -> sa.ForeignKeyConstraint:
    return sa.ForeignKeyConstraint(
        ['provider', 'model'], ['data_model_providers.provider', 'data_model_providers.model'],
    )


def upgrade() -> None:
    if not _has('data_sources'):
        op.create_table(
            'data_sources',
            sa.Column('provider', sa.String(length=50), primary_key=True),
            sa.Column('name', sa.String(length=100), nullable=False),
            sa.Column('description', sa.String(length=300), nullable=True),
            sa.Column('key_yn', sa.String(length=1), nullable=False),
            sa.Column('use_yn', sa.String(length=1), nullable=False),
            sa.Column('synced_at', sa.DateTime(), nullable=True),
        )
    if not _has('data_models'):
        op.create_table(
            'data_models',
            sa.Column('model', sa.String(length=100), primary_key=True),
            sa.Column('use_yn', sa.String(length=1), nullable=False),
            sa.Column('synced_at', sa.DateTime(), nullable=True),
        )
    if not _has('data_model_providers'):
        op.create_table(
            'data_model_providers',
            sa.Column('provider', sa.String(length=50), sa.ForeignKey('data_sources.provider'), primary_key=True),
            sa.Column('model', sa.String(length=100), sa.ForeignKey('data_models.model'), primary_key=True),
            sa.Column('schema_hash', sa.String(length=64), nullable=False),
            sa.Column('use_yn', sa.String(length=1), nullable=False),
            sa.Column('synced_at', sa.DateTime(), nullable=True),
        )
    if not _has('data_model_params'):
        op.create_table(
            'data_model_params',
            sa.Column('provider', sa.String(length=50), primary_key=True),
            sa.Column('model', sa.String(length=100), primary_key=True),
            sa.Column('param_name', sa.String(length=100), primary_key=True),
            sa.Column('param_seq', sa.Integer(), nullable=False),
            sa.Column('kind', sa.String(length=10), nullable=False),
            sa.Column('required_yn', sa.String(length=1), nullable=False),
            sa.Column('default_value', sa.String(length=500), nullable=True),
            sa.Column('choices', sa.Text(), nullable=True),
            sa.Column('dynamic_yn', sa.String(length=1), nullable=False),
            sa.Column('hint', sa.String(length=500), nullable=True),
            sa.Column('use_yn', sa.String(length=1), nullable=False),
            _pair_fk(),
        )
    if not _has('data_model_fields'):
        op.create_table(
            'data_model_fields',
            sa.Column('provider', sa.String(length=50), primary_key=True),
            sa.Column('model', sa.String(length=100), primary_key=True),
            sa.Column('field_name', sa.String(length=100), primary_key=True),
            sa.Column('field_seq', sa.Integer(), nullable=False),
            sa.Column('kind', sa.String(length=10), nullable=False),
            sa.Column('description', sa.String(length=500), nullable=True),
            sa.Column('use_yn', sa.String(length=1), nullable=False),
            _pair_fk(),
        )
    if not _has('user_widget_origins'):
        op.create_table(
            'user_widget_origins',
            sa.Column('widget_id', sa.String(length=50), sa.ForeignKey('user_widgets.widget_id'), primary_key=True),
            sa.Column('origin_widget_id', sa.String(length=50), nullable=False),
            sa.Column('origin_hash', sa.String(length=64), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_user_widget_origins_origin_widget_id', 'user_widget_origins', ['origin_widget_id'])


def downgrade() -> None:
    if _has('user_widget_origins'):
        op.drop_index('ix_user_widget_origins_origin_widget_id', table_name='user_widget_origins')
        op.drop_table('user_widget_origins')
    for table in ('data_model_fields', 'data_model_params', 'data_model_providers', 'data_models', 'data_sources'):
        if _has(table):
            op.drop_table(table)
