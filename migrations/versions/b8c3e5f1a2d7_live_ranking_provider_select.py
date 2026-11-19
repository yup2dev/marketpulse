"""live ranking: pick one data source

홈의 '실시간 랭킹' 위젯이 데이터 소스(yahoo · kis · db)를 하나씩 골라 조회하도록 엔드포인트에
{provider} 를 붙인다 (서버 /stock/ranking/live?provider=… — 비우면 자동).
정렬 탭을 바꿔도 고른 소스가 유지되도록 옵션 keepProvider=true 를 넣는다.

기본 제공 위젯의 시드는 DB 에 없는 위젯만 넣으므로 이미 들어가 있는 행은 여기서 고친다.
시드 그대로인 행만 바꾼다 — 운영자가 손본 행은 건드리지 않는다.

Revision ID: b8c3e5f1a2d7
Revises: a7b2d9e4c1f6
Create Date: 2026-11-19 00:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b8c3e5f1a2d7'
down_revision: Union[str, Sequence[str], None] = 'a7b2d9e4c1f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

WIDGET = 'live-ranking'
OLD = '/stock/ranking/live?market=all&sort_by={sortBy}&limit=30'
NEW = OLD + '&provider={provider}'


def _swap(old: str, new: str) -> None:
    op.get_bind().execute(
        sa.text("UPDATE user_widgets SET endpoint = :new WHERE widget_id = :w AND user_id IS NULL AND endpoint = :old"),
        {'w': WIDGET, 'old': old, 'new': new},
    )


def _has_widget(bind) -> bool:
    return bind.execute(
        sa.text("SELECT 1 FROM user_widgets WHERE widget_id = :w AND user_id IS NULL"), {'w': WIDGET},
    ).first() is not None


def upgrade() -> None:
    bind = op.get_bind()
    if not _has_widget(bind):
        return   # 새 DB — 시드가 처음부터 소스 선택으로 넣는다
    _swap(OLD, NEW)
    exists = bind.execute(
        sa.text("SELECT 1 FROM user_widget_options WHERE widget_id = :w AND opt_name = 'keepProvider'"), {'w': WIDGET},
    ).first()
    if not exists:
        bind.execute(
            sa.text("INSERT INTO user_widget_options (widget_id, opt_name, opt_value) VALUES (:w, 'keepProvider', 'true')"),
            {'w': WIDGET},
        )


def downgrade() -> None:
    bind = op.get_bind()
    _swap(NEW, OLD)
    bind.execute(
        sa.text("DELETE FROM user_widget_options WHERE widget_id = :w AND opt_name = 'keepProvider'"), {'w': WIDGET},
    )
