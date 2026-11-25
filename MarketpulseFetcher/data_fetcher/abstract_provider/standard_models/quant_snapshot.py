"""Quant Snapshot Standard Model — 배치가 학습 · 검증해 적재한 퀀트 산출물 한 묶음.

dataset 마다 행 모양이 다르다 (팩터 표 · 팩터 수익률 곡선 · 분위 · 모델 · 국면 · 시그널) — 행은 그대로 싣는다.
기준일 · 덧붙는 값은 metadata (as_of · loaded · 배치가 적은 meta).
"""
from typing import Literal

from pydantic import ConfigDict, Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams

QuantDataset = Literal["factors", "factor_returns", "quantiles", "models", "regimes", "signals"]


class QuantSnapshotQueryParams(BaseQueryParams):
    dataset: QuantDataset = Field(description="산출물")
    universe: str = Field(default="sp500", max_length=30, description="유니버스")


class QuantSnapshotData(BaseData):
    """dataset 마다 칸이 다르다 — 적재된 행의 칸을 그대로 둔다."""

    model_config = ConfigDict(extra="allow")
