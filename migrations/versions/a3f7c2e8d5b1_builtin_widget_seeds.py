"""builtin widget defaults live in data files — user_widget_seeds

기본 제공 위젯의 기본값을 파이썬 시드(services/builtin_widget_seed.py) 대신 데이터 파일
(app/backend/builtin_widgets/<widget_id>.json)로 옮긴다. 서버가 위젯 목록을 읽을 때 파일과 DB 를 맞추므로
위젯 정의를 바꿀 때 이런 마이그레이션을 더 쓰지 않는다 (규칙: services/user_widget_service._sync_builtin).

  user_widget_seeds (widget_id, seed_hash) — 마지막으로 파일에서 넣은 지문. 행이 이 지문 그대로면 손대지 않은 것.

앱이 뜰 때 create_all 이 이미 만들었을 수 있다 — 있으면 넘어간다.

Revision ID: a3f7c2e8d5b1
Revises: c4e8a2f6d1b9
Create Date: 2026-11-24 00:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a3f7c2e8d5b1'
down_revision: Union[str, Sequence[str], None] = 'c4e8a2f6d1b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has(table: str) -> bool:
    return table in sa.inspect(op.get_bind()).get_table_names()


def upgrade() -> None:
    if _has('user_widget_seeds'):
        return
    op.create_table(
        'user_widget_seeds',
        sa.Column('widget_id', sa.String(50), primary_key=True),
        sa.Column('seed_hash', sa.String(64), nullable=False),
        sa.Column('updated_at', sa.DateTime()),
    )


def downgrade() -> None:
    if _has('user_widget_seeds'):
        op.drop_table('user_widget_seeds')
