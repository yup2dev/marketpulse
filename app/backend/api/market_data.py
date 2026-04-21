"""OBBject-style response wrapper.

Pattern adopted from OpenBB's ``OBBject``: every service response is a
structured envelope rather than bare JSON, so warnings, provider, chart
payload, and execution metadata travel with the results.

Shape on the wire::

    {
        "data":     <alias of results — kept for frontend back-compat>,
        "results":  <actual payload>,
        "provider": "yahoo" | "fmp" | ...,
        "warnings": [{"category": "...", "message": "..."}],
        "chart":    {"format": "plotly", "content": {...}} | null,
        "extra":    {"duration_ms": 12.4, "cached": false, ...}
    }
"""
from __future__ import annotations

import time
from contextlib import contextmanager
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class MarketDataWarning(BaseModel):
    category: str = "MarketPulseWarning"
    message:  str


class MarketDataChart(BaseModel):
    """Optional chart payload. ``content`` is a plotly figure spec by default."""
    format:  str = "plotly"
    content: Dict[str, Any] = Field(default_factory=dict)


class MarketData(BaseModel):
    """OBBject-like envelope for service responses."""
    results:  Any = None
    provider: Optional[str] = None
    warnings: List[MarketDataWarning] = Field(default_factory=list)
    chart:    Optional[MarketDataChart] = None
    extra:    Dict[str, Any] = Field(default_factory=dict)

    def model_dump(self, **kwargs) -> Dict[str, Any]:
        d = super().model_dump(**kwargs)
        d["data"] = d.get("results")   # back-compat alias for existing frontend
        return d


def to_response(
    results:  Any,
    *,
    provider: Optional[str] = None,
    warnings: Optional[List[str]] = None,
    chart:    Optional[Dict[str, Any]] = None,
    extra:    Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Wrap a service result in a MarketData envelope and serialize to dict."""
    md = MarketData(
        results  = results,
        provider = provider,
        warnings = [MarketDataWarning(message=w) for w in (warnings or [])],
        chart    = MarketDataChart(content=chart) if chart else None,
        extra    = extra or {},
    )
    return md.model_dump()


@contextmanager
def timed(extra: Dict[str, Any], key: str = "duration_ms"):
    """Context manager that records elapsed ms into ``extra[key]``."""
    t0 = time.perf_counter()
    try:
        yield
    finally:
        extra[key] = round((time.perf_counter() - t0) * 1000, 2)
