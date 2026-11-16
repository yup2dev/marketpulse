"""
Quant API — 팩터 성과 · 모델 검증 · 시장 국면 · 종목 시그널.

계산은 서버에서 하지 않는다. 로컬 배치(MarketpulseBatch/jobs/build_quant.py)가 학습·검증한 결과를
`mbs_in_quant_snapshot` 에 적재하고, 여기서는 그 행을 읽어 그대로 내보낸다 (작은 운영 서버에서
모델을 돌리지 않기 위해서다). 적재 전이면 빈 결과다 — 오류가 아니다.

핸들러는 `def`(동기)다 — DB 만 읽는다.
"""
import json
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.backend.api.deps import route_handler
from app.backend.core.db import get_db
from app.backend.models.orm import MBS_IN_QUANT_SNAPSHOT
from data_fetcher.core.obbject import OBBject

router = APIRouter(prefix="/quant", tags=["quant"])

Dataset = Literal["factors", "factor_returns", "quantiles", "models", "regimes", "signals"]


@router.get("/{dataset}")
@route_handler
def get_quant_dataset(
    dataset: Dataset,
    universe: str = Query("sp500", max_length=30),
    db: Session = Depends(get_db),
) -> OBBject:
    row = (
        db.query(MBS_IN_QUANT_SNAPSHOT)
        .filter(MBS_IN_QUANT_SNAPSHOT.universe == universe, MBS_IN_QUANT_SNAPSHOT.dataset == dataset)
        .first()
    )
    if not row:
        return OBBject(results=[], provider="db", metadata={"universe": universe, "loaded": False})
    meta = json.loads(row.meta) if row.meta else {}
    return OBBject(
        results=json.loads(row.payload),
        provider="db",
        metadata={**meta, "universe": universe, "as_of": row.base_ymd.isoformat(), "loaded": True},
    )
