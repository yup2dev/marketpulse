"""
FastAPI Main Application - RESTful API Server
"""
import io
import sys
from pathlib import Path
from fastapi import FastAPI, Query, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_, or_
import logging

# Fix Windows encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from app.models.database import Database, NewsArticle, Ticker, NewsTicker, get_sqlite_db
from app.services.ticker_extractor import TickerExtractor
from app.services.sentiment_analyzer import SentimentAnalyzer

# Logging 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
log = logging.getLogger(__name__)

# FastAPI 앱 초기화
app = FastAPI(
    title="MarketPulse API",
    description="실시간 금융 뉴스 크롤링 및 티커 추출 API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 프로덕션에서는 특정 도메인만 허용
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 데이터베이스 초기화 (SQLite - 개발용)
# Use absolute path to avoid "unable to open database file" errors
DB_PATH = Path(__file__).parent.parent / "data" / "marketpulse.db"
DB_PATH.parent.mkdir(exist_ok=True)
db = get_sqlite_db(str(DB_PATH))
db.create_tables()

# 서비스 초기화
ticker_extractor = TickerExtractor()
sentiment_analyzer = SentimentAnalyzer(use_transformers=False)  # 규칙 기반 사용


# Dependency: DB Session
def get_db():
    """데이터베이스 세션 의존성"""
    session = db.get_session()
    try:
        yield session
    finally:
        session.close()


# ==============================================================================
# API Endpoints
# ==============================================================================

@app.get("/")
async def root():
    """API 정보"""
    return {
        "name": "MarketPulse API",
        "version": "1.0.0",
        "description": "금융 뉴스 크롤링 및 티커 추출 API",
        "endpoints": {
            "news": "/api/news",
            "ticker_news": "/api/tickers/{symbol}/news",
            "trending": "/api/trending",
            "tickers": "/api/tickers",
            "docs": "/docs"
        }
    }


@app.get("/health")
async def health_check():
    """헬스 체크"""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


@app.get("/api/news", response_model=List[dict])
async def get_news(
    tickers: Optional[str] = Query(None, description="쉼표로 구분된 티커 목록 (예: AAPL,TSLA)"),
    hours: int = Query(24, ge=1, le=168, description="조회 기간 (시간)"),
    limit: int = Query(50, ge=1, le=200, description="결과 개수 제한"),
    sentiment: Optional[str] = Query(None, description="감성 필터 (positive/negative/neutral)"),
    min_importance: Optional[float] = Query(None, ge=0, le=10, description="최소 중요도 점수"),
    db: Session = Depends(get_db)
):
    """
    뉴스 조회 API

    - **tickers**: 특정 종목 필터링 (쉼표 구분)
    - **hours**: 최근 N시간 뉴스
    - **limit**: 최대 결과 개수
    - **sentiment**: 감성 필터
    - **min_importance**: 최소 중요도
    """
    try:
        # 기본 쿼리
        query = db.query(NewsArticle)

        # 시간 필터
        start_time = datetime.utcnow() - timedelta(hours=hours)
        query = query.filter(NewsArticle.published_at >= start_time)

        # 티커 필터
        if tickers:
            ticker_list = [t.strip().upper() for t in tickers.split(',')]
            query = query.join(NewsTicker).filter(
                NewsTicker.ticker_symbol.in_(ticker_list)
            )

        # 감성 필터
        if sentiment:
            query = query.filter(NewsArticle.sentiment_label == sentiment.lower())

        # 중요도 필터
        if min_importance is not None:
            query = query.filter(NewsArticle.importance_score >= min_importance)

        # 정렬 및 제한
        results = query.order_by(desc(NewsArticle.published_at)).limit(limit).all()

        return [article.to_dict() for article in results]

    except Exception as e:
        log.error(f"Error in get_news: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/tickers/{symbol}/news")
async def get_ticker_news(
    symbol: str,
    hours: int = Query(24, ge=1, le=168),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """특정 종목의 뉴스 조회"""
    try:
        symbol = symbol.upper()

        # 티커 존재 확인
        ticker = db.query(Ticker).filter(Ticker.symbol == symbol).first()
        if not ticker:
            raise HTTPException(status_code=404, detail=f"Ticker {symbol} not found")

        # 뉴스 조회
        start_time = datetime.utcnow() - timedelta(hours=hours)

        results = db.query(NewsArticle).join(NewsTicker).filter(
            and_(
                NewsTicker.ticker_symbol == symbol,
                NewsArticle.published_at >= start_time
            )
        ).order_by(desc(NewsArticle.published_at)).limit(limit).all()

        return {
            "ticker": ticker.to_dict(),
            "count": len(results),
            "news": [article.to_dict() for article in results]
        }

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Error in get_ticker_news: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/trending")
async def get_trending_tickers(
    hours: int = Query(24, ge=1, le=168),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """
    트렌딩 종목 조회
    - 최근 N시간 동안 가장 많이 언급된 종목
    """
    try:
        start_time = datetime.utcnow() - timedelta(hours=hours)

        # 종목별 뉴스 개수 집계
        from sqlalchemy import func

        trending = db.query(
            NewsTicker.ticker_symbol,
            Ticker.name,
            func.count(NewsTicker.id).label('mention_count'),
            func.sum(NewsTicker.mention_count).label('total_mentions'),
            func.avg(NewsTicker.confidence).label('avg_confidence'),
            func.avg(NewsArticle.sentiment_score).label('avg_sentiment')
        ).join(
            NewsArticle, NewsTicker.news_id == NewsArticle.id
        ).join(
            Ticker, NewsTicker.ticker_symbol == Ticker.symbol
        ).filter(
            NewsArticle.published_at >= start_time
        ).group_by(
            NewsTicker.ticker_symbol,
            Ticker.name
        ).order_by(
            desc('mention_count')
        ).limit(limit).all()

        results = []
        for row in trending:
            results.append({
                'symbol': row.ticker_symbol,
                'name': row.name,
                'news_count': row.mention_count,
                'total_mentions': row.total_mentions,
                'avg_confidence': round(row.avg_confidence, 2) if row.avg_confidence else 0,
                'avg_sentiment': round(row.avg_sentiment, 2) if row.avg_sentiment else 0
            })

        return {
            'period_hours': hours,
            'count': len(results),
            'trending': results
        }

    except Exception as e:
        log.error(f"Error in get_trending_tickers: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/tickers")
async def get_tickers(
    search: Optional[str] = Query(None, description="검색어 (심볼 또는 회사명)"),
    exchange: Optional[str] = Query(None, description="거래소 필터"),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    """티커 목록 조회"""
    try:
        query = db.query(Ticker)

        # 검색 필터
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    Ticker.symbol.ilike(search_term),
                    Ticker.name.ilike(search_term)
                )
            )

        # 거래소 필터
        if exchange:
            query = query.filter(Ticker.exchange == exchange.upper())

        results = query.limit(limit).all()

        return {
            'count': len(results),
            'tickers': [t.to_dict() for t in results]
        }

    except Exception as e:
        log.error(f"Error in get_tickers: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/stats")
async def get_statistics(db: Session = Depends(get_db)):
    """전체 통계"""
    try:
        from sqlalchemy import func

        total_news = db.query(func.count(NewsArticle.id)).scalar()
        total_tickers = db.query(func.count(Ticker.symbol)).scalar()

        # 24시간 통계
        last_24h = datetime.utcnow() - timedelta(hours=24)
        news_24h = db.query(func.count(NewsArticle.id)).filter(
            NewsArticle.published_at >= last_24h
        ).scalar()

        # 감성 분포
        sentiment_dist = db.query(
            NewsArticle.sentiment_label,
            func.count(NewsArticle.id)
        ).group_by(NewsArticle.sentiment_label).all()

        return {
            'total_news': total_news,
            'total_tickers': total_tickers,
            'news_last_24h': news_24h,
            'sentiment_distribution': {label: count for label, count in sentiment_dist if label}
        }

    except Exception as e:
        log.error(f"Error in get_statistics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==============================================================================
# 에러 핸들러
# ==============================================================================

@app.exception_handler(404)
async def not_found_handler(request, exc):
    return JSONResponse(
        status_code=404,
        content={"error": "Not found", "detail": str(exc.detail) if hasattr(exc, 'detail') else "Resource not found"}
    )


@app.exception_handler(500)
async def internal_error_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": "An unexpected error occurred"}
    )


# ==============================================================================
# 서버 실행
# ==============================================================================

if __name__ == "__main__":
    import uvicorn

    log.info("Starting MarketPulse API server...")
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # 개발 모드
        log_level="info"
    )
