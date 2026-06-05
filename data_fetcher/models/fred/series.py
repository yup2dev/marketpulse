"""FRED Generic Series — Query params & Data model."""
from __future__ import annotations

from datetime import date
from typing import Optional

from pydantic import BaseModel


class FREDGenericSeriesQueryParams(BaseModel):
    series_id: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    frequency: Optional[str] = None
    aggregation_method: Optional[str] = None
    units: Optional[str] = None
    limit: int = 10000
    sort_order: str = 'asc'


class FREDGenericSeriesData(BaseModel):
    date: str
    value: float