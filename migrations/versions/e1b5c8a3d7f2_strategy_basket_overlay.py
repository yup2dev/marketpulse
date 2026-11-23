"""macro conditions move from portfolios to strategies

전략 = 규칙 전체 (대상 종목 · 점수 · 매크로 조건), 포트폴리오 = 종목 묶음 · 비중만.
  - user_quant_strategies.basket_id : 대상 종목 묶음(user_quant_portfolios) — 비우면 유니버스 전체
  - user_quant_strategies.overlay   : 매크로 조건 JSON (services/quant_overlay)
  - 이미 포트폴리오에 붙은 매크로 조건은 '그 포트폴리오를 대상으로 전부 보유'하는 전략으로 옮기고 포트폴리오에서는 비운다
    (전략 리밸런싱은 월간 · 분기뿐이라 포트폴리오의 '안 함' · '연 1회'는 분기로)

SQLite 는 ALTER 로 외래키를 붙이지 못해 batch(테이블 다시 만들기)로 붙인다 — 전략 테이블은 행이 적다.

Revision ID: e1b5c8a3d7f2
Revises: c4e7a2d9f1b3
Create Date: 2026-11-24 00:00:00

"""
import uuid
from datetime import datetime
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e1b5c8a3d7f2'
down_revision: Union[str, Sequence[str], None] = 'c4e7a2d9f1b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

REBALANCE = {"M": "M", "Q": "Q", "N": "Q", "Y": "Q"}


def _columns(table: str) -> set:
    return {c["name"] for c in sa.inspect(op.get_bind()).get_columns(table)}


def upgrade() -> None:
    have = _columns("user_quant_strategies")
    # batch = 테이블을 새로 만들어 옮긴다 — SQLite 에서도 외래키를 붙일 수 있게 (행이 적은 테이블)
    with op.batch_alter_table("user_quant_strategies") as batch:
        if "basket_id" not in have:
            batch.add_column(sa.Column("basket_id", sa.String(length=50)))
            batch.create_foreign_key("fk_user_quant_strategies_basket", "user_quant_portfolios",
                                     ["basket_id"], ["portfolio_id"])
        if "overlay" not in have:
            batch.add_column(sa.Column("overlay", sa.Text()))

    bind = op.get_bind()
    rows = bind.execute(sa.text(
        "SELECT portfolio_id, user_id, name, universe, rebalance, overlay FROM user_quant_portfolios "
        "WHERE overlay IS NOT NULL AND overlay != ''")).fetchall()
    now = datetime.utcnow()
    for pid, uid, name, universe, rebalance, overlay in rows:
        bind.execute(sa.text(
            "INSERT INTO user_quant_strategies (strategy_id, user_id, name, description, universe, score_kind, model, "
            "top_n, rebalance, basket_id, overlay, sort_seq, use_yn, created_at, updated_at) "
            "VALUES (:sid, :uid, :name, :desc, :uni, 'none', NULL, 30, :reb, :pid, :ov, 0, 'Y', :now, :now)"),
            {"sid": str(uuid.uuid4()), "uid": uid, "name": name, "desc": "포트폴리오의 매크로 조건을 옮긴 전략",
             "uni": universe or "sp500", "reb": REBALANCE.get(rebalance, "Q"), "pid": pid, "ov": overlay, "now": now})
        bind.execute(sa.text("UPDATE user_quant_portfolios SET overlay = NULL WHERE portfolio_id = :pid"), {"pid": pid})


def downgrade() -> None:
    bind = op.get_bind()
    # 옮긴 전략의 조건을 포트폴리오로 되돌리고 그 전략은 지운다
    rows = bind.execute(sa.text(
        "SELECT strategy_id, basket_id, overlay FROM user_quant_strategies "
        "WHERE score_kind = 'none' AND basket_id IS NOT NULL")).fetchall()
    for sid, pid, overlay in rows:
        if overlay:
            bind.execute(sa.text("UPDATE user_quant_portfolios SET overlay = :ov WHERE portfolio_id = :pid"),
                         {"ov": overlay, "pid": pid})
        bind.execute(sa.text("DELETE FROM user_quant_strategy_factors WHERE strategy_id = :sid"), {"sid": sid})
        bind.execute(sa.text("DELETE FROM user_quant_strategies WHERE strategy_id = :sid"), {"sid": sid})
    with op.batch_alter_table("user_quant_strategies") as batch:
        batch.drop_constraint("fk_user_quant_strategies_basket", type_="foreignkey")
        batch.drop_column("overlay")
        batch.drop_column("basket_id")
