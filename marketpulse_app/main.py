"""
MarketPulse Web Application
FastAPI-based dashboard for financial data visualization
"""
import sys
from pathlib import Path

# Add parent directory to path to import data_fetcher
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from marketpulse_app.api.routes import stock, economic, news, dashboard

app = FastAPI(
    title="MarketPulse Dashboard",
    description="Financial data visualization dashboard",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Get base directory
BASE_DIR = Path(__file__).parent

# Static files and templates
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

# Include routers
app.include_router(stock.router, prefix="/api/stock", tags=["stock"])
app.include_router(economic.router, prefix="/api/economic", tags=["economic"])
app.include_router(news.router, prefix="/api/news", tags=["news"])
app.include_router(dashboard.router, prefix="/api", tags=["dashboard"])

@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    """Main dashboard page"""
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "app": "MarketPulse Dashboard",
        "version": "1.0.0"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
