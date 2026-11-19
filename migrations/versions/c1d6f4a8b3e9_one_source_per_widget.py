"""one data source per widget

기본 제공 위젯의 출처를 하나로 — 여러 소스를 '·' 로 이어 보이던 위젯(sec,db · yahoo,db · sec,polygon · $provider,live)을
'$provider'(실제로 답한 소스 하나)로 바꾼다. '실시간' 표시는 출처가 아니라 live_yn 으로 옮긴다.

기본 제공 위젯의 시드는 DB 에 없는 위젯만 넣으므로 이미 들어가 있는 행은 여기서 고친다.
시드 그대로인 값만 바꾼다 — 운영자가 손본 행은 건드리지 않는다. 새 DB 는 시드가 처음부터 이렇게 넣는다.

Revision ID: c1d6f4a8b3e9
Revises: b8c3e5f1a2d7
Create Date: 2026-11-19 00:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c1d6f4a8b3e9'
down_revision: Union[str, Sequence[str], None] = 'b8c3e5f1a2d7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# 위젯 → 예전 출처 (시드 값)
OLD_SOURCES = {
    'live-ranking': '$provider,live',
    'sector-heatmap': '$provider,live',
    'stock-feed': 'sec,polygon',
    'inst-summary': 'sec,db',
    'inst-ranking': 'sec,db',
    'inst-performance': 'sec,db',
    'inst-holdings': 'sec,db',
    'quant-factors': 'yahoo,db',
    'quant-factor-returns': 'yahoo,db',
    'quant-models': 'yahoo,db',
    'quant-signals': 'yahoo,db',
}
LIVE = ('live-ranking', 'sector-heatmap')
NEW_SOURCE = '$provider'


def _set(bind, widget: str, old: str, new: str, live: str) -> None:
    bind.execute(
        sa.text(
            "UPDATE user_widgets SET source = :new, live_yn = :live "
            "WHERE widget_id = :w AND user_id IS NULL AND source = :old"
        ),
        {'w': widget, 'old': old, 'new': new, 'live': live},
    )


def upgrade() -> None:
    bind = op.get_bind()
    for widget, old in OLD_SOURCES.items():
        live = 'Y' if widget in LIVE else 'N'
        if widget not in LIVE:
            # 실시간 위젯이 아니면 live_yn 은 그대로 둔다
            live = bind.execute(
                sa.text("SELECT live_yn FROM user_widgets WHERE widget_id = :w AND user_id IS NULL"), {'w': widget},
            ).scalar() or 'N'
        _set(bind, widget, old, NEW_SOURCE, live)


def downgrade() -> None:
    bind = op.get_bind()
    for widget, old in OLD_SOURCES.items():
        live = 'N' if widget in LIVE else (bind.execute(
            sa.text("SELECT live_yn FROM user_widgets WHERE widget_id = :w AND user_id IS NULL"), {'w': widget},
        ).scalar() or 'N')
        _set(bind, widget, NEW_SOURCE, old, live)
