"""
ORM Models — MBS Schema (역할별 분할 패키지)

기존 단일 파일 `models/orm.py` 를 데이터 흐름 단계별로 분할한 패키지.
공개 표면(import 경로)은 그대로 유지된다:

    from app.backend.models.orm import Base, User, MBS_IN_STK_PROFILE, ...

데이터 흐름: IN(ingest) → PROC(process) → CALC(calc) → RCMD(recommend)
앱 도메인(User/Portfolio/...)은 user 모듈에 분리. 상세는 docs/ARCHITECTURE.md 참고.
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
    MBS_IN_INSTI_PORT_HIST,
    MBS_IN_INSTI_HOLD_HIST,
    MBS_IN_RESEARCH_RPT,
)
from .process import MBS_PROC_ARTICLE
from .calc import MBS_CALC_METRIC
from .recommend import MBS_RCMD_RESULT
from .user import (
    User,
    UserApiKey,
    Portfolio,
    Transaction,
    Holding,
    Watchlist,
    WatchlistItem,
    Alert,
    AlertHistory,
    SavedScreener,
    UserNote,
    UserWorkspace,
    UserBacktestItem,
    UserBacktestRun,
)

__all__ = [
    "Base",
    # IN
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
    "MBS_IN_INSTI_PORT_HIST",
    "MBS_IN_INSTI_HOLD_HIST",
    "MBS_IN_RESEARCH_RPT",
    # PROC / CALC / RCMD
    "MBS_PROC_ARTICLE",
    "MBS_CALC_METRIC",
    "MBS_RCMD_RESULT",
    # User & Portfolio domain
    "User",
    "UserApiKey",
    "Portfolio",
    "Transaction",
    "Holding",
    "Watchlist",
    "WatchlistItem",
    "Alert",
    "AlertHistory",
    "SavedScreener",
    "UserNote",
    "UserWorkspace",
    "UserBacktestItem",
    "UserBacktestRun",
]
