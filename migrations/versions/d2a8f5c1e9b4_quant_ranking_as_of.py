"""quant ranking follows a picked month

퀀트 메인의 '이번 달 순위'(quant-ranking)가 머리줄에서 고른 기준월(화면 변수 quant_asof)을 따른다.
  - endpoint 에 &as_of={quant_asof}, 옵션 shared 에 quant_asof (비우면 서버가 패널 마지막 달 = 이번 달)
  - 제목 '기준월 순위', 출처 옆 설명에 {result} (지난달이면 매수 평균 · 전체 평균 다음 달 수익률)
  - 표에 '다음 달' 칸(_fwd — 지난달이면 실제 수익률), 최소 폭 380 → 440
새 테이블은 없다. 시드 그대로인 행만 바꾼다 — 운영자가 손본 행은 건드리지 않는다.

Revision ID: d2a8f5c1e9b4
Revises: e1b5c8a3d7f2
Create Date: 2026-11-24 00:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd2a8f5c1e9b4'
down_revision: Union[str, Sequence[str], None] = 'e1b5c8a3d7f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

W = 'quant-ranking'
# 컬럼: (옛 값, 새 값)
COLUMNS = {
    'title': ('이번 달 순위', '기준월 순위'),
    'endpoint': ('/quant/ranking?universe={universe}&strategy={strategy}',
                 '/quant/ranking?universe={universe}&strategy={strategy}&as_of={quant_asof}'),
    'source_note': ('{strategy} · {asOf} 기준 · 상위 {topN} 매수',
                    '{strategy} · {asOf} 기준 · 상위 {topN} 매수{result}'),
    'description': ("This month's stocks ranked by the picked strategy's score · top N to buy",
                    "Stocks ranked by the picked strategy's score for a month · top N to buy · next-month return for past months"),
}
OPTIONS = {
    'shared': ('universe,strategy', 'universe,strategy,quant_asof'),
    'minWidth': ('380', '440'),
}
# '다음 달' 칸은 점수(_score) 뒤, 표시(_signal) 앞
FWD = ('_fwd', 'COLUMN', '다음 달', 'change', 72)


def _ex(sql: str, **p):
    return op.get_bind().execute(sa.text(sql), p)


def _builtin() -> bool:
    return _ex("SELECT 1 FROM user_widgets WHERE widget_id = :w AND user_id IS NULL", w=W).first() is not None


def _seq(name: str):
    return _ex("SELECT field_seq FROM user_widget_fields WHERE widget_id = :w AND field_name = :n",
               w=W, n=name).scalar()


def _swap(up: bool) -> None:
    for col, (old, new) in COLUMNS.items():
        a, b = (old, new) if up else (new, old)
        _ex(f"UPDATE user_widgets SET {col} = :b WHERE widget_id = :w AND user_id IS NULL AND {col} = :a",
            w=W, a=a, b=b)
    for name, (old, new) in OPTIONS.items():
        a, b = (old, new) if up else (new, old)
        _ex("UPDATE user_widget_options SET opt_value = :b WHERE widget_id = :w AND opt_name = :n AND opt_value = :a",
            w=W, n=name, a=a, b=b)


def upgrade() -> None:
    if not _builtin():
        return   # 아직 시드 전 — 시드가 새 정의로 넣는다
    _swap(True)
    signal = _seq('_signal')
    if _seq(FWD[0]) is not None or signal is None:
        return
    # _signal 부터 한 칸씩 뒤로 (뒤에서부터 — 기본 키 겹침 방지)
    for (seq,) in _ex("SELECT field_seq FROM user_widget_fields WHERE widget_id = :w AND field_seq >= :s "
                      "ORDER BY field_seq DESC", w=W, s=signal).fetchall():
        _ex("UPDATE user_widget_fields SET field_seq = :n WHERE widget_id = :w AND field_seq = :o", w=W, o=seq, n=seq + 1)
    name, role, label, fmt, width = FWD
    _ex("INSERT INTO user_widget_fields (widget_id, field_seq, field_name, field_role, label, format, width) "
        "VALUES (:w, :s, :n, :r, :l, :f, :wd)", w=W, s=signal, n=name, r=role, l=label, f=fmt, wd=width)


def downgrade() -> None:
    if not _builtin():
        return
    _swap(False)
    fwd = _seq(FWD[0])
    if fwd is None:
        return
    _ex("DELETE FROM user_widget_fields WHERE widget_id = :w AND field_seq = :s", w=W, s=fwd)
    for (seq,) in _ex("SELECT field_seq FROM user_widget_fields WHERE widget_id = :w AND field_seq > :s "
                      "ORDER BY field_seq", w=W, s=fwd).fetchall():
        _ex("UPDATE user_widget_fields SET field_seq = :n WHERE widget_id = :w AND field_seq = :o", w=W, o=seq, n=seq - 1)
