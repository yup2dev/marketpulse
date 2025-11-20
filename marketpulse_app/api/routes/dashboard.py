"""
Dashboard API Routes
Endpoints for dashboard data aggregation
"""
from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from marketpulse_app.services.data_service import data_service

router = APIRouter()

# Get templates directory
BASE_DIR = Path(__file__).parent.parent.parent
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))


@router.get("/", response_class=HTMLResponse)
async def dashboard_home(request: Request):
    """Render main dashboard page"""
    return templates.TemplateResponse("index.html", {"request": request})


@router.get("/overview/{symbol}")
async def get_stock_overview(symbol: str):
    """Get complete stock overview (quote + info + news)"""
    try:
        quote = await data_service.get_stock_quote(symbol.upper())
        info = await data_service.get_company_info(symbol.upper())
        news = await data_service.get_news(symbol=symbol.upper(), limit=5)

        return {
            "symbol": symbol.upper(),
            "quote": quote,
            "info": info,
            "news": news
        }
    except Exception as e:
        return {"error": str(e)}
