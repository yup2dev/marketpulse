"""산업 화면 카탈로그 — 산업 목록 · 데이터셋(+계열) 목록.

데이터 자체는 각 데이터셋의 provider 모델(`/api/data/{provider}/{model}?<params>&<series params>`)로 받는다.
여기는 무엇을 부를지(카탈로그)만 준다. 응답은 OBBject[List[...]] — OpenAPI 에 행 스키마가 나온다.
"""
from typing import List, Optional

from app.backend.platform import OBBject, Router
from fastapi import Depends, Query
from sqlalchemy.orm import Session

from app.backend.core.auth.dependencies import get_current_user
from app.backend.core.db import get_db
from app.backend.models.orm import User
from app.backend.commands.industry import datasets as svc
from app.backend.commands.industry.datasets import (
    IndustryCard, IndustryCompany, IndustryDataRow, IndustryDatasetOut, IndustryOut, IndustryService,
    IndustrySeriesOut,
)

router = Router()

_PROVIDER = "industry"


@router.command(path="/industry", methods=["GET"], summary="산업 목록")
def list_industries(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OBBject[List[IndustryOut]]:
    """사용 중인 산업 — 데이터셋 수(0 이면 준비 중)와 관련 기업 업종 포함."""
    return OBBject[List[IndustryOut]](results=IndustryService.list_industries(db), provider=_PROVIDER)


@router.command(path="/industry/datasets", methods=["GET"], summary="산업 데이터셋 목록")
def list_datasets(
    industry: Optional[str] = Query(None, description="산업 코드 — 비우면 전부"),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OBBject[List[IndustryDatasetOut]]:
    """데이터셋과 계열 — 각 데이터셋은 /api/data/{provider}/{model} 로 부른다 (params + 계열 params)."""
    return OBBject[List[IndustryDatasetOut]](
        results=IndustryService.list_datasets(db, industry), provider=_PROVIDER,
    )


@router.command(path="/industry/series", methods=["GET"], summary="데이터셋 계열")
def list_series(
    dataset: str = Query(..., description="데이터셋 ID"),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OBBject[List[IndustrySeriesOut]]:
    """차트 머리줄의 계열 선택지."""
    return OBBject[List[IndustrySeriesOut]](results=svc.list_series(db, dataset), provider=_PROVIDER)


@router.command(path="/industry/data", methods=["GET"], summary="데이터셋 데이터")
async def dataset_data(
    dataset: str = Query(..., description="데이터셋 ID"),
    series: Optional[str] = Query(None, description="계열 코드 — 비우거나 모르면 첫 계열"),
    period: str = Query("5y", description="1y · 3y · 5y · 10y · max"),
    rate: str = Query("yoy", description="rate 칸에 넣을 증감률 — yoy · mom · none"),
    order: str = Query("asc", description="asc · desc"),
    limit: Optional[int] = Query(None, ge=1, le=600, description="앞에서 몇 개"),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OBBject[List[IndustryDataRow]]:
    """date · value · rate(yoy|mom) · yoy · mom — 데이터셋의 provider 모델을 부른 결과 (metadata 에 이름 · 단위 · 출처)."""
    provider, rows, meta = await svc.dataset_data(db, dataset, series, period, rate, order, limit)
    return OBBject[List[IndustryDataRow]](results=rows, provider=provider, metadata=meta)


@router.command(path="/industry/summary", methods=["GET"], summary="데이터셋 요약 카드")
async def dataset_summary(
    dataset: str = Query(..., description="데이터셋 ID"),
    series: Optional[str] = Query(None, description="계열 코드 — 비우거나 모르면 첫 계열"),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OBBject[List[IndustryCard]]:
    """최신 · 전년 대비 · 직전 대비 · 최근 3기간 평균 YoY · 올해 누적(금액) 또는 1년 평균(지수) · 1년 최고·최저."""
    provider, cards, meta = await svc.dataset_summary(db, dataset, series)
    return OBBject[List[IndustryCard]](results=cards, provider=provider, metadata=meta)


@router.command(path="/industry/companies", methods=["GET"], summary="산업 관련 기업")
def related_companies(
    industry: str = Query(..., description="산업 코드"),
    limit: int = Query(40, ge=1, le=200),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OBBject[List[IndustryCompany]]:
    """산업의 업종에 속한 종목 + 종목마다 가장 최근 일봉 (종목 마스터 · 일봉 적재 기준)."""
    return OBBject[List[IndustryCompany]](
        results=svc.related_companies(db, industry, limit), provider="db",
        metadata={"industry": industry},
    )
