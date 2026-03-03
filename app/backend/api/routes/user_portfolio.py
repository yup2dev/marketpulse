"""
사용자 포트폴리오 관리 API
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from decimal import Decimal
import asyncio

from app.backend.database.db_dependency import get_db
from app.backend.auth.dependencies import get_current_active_user
from app.backend.services.user_portfolio_service import UserPortfolioService
from app.backend.services.data_service import data_service
from index_analyzer.models.orm import User

router = APIRouter(prefix="/user-portfolio", tags=["User Portfolio"])


# Request/Response Models
class PortfolioCreate(BaseModel):
    name: str
    description: Optional[str] = None
    currency: str = 'USD'
    benchmark: Optional[str] = None


class PortfolioUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    benchmark: Optional[str] = None
    rebalance_frequency: Optional[str] = None


class TransactionCreate(BaseModel):
    ticker_cd: str
    transaction_type: str  # buy, sell, dividend
    quantity: Decimal
    price: Decimal
    commission: Decimal = Decimal('0')
    tax: Decimal = Decimal('0')
    transaction_date: datetime
    notes: Optional[str] = None


class TransactionUpdate(BaseModel):
    ticker_cd: Optional[str] = None
    transaction_type: Optional[str] = None
    quantity: Optional[Decimal] = None
    price: Optional[Decimal] = None
    commission: Optional[Decimal] = None
    tax: Optional[Decimal] = None
    transaction_date: Optional[datetime] = None
    notes: Optional[str] = None


class WatchlistCreate(BaseModel):
    name: str
    tickers: List[str]
    description: Optional[str] = None


class WatchlistUpdate(BaseModel):
    name: Optional[str] = None
    tickers: Optional[List[str]] = None
    description: Optional[str] = None


# ==================== Portfolio Endpoints ====================

@router.post("/portfolios", status_code=status.HTTP_201_CREATED)
def create_portfolio(
    portfolio_data: PortfolioCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    새 포트폴리오 생성
    """
    portfolio = UserPortfolioService.create_portfolio(
        db=db,
        user_id=current_user.user_id,
        name=portfolio_data.name,
        description=portfolio_data.description,
        currency=portfolio_data.currency,
        benchmark=portfolio_data.benchmark
    )

    return portfolio.to_dict()


@router.get("/portfolios")
def get_my_portfolios(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    내 포트폴리오 목록 조회
    """
    portfolios = UserPortfolioService.get_user_portfolios(db, current_user.user_id)
    return [p.to_dict() for p in portfolios]


@router.get("/portfolios/{portfolio_id}")
def get_portfolio(
    portfolio_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    특정 포트폴리오 상세 조회
    """
    portfolio = UserPortfolioService.get_portfolio(db, portfolio_id, current_user.user_id)

    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found"
        )

    # Holdings도 함께 반환
    holdings = UserPortfolioService.get_portfolio_holdings(db, portfolio_id)

    return {
        **portfolio.to_dict(),
        "holdings": [h.to_dict() for h in holdings]
    }


@router.put("/portfolios/{portfolio_id}")
def update_portfolio(
    portfolio_id: str,
    portfolio_data: PortfolioUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    포트폴리오 정보 업데이트
    """
    updates = portfolio_data.dict(exclude_unset=True)

    portfolio = UserPortfolioService.update_portfolio(
        db, portfolio_id, current_user.user_id, **updates
    )

    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found"
        )

    return portfolio.to_dict()


@router.delete("/portfolios/{portfolio_id}")
def delete_portfolio(
    portfolio_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    포트폴리오 삭제
    """
    success = UserPortfolioService.delete_portfolio(db, portfolio_id, current_user.user_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found"
        )

    return {"message": "Portfolio deleted successfully"}


# ==================== Transaction Endpoints ====================

@router.post("/portfolios/{portfolio_id}/transactions", status_code=status.HTTP_201_CREATED)
def add_transaction(
    portfolio_id: str,
    transaction_data: TransactionCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    거래 추가
    """
    # 포트폴리오 소유권 확인
    portfolio = UserPortfolioService.get_portfolio(db, portfolio_id, current_user.user_id)
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found"
        )

    # 거래 추가
    transaction = UserPortfolioService.add_transaction(
        db=db,
        portfolio_id=portfolio_id,
        **transaction_data.dict()
    )

    return transaction.to_dict()


@router.get("/portfolios/{portfolio_id}/transactions")
def get_transactions(
    portfolio_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    거래 내역 조회
    """
    # 포트폴리오 소유권 확인
    portfolio = UserPortfolioService.get_portfolio(db, portfolio_id, current_user.user_id)
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found"
        )

    transactions = UserPortfolioService.get_portfolio_transactions(db, portfolio_id)
    return [t.to_dict() for t in transactions]


@router.put("/portfolios/{portfolio_id}/transactions/{transaction_id}")
def update_transaction(
    portfolio_id: str,
    transaction_id: str,
    txn_data: TransactionUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    거래 수정 (수량·가격·날짜 등 변경 후 Holding 자동 재계산)
    """
    portfolio = UserPortfolioService.get_portfolio(db, portfolio_id, current_user.user_id)
    if not portfolio:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portfolio not found")

    updated = UserPortfolioService.update_transaction(
        db=db,
        transaction_id=transaction_id,
        portfolio_id=portfolio_id,
        user_id=current_user.user_id,
        **txn_data.dict(exclude_unset=True),
    )

    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    return updated.to_dict()


@router.delete("/portfolios/{portfolio_id}/transactions/{transaction_id}", status_code=status.HTTP_200_OK)
def delete_transaction(
    portfolio_id: str,
    transaction_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    거래 삭제 후 Holding 자동 재계산
    """
    portfolio = UserPortfolioService.get_portfolio(db, portfolio_id, current_user.user_id)
    if not portfolio:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portfolio not found")

    success = UserPortfolioService.delete_transaction(
        db=db,
        transaction_id=transaction_id,
        portfolio_id=portfolio_id,
        user_id=current_user.user_id,
    )

    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    return {"message": "Transaction deleted"}


@router.get("/portfolios/{portfolio_id}/holdings")
def get_holdings(
    portfolio_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    현재 보유 종목 조회
    """
    # 포트폴리오 소유권 확인
    portfolio = UserPortfolioService.get_portfolio(db, portfolio_id, current_user.user_id)
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found"
        )

    holdings = UserPortfolioService.get_portfolio_holdings(db, portfolio_id)
    return [h.to_dict() for h in holdings]


@router.get("/portfolios/{portfolio_id}/summary")
def get_portfolio_summary(
    portfolio_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    포트폴리오 요약 통계 조회
    총 자산, 총 비용, 미실현 손익, 수익률 등
    """
    summary = UserPortfolioService.get_portfolio_summary(db, portfolio_id, current_user.user_id)

    if not summary:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found"
        )

    return summary


@router.get("/portfolios/{portfolio_id}/performance")
def get_portfolio_performance(
    portfolio_id: str,
    period: str = '1M',
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    포트폴리오 성과 데이터 조회

    Args:
        period: 기간 (1D, 1W, 1M, 3M, 6M, 1Y, YTD, ALL)
    """
    performance = UserPortfolioService.get_portfolio_performance(
        db, portfolio_id, current_user.user_id, period
    )

    if not performance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found"
        )

    return performance


@router.get("/portfolios/{portfolio_id}/allocation")
def get_portfolio_allocation(
    portfolio_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    포트폴리오 자산 배분 비율 조회
    """
    allocation = UserPortfolioService.calculate_portfolio_allocation(
        db, portfolio_id, current_user.user_id
    )

    if allocation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found"
        )

    return {"allocation": allocation}


@router.get("/price-at-date")
async def get_price_at_date(
    ticker: str,
    date: str,
    current_user: User = Depends(get_current_active_user),
):
    """
    특정 날짜의 주가 조회 (시가/종가/고가/저가)
    date: YYYY-MM-DD
    주말·공휴일이면 직전 거래일 기준으로 반환
    """
    from datetime import datetime as dt, timedelta
    try:
        target_date = dt.strptime(date[:10], '%Y-%m-%d')
        # ±5일 윈도우로 주말·공휴일 처리
        start = (target_date - timedelta(days=7)).strftime('%Y-%m-%d')
        end   = (target_date + timedelta(days=2)).strftime('%Y-%m-%d')

        history = await data_service.get_stock_history(
            symbol=ticker,
            start_date=start,
            end_date=end,
            interval='1d',
        )

        if not history:
            raise HTTPException(status_code=404, detail=f"{ticker} 가격 데이터 없음")

        # target_date 이하인 가장 최근 거래일 선택
        target_d = target_date.date()
        best = None
        for bar in sorted(history, key=lambda b: b['date']):
            bar_d = dt.fromisoformat(str(bar['date']).split('T')[0]).date()
            if bar_d <= target_d:
                best = bar

        if not best:
            best = history[0]

        def safe_float(v):
            try:
                return round(float(v), 4) if v is not None else None
            except Exception:
                return None

        return {
            'ticker':  ticker.upper(),
            'date':    str(best['date'])[:10],
            'open':    safe_float(best.get('open')),
            'high':    safe_float(best.get('high')),
            'low':     safe_float(best.get('low')),
            'close':   safe_float(best.get('close')),
            'volume':  int(best['volume']) if best.get('volume') else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/portfolios/{portfolio_id}/refresh-prices")
async def refresh_holding_prices(
    portfolio_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    보유 종목의 현재가를 Yahoo Finance에서 가져와 업데이트
    """
    portfolio = UserPortfolioService.get_portfolio(db, portfolio_id, current_user.user_id)
    if not portfolio:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portfolio not found")

    holdings = UserPortfolioService.get_portfolio_holdings(db, portfolio_id)
    if not holdings:
        return {"updated": 0, "failed": []}

    # Fetch prices concurrently
    tickers = list({h.ticker_cd for h in holdings})

    async def fetch_price(ticker):
        try:
            quote = await data_service.get_stock_quote(ticker)
            price = quote.get('price')
            if price:
                full_quote = {
                    'price': float(price),
                    'open': float(quote['open']) if quote.get('open') else float(price),
                    'change': float(quote.get('change', 0)),
                    'change_percent': float(quote.get('change_percent', 0)),
                    'high': float(quote['high']) if quote.get('high') else float(price),
                    'low': float(quote['low']) if quote.get('low') else float(price),
                }
                return (ticker, float(price), full_quote)
            return (ticker, None, None)
        except Exception:
            return (ticker, None, None)

    results = await asyncio.gather(*[fetch_price(t) for t in tickers])
    price_data = {ticker: price for ticker, price, _ in results if price is not None}
    quotes_data = {ticker: q for ticker, _, q in results if q is not None}
    failed = [ticker for ticker, price, _ in results if price is None]

    if price_data:
        UserPortfolioService.update_holding_prices(db, portfolio_id, price_data)

    return {
        "updated": len(price_data),
        "failed": failed,
        "prices": price_data,
        "quotes": quotes_data,
    }


# ==================== Watchlist Endpoints ====================

@router.post("/watchlists", status_code=status.HTTP_201_CREATED)
def create_watchlist(
    watchlist_data: WatchlistCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    관심종목 생성
    """
    watchlist = UserPortfolioService.create_watchlist(
        db=db,
        user_id=current_user.user_id,
        name=watchlist_data.name,
        tickers=watchlist_data.tickers,
        description=watchlist_data.description
    )

    return watchlist.to_dict()


@router.get("/watchlists")
def get_my_watchlists(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    내 관심종목 목록 조회
    """
    watchlists = UserPortfolioService.get_user_watchlists(db, current_user.user_id)
    return [w.to_dict() for w in watchlists]


@router.put("/watchlists/{watchlist_id}")
def update_watchlist(
    watchlist_id: str,
    watchlist_data: WatchlistUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    관심종목 업데이트
    """
    updates = watchlist_data.dict(exclude_unset=True)

    watchlist = UserPortfolioService.update_watchlist(
        db, watchlist_id, current_user.user_id, **updates
    )

    if not watchlist:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watchlist not found"
        )

    return watchlist.to_dict()


@router.delete("/watchlists/{watchlist_id}")
def delete_watchlist(
    watchlist_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    관심종목 삭제
    """
    success = UserPortfolioService.delete_watchlist(db, watchlist_id, current_user.user_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watchlist not found"
        )

    return {"message": "Watchlist deleted successfully"}
