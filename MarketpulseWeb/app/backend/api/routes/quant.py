"""
Quant API — 팩터 성과 · 모델 검증 · 시장 국면 · 종목 시그널 · 이번 달 순위.

학습은 서버에서 하지 않는다. 로컬 배치(MarketpulseBatch/jobs/build_quant.py)가 학습·검증한 결과를
`mbs_in_quant_snapshot` 에 적재하고, 여기서는 db provider quant_snapshot 으로 읽어 그대로 내보낸다 (작은 운영 서버에서
모델을 돌리지 않기 위해서다). 적재 전이면 빈 결과다 — 오류가 아니다.

예외: `strategy=` 로 전략을 고르면 (퀀트 메인) 팩터 표의 합성 줄 · 비중, 롱숏 곡선의 합성, 분위 수익률을
그 전략 점수로 바꿔 준다 — 적재된 월별 패널(팩터 z · ML 확률 · 다음 달 수익률)로 순위만 세우는 계산이다.
`/quant/ranking` 도 같은 패널의 마지막 달을 전략 점수로 줄 세운다.

핸들러는 `def`(동기)다 — DB 만 읽는다.
"""
from datetime import date
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.backend.api.deps import route_handler
from app.backend.core.auth.dependencies import get_current_active_user
from app.backend.core.db import get_db
from app.backend.models.orm import User
from app.backend.services import quant_strategy_service as strategies
from data_fetcher.core.obbject import OBBject
from data_fetcher.query_executor import QueryExecutor

router = APIRouter(prefix="/quant", tags=["quant"])

Dataset = Literal["factors", "factor_returns", "quantiles", "models", "regimes", "signals"]
BY_STRATEGY = ("factors", "factor_returns", "quantiles", "models")


@router.get("/ranking")
@route_handler
def get_quant_ranking(
    universe: str = Query("sp500", max_length=30),
    strategy: Optional[str] = Query(None, max_length=50, description="전략 id — 비우면 첫 기본 제공 전략"),
    as_of: Optional[str] = Query(None, max_length=10, description="기준일 YYYY-MM-DD — 그날 이전 마지막 달. 비우면 이번 달"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> OBBject:
    """기준월 순위 — 그달의 전략 점수 큰 순 (상위 top_n 매수). 지난달이면 실제 다음 달 수익률도."""
    # 화면 변수가 비면 'as_of=' 로 온다 — 빈 값 · 잘못된 값은 이번 달
    try:
        day = date.fromisoformat(as_of) if as_of else None
    except ValueError:
        day = None
    try:
        rows, meta = strategies.ranking(db, str(user.user_id), universe, strategy, day)
    except LookupError:
        rows, meta = strategies.ranking(db, str(user.user_id), universe, None, day)
    except strategies.StrategyError as e:
        rows, meta = [], {"loaded": True, "note": str(e)}
    return OBBject(results=rows, provider="db", metadata={**meta, "universe": universe})


@router.get("/{dataset}")
@route_handler
def get_quant_dataset(
    dataset: Dataset,
    universe: str = Query("sp500", max_length=30),
    strategy: Optional[str] = Query(None, max_length=50, description="전략 id — 고르면 합성을 그 전략 점수로"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> OBBject:
    raw = QueryExecutor.fetch_sync("db", "quant_snapshot", {"dataset": dataset, "universe": universe})
    meta = OBBject.metadata_of(raw)
    rows = OBBject.from_result(raw, "db").results
    if not meta.get("loaded"):
        return OBBject(results=[], provider="db", metadata={"universe": universe, "loaded": False})
    if strategy and dataset in BY_STRATEGY:
        rows, meta = _by_strategy(db, str(user.user_id), universe, strategy, dataset, rows, meta)
    return OBBject(results=rows, provider="db", metadata=meta)


def _by_strategy(db, user_id, universe, strategy_id, dataset, rows, meta):
    """적재된 합성(6개 팩터 동일 비중)을 고른 전략의 점수로 바꾼다. 못 바꾸면 적재값 그대로 + note."""
    if dataset == "models":
        # 계산은 없다 — 전략이 쓰는 모델에 표시만
        try:
            s = strategies.to_dict(strategies.get_strategy(db, strategy_id, user_id), user_id)
        except LookupError:
            return rows, meta
        # ML 전략의 모델 + 팩터 조합에 섞은 ML 점수(ml_<모델>)
        used = {s["model"]} if s["score_kind"] == "ml" else {
            f["factor_id"][len(strategies.ML_PREFIX):] for f in s["factors"] if strategies.is_ml(f["factor_id"])}
        return [{**r, "used": r.get("id") in used} for r in rows], {**meta, "strategy": s["name"]}
    try:
        view = strategies.strategy_view(db, user_id, universe, strategy_id)
    except LookupError:
        return rows, meta
    except strategies.StrategyError as e:
        return rows, {**meta, "note": str(e)}
    if not view:
        return rows, meta
    s = view["strategy"]
    weights = strategies.strategy_weights(s)
    info = {
        "strategy_id": s["strategy_id"], "strategy": s["name"], "score_kind": s["score_kind"],
        "model": s["model"], "top_n": s["top_n"], "weights": weights, "composite_name": view["row"]["name"],
    }
    if dataset == "factors":
        singles = [{**r, "weight": weights.get(r.get("id"))} for r in rows if not r.get("composite")]
        rows = singles + [view["row"]]
    elif dataset == "factor_returns":
        rows = [{**r, "composite": view["curve"].get(str(r.get("date"))[:10])} for r in rows]
    else:  # quantiles
        rows = view["quantiles"]
        info["spread"] = view["spread"]
    return rows, {**meta, **info}
