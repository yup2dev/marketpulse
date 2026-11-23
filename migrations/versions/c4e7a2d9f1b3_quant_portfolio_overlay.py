"""quant portfolio macro overlay

user_quant_portfolios.overlay (JSON 텍스트) — 매크로 조건. 켜진 달만 보유, 꺼진 달은 현금.
지표 값은 월별 패널의 '^' 행(배치 quant/macro.py)에서 읽는다 — 새 테이블은 없다.

Revision ID: c4e7a2d9f1b3
Revises: b8d3f1a6c2e7
Create Date: 2026-11-24 00:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c4e7a2d9f1b3'
down_revision: Union[str, Sequence[str], None] = 'b8d3f1a6c2e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _columns(table: str) -> set:
    return {c["name"] for c in sa.inspect(op.get_bind()).get_columns(table)}


def upgrade() -> None:
    # create_all(앱 기동)이 먼저 만들었을 수 있다 — 있으면 건너뛴다
    if "overlay" not in _columns("user_quant_portfolios"):
        op.add_column("user_quant_portfolios", sa.Column("overlay", sa.Text()))


def downgrade() -> None:
    with op.batch_alter_table("user_quant_portfolios") as batch:
        batch.drop_column("overlay")
