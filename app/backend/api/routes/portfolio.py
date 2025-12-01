"""Portfolio API Routes - Institutional 13F holdings data"""
from fastapi import APIRouter, HTTPException

from app.backend.services.portfolio_service import portfolio_service

router = APIRouter()


@router.get("/13f/institutions")
async def get_13f_institutions(
    use_dynamic: bool = True,
    limit: int = 100
):
    """
    Get list of all institutions with 13F holdings data

    Args:
        use_dynamic: If True, fetch from SEC dynamically (default: True)
        limit: Maximum number of institutions to return (default: 100)

    Returns:
        List of institutions with basic information (no portfolio data)

    Examples:
        - GET /api/portfolio/13f/institutions - Dynamic list (100 institutions)
        - GET /api/portfolio/13f/institutions?use_dynamic=false - Featured 20 institutions
        - GET /api/portfolio/13f/institutions?limit=50 - Dynamic list (50 institutions)
    """
    try:
        institutions = await portfolio_service.get_institutions_list(
            use_dynamic=use_dynamic,
            limit=limit
        )

        return {
            "institutions": institutions,
            "count": len(institutions),
            "source": "dynamic" if use_dynamic else "featured"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/13f/{institution_key}")
async def get_13f_portfolio(institution_key: str, limit: int = 50):
    """
    Get institutional 13F holdings from SEC EDGAR

    Args:
        institution_key: Institution key (e.g., 'berkshire', 'ark', 'bridgewater')
        limit: Maximum number of holdings to return (default: 50)

    Returns:
        Portfolio data including holdings, metrics, and optional performance data
    """
    try:
        holding = await portfolio_service.get_institution_portfolio(
            institution_key=institution_key,
            limit=limit
        )
        return holding

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
