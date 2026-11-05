"""배치 ORM — 수집 파이프라인 테이블(IN → PROC → CALC → RCMD).

사용자·메뉴 등 웹 전용 테이블은 여기 없다 (웹: app/backend/models/orm).

    from index_analyzer.db.orm import Base, MBS_IN_STBD_MST, ...
"""
from .base import Base

from .ingest import (
    MBS_IN_STBD_MST,
    MBS_IN_INDX_STBD,
    MBS_IN_ARTICLE,
    MBS_IN_STK_STBD,
    MBS_IN_ETF_STBD,
    MBS_IN_BOND_STBD,
    MBS_IN_CMDTY_STBD,
    MBS_IN_FX_STBD,
    MBS_IN_FINANCIAL_METRICS,
    MBS_IN_STK_PROFILE,
    MBS_IN_STK_RELATIONS,
    MBS_IN_INDX_MEMBER,
    MBS_IN_BOND_ISSUANCE,
    MBS_IN_INSTI_MST,
    MBS_IN_INSTI_PORT,
    MBS_IN_INSTI_HOLD,
    MBS_IN_INSTI_PERF,
    MBS_IN_RESEARCH_RPT,
)
from .process import MBS_PROC_ARTICLE
from .calc import MBS_CALC_METRIC
from .recommend import MBS_RCMD_RESULT

__all__ = [
    "Base",
    "MBS_IN_STBD_MST",
    "MBS_IN_INDX_STBD",
    "MBS_IN_ARTICLE",
    "MBS_IN_STK_STBD",
    "MBS_IN_ETF_STBD",
    "MBS_IN_BOND_STBD",
    "MBS_IN_CMDTY_STBD",
    "MBS_IN_FX_STBD",
    "MBS_IN_FINANCIAL_METRICS",
    "MBS_IN_STK_PROFILE",
    "MBS_IN_STK_RELATIONS",
    "MBS_IN_INDX_MEMBER",
    "MBS_IN_BOND_ISSUANCE",
    "MBS_IN_INSTI_MST",
    "MBS_IN_INSTI_PORT",
    "MBS_IN_INSTI_HOLD",
    "MBS_IN_INSTI_PERF",
    "MBS_IN_RESEARCH_RPT",
    "MBS_PROC_ARTICLE",
    "MBS_CALC_METRIC",
    "MBS_RCMD_RESULT",
]
