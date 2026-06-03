"""Portfolio API Routes — OBBject pattern"""
import logging
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException

from data_fetcher.core.obbject import OBBject
from app.backend.services.portfolio_service import portfolio_service

log = logging.getLogger(__name__)
router = APIRouter()


def _wrap(data: Any, provider: str = "sec") -> OBBject:
    if isinstance(data, list):
        return OBBject(results=data, provider=provider)
    return OBBject(results=[data] if data is not None else [], provider=provider)


@router.get("/13f/institutions")
async def get_13f_institutions(
    use_dynamic: bool = True,
    limit: int = 100,
    provider: str = "sec",
) -> OBBject:
    try:
        institutions = await portfolio_service.get_institutions_list(
            use_dynamic=use_dynamic, limit=limit
        )
        return OBBject(
            results=institutions,
            provider=provider,
            metadata={"source": "dynamic" if use_dynamic else "featured"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/13f/{institution_key}")
async def get_13f_portfolio(
    institution_key: str,
    limit: int = 50,
    provider: str = "sec",
) -> OBBject:
    try:
        data = await portfolio_service.get_institution_portfolio(
            institution_key=institution_key, limit=limit
        )
        return OBBject(results=[data], provider=provider)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        log.error(f"Error fetching 13F for {institution_key}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
