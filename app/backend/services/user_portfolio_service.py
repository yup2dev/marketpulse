"""
사용자 포트폴리오 관리 서비스
"""
from decimal import Decimal
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import uuid
import json

from index_analyzer.models.database import (
    User, Portfolio, Transaction, Holding, Watchlist
)


class UserPortfolioService:
    """사용자 포트폴리오 관리 비즈니스 로직"""

    # ==================== Portfolio CRUD ====================

    @staticmethod
    def create_portfolio(
        db: Session,
        user_id: str,
        name: str,
        description: Optional[str] = None,
        currency: str = 'USD',
        benchmark: Optional[str] = None
    ) -> Portfolio:
        """
        새 포트폴리오 생성
        """
        portfolio = Portfolio(
            portfolio_id=f"port_{uuid.uuid4().hex[:16]}",
            user_id=user_id,
            name=name,
            description=description,
            currency=currency,
            benchmark=benchmark,
            is_default=False
        )

        db.add(portfolio)
        db.commit()
        db.refresh(portfolio)

        return portfolio

    @staticmethod
    def get_user_portfolios(db: Session, user_id: str) -> List[Portfolio]:
        """
        사용자의 모든 포트폴리오 조회
        """
        return db.query(Portfolio).filter(Portfolio.user_id == user_id).all()

    @staticmethod
    def get_portfolio(db: Session, portfolio_id: str, user_id: str) -> Optional[Portfolio]:
        """
        특정 포트폴리오 조회 (사용자 권한 확인)
        """
        return db.query(Portfolio).filter(
            Portfolio.portfolio_id == portfolio_id,
            Portfolio.user_id == user_id
        ).first()

    @staticmethod
    def update_portfolio(
        db: Session,
        portfolio_id: str,
        user_id: str,
        **updates
    ) -> Optional[Portfolio]:
        """
        포트폴리오 정보 업데이트
        """
        portfolio = UserPortfolioService.get_portfolio(db, portfolio_id, user_id)
        if not portfolio:
            return None

        for key, value in updates.items():
            if hasattr(portfolio, key) and value is not None:
                setattr(portfolio, key, value)

        db.commit()
        db.refresh(portfolio)

        return portfolio

    @staticmethod
    def delete_portfolio(db: Session, portfolio_id: str, user_id: str) -> bool:
        """
        포트폴리오 삭제
        """
        portfolio = UserPortfolioService.get_portfolio(db, portfolio_id, user_id)
        if not portfolio:
            return False

        db.delete(portfolio)
        db.commit()

        return True

    # ==================== Transaction Management ====================

    @staticmethod
    def add_transaction(
        db: Session,
        portfolio_id: str,
        ticker_cd: str,
        transaction_type: str,
        quantity: Decimal,
        price: Decimal,
        transaction_date: datetime,
        commission: Decimal = Decimal('0'),
        tax: Decimal = Decimal('0'),
        notes: Optional[str] = None
    ) -> Transaction:
        """
        거래 추가 및 Holding 업데이트
        """
        # 총액 계산
        if transaction_type == 'buy':
            total_amount = (quantity * price) + commission + tax
        elif transaction_type == 'sell':
            total_amount = (quantity * price) - commission - tax
        else:  # dividend
            total_amount = quantity * price

        # Transaction 생성
        transaction = Transaction(
            transaction_id=f"txn_{uuid.uuid4().hex[:16]}",
            portfolio_id=portfolio_id,
            ticker_cd=ticker_cd,
            transaction_type=transaction_type,
            quantity=quantity,
            price=price,
            commission=commission,
            tax=tax,
            total_amount=total_amount,
            transaction_date=transaction_date,
            notes=notes
        )

        db.add(transaction)

        # Holding 업데이트
        if transaction_type in ['buy', 'sell']:
            UserPortfolioService._update_holding(
                db, portfolio_id, ticker_cd, transaction_type, quantity, price
            )

        db.commit()
        db.refresh(transaction)

        return transaction

    @staticmethod
    def _update_holding(
        db: Session,
        portfolio_id: str,
        ticker_cd: str,
        transaction_type: str,
        quantity: Decimal,
        price: Decimal
    ):
        """
        Holding 업데이트 (평균 매입가 계산)
        """
        # 기존 Holding 조회
        holding = db.query(Holding).filter(
            Holding.portfolio_id == portfolio_id,
            Holding.ticker_cd == ticker_cd
        ).first()

        if transaction_type == 'buy':
            if holding:
                # 평균 매입가 재계산
                total_cost = (holding.avg_cost * holding.quantity) + (price * quantity)
                new_quantity = holding.quantity + quantity
                holding.quantity = new_quantity
                holding.avg_cost = total_cost / new_quantity
                holding.total_cost = total_cost
            else:
                # 새 Holding 생성
                holding = Holding(
                    holding_id=f"hold_{uuid.uuid4().hex[:16]}",
                    portfolio_id=portfolio_id,
                    ticker_cd=ticker_cd,
                    quantity=quantity,
                    avg_cost=price,
                    total_cost=price * quantity
                )
                db.add(holding)

        elif transaction_type == 'sell':
            if holding:
                holding.quantity -= quantity
                if holding.quantity <= 0:
                    db.delete(holding)
                else:
                    holding.total_cost = holding.avg_cost * holding.quantity

    @staticmethod
    def get_portfolio_transactions(db: Session, portfolio_id: str) -> List[Transaction]:
        """
        포트폴리오의 모든 거래 내역 조회
        """
        return db.query(Transaction).filter(
            Transaction.portfolio_id == portfolio_id
        ).order_by(Transaction.transaction_date.desc()).all()

    @staticmethod
    def get_portfolio_holdings(db: Session, portfolio_id: str) -> List[Holding]:
        """
        포트폴리오의 현재 보유 종목 조회
        """
        return db.query(Holding).filter(
            Holding.portfolio_id == portfolio_id
        ).all()

    @staticmethod
    def update_holding_prices(db: Session, portfolio_id: str, price_data: dict):
        """
        Holding의 현재가 업데이트 및 손익 계산
        price_data: {ticker_cd: current_price}
        """
        holdings = UserPortfolioService.get_portfolio_holdings(db, portfolio_id)

        for holding in holdings:
            if holding.ticker_cd in price_data:
                current_price = Decimal(str(price_data[holding.ticker_cd]))
                holding.current_price = current_price
                holding.market_value = holding.quantity * current_price
                holding.unrealized_pnl = holding.market_value - holding.total_cost
                holding.unrealized_pnl_pct = (
                    (holding.unrealized_pnl / holding.total_cost) * 100
                    if holding.total_cost > 0 else Decimal('0')
                )

        db.commit()

    # ==================== Watchlist Management ====================

    @staticmethod
    def create_watchlist(
        db: Session,
        user_id: str,
        name: str,
        tickers: List[str],
        description: Optional[str] = None
    ) -> Watchlist:
        """
        관심종목 리스트 생성
        """
        watchlist = Watchlist(
            watchlist_id=f"watch_{uuid.uuid4().hex[:16]}",
            user_id=user_id,
            name=name,
            description=description,
            tickers=json.dumps(tickers)
        )

        db.add(watchlist)
        db.commit()
        db.refresh(watchlist)

        return watchlist

    @staticmethod
    def get_user_watchlists(db: Session, user_id: str) -> List[Watchlist]:
        """
        사용자의 모든 관심종목 조회
        """
        return db.query(Watchlist).filter(Watchlist.user_id == user_id).all()

    @staticmethod
    def update_watchlist(
        db: Session,
        watchlist_id: str,
        user_id: str,
        tickers: Optional[List[str]] = None,
        name: Optional[str] = None,
        description: Optional[str] = None
    ) -> Optional[Watchlist]:
        """
        관심종목 업데이트
        """
        watchlist = db.query(Watchlist).filter(
            Watchlist.watchlist_id == watchlist_id,
            Watchlist.user_id == user_id
        ).first()

        if not watchlist:
            return None

        if tickers is not None:
            watchlist.tickers = json.dumps(tickers)
        if name is not None:
            watchlist.name = name
        if description is not None:
            watchlist.description = description

        db.commit()
        db.refresh(watchlist)

        return watchlist

    @staticmethod
    def delete_watchlist(db: Session, watchlist_id: str, user_id: str) -> bool:
        """
        관심종목 삭제
        """
        watchlist = db.query(Watchlist).filter(
            Watchlist.watchlist_id == watchlist_id,
            Watchlist.user_id == user_id
        ).first()

        if not watchlist:
            return False

        db.delete(watchlist)
        db.commit()

        return True

    # ==================== Portfolio Analytics ====================

    @staticmethod
    def get_portfolio_summary(db: Session, portfolio_id: str, user_id: str) -> Optional[dict]:
        """
        포트폴리오 요약 통계 조회

        Returns:
            총 자산, 총 비용, 미실현 손익, 수익률 등
        """
        portfolio = UserPortfolioService.get_portfolio(db, portfolio_id, user_id)
        if not portfolio:
            return None

        holdings = UserPortfolioService.get_portfolio_holdings(db, portfolio_id)

        total_cost = Decimal('0')
        total_market_value = Decimal('0')

        for holding in holdings:
            if holding.total_cost:
                total_cost += holding.total_cost
            if holding.market_value:
                total_market_value += holding.market_value

        total_unrealized_pnl = total_market_value - total_cost
        total_return_pct = (
            (total_unrealized_pnl / total_cost) * 100
            if total_cost > 0 else Decimal('0')
        )

        return {
            'portfolio_id': portfolio_id,
            'name': portfolio.name,
            'currency': portfolio.currency,
            'total_holdings': len(holdings),
            'total_cost': float(total_cost),
            'total_market_value': float(total_market_value),
            'total_unrealized_pnl': float(total_unrealized_pnl),
            'total_return_pct': float(total_return_pct),
            'last_updated': datetime.utcnow().isoformat()
        }

    @staticmethod
    def get_portfolio_performance(
        db: Session,
        portfolio_id: str,
        user_id: str,
        period: str = '1M'
    ) -> Optional[dict]:
        """
        포트폴리오 성과 데이터 조회

        Args:
            period: 기간 (1D, 1W, 1M, 3M, 6M, 1Y, YTD, ALL)

        Returns:
            일별/월별 수익률 데이터
        """
        from datetime import timedelta

        portfolio = UserPortfolioService.get_portfolio(db, portfolio_id, user_id)
        if not portfolio:
            return None

        # 거래 내역 조회
        transactions = UserPortfolioService.get_portfolio_transactions(db, portfolio_id)

        # 기간 계산
        end_date = datetime.utcnow()
        if period == '1D':
            start_date = end_date - timedelta(days=1)
        elif period == '1W':
            start_date = end_date - timedelta(weeks=1)
        elif period == '1M':
            start_date = end_date - timedelta(days=30)
        elif period == '3M':
            start_date = end_date - timedelta(days=90)
        elif period == '6M':
            start_date = end_date - timedelta(days=180)
        elif period == '1Y':
            start_date = end_date - timedelta(days=365)
        elif period == 'YTD':
            start_date = datetime(end_date.year, 1, 1)
        else:  # ALL
            start_date = portfolio.created_at

        # 기간 내 거래만 필터링
        period_transactions = [
            t for t in transactions
            if start_date <= t.transaction_date <= end_date
        ]

        # 현재 포트폴리오 가치
        summary = UserPortfolioService.get_portfolio_summary(db, portfolio_id, user_id)

        return {
            'portfolio_id': portfolio_id,
            'period': period,
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
            'transaction_count': len(period_transactions),
            'current_value': summary['total_market_value'] if summary else 0,
            'current_return_pct': summary['total_return_pct'] if summary else 0,
            # 추가적인 시계열 데이터는 별도 구현 필요 (일별 스냅샷 테이블)
        }

    @staticmethod
    def calculate_portfolio_allocation(db: Session, portfolio_id: str, user_id: str) -> Optional[list]:
        """
        포트폴리오 자산 배분 비율 계산

        Returns:
            종목별 비중 리스트
        """
        portfolio = UserPortfolioService.get_portfolio(db, portfolio_id, user_id)
        if not portfolio:
            return None

        holdings = UserPortfolioService.get_portfolio_holdings(db, portfolio_id)

        total_market_value = sum(
            holding.market_value for holding in holdings
            if holding.market_value
        ) or Decimal('1')  # Avoid division by zero

        allocation = []
        for holding in holdings:
            if holding.market_value:
                weight = (holding.market_value / total_market_value) * 100
                allocation.append({
                    'ticker_cd': holding.ticker_cd,
                    'market_value': float(holding.market_value),
                    'weight_pct': float(weight),
                    'quantity': float(holding.quantity),
                    'avg_cost': float(holding.avg_cost),
                    'current_price': float(holding.current_price) if holding.current_price else None,
                })

        # 비중 순으로 정렬
        allocation.sort(key=lambda x: x['weight_pct'], reverse=True)

        return allocation
