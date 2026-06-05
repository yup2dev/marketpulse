"""
USER & PORTFOLIO Layer: 앱 도메인 (파이프라인 단계와 무관한 사용자 데이터)

테이블:
- User / Portfolio / Transaction / Holding   : 계정·포트폴리오·거래·보유
- Watchlist / WatchlistItem                  : 관심종목
- Alert / AlertHistory                       : 알림
- SavedScreener                              : 저장된 스크리너
- UserNote / UserWorkspace                   : 메모·워크스페이스 레이아웃
"""
import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Text, Integer, DateTime, Boolean,
    ForeignKey, Index, UniqueConstraint, DECIMAL
)
from sqlalchemy.orm import relationship

from .base import Base


class User(Base):
    """사용자 계정 정보"""
    __tablename__ = 'users'

    user_id = Column(String(50), primary_key=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)

    full_name = Column(String(200))
    is_active = Column(Boolean, default=True, index=True)
    is_verified = Column(Boolean, default=False)
    role = Column(String(20), default='user')

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = Column(DateTime)

    portfolios = relationship("Portfolio", back_populates="user", cascade="all, delete-orphan")
    watchlists = relationship("Watchlist", back_populates="user", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="user", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_user_email', 'email'),
        Index('idx_user_username', 'username'),
        Index('idx_user_active', 'is_active'),
    )

    def to_dict(self) -> dict:
        return {
            'user_id': self.user_id,
            'email': self.email,
            'username': self.username,
            'full_name': self.full_name,
            'is_active': self.is_active,
            'is_verified': self.is_verified,
            'role': self.role,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None
        }


class Portfolio(Base):
    """사용자 포트폴리오"""
    __tablename__ = 'portfolios'

    portfolio_id = Column(String(50), primary_key=True)
    user_id = Column(String(50), ForeignKey('users.user_id'), nullable=False, index=True)

    name = Column(String(200), nullable=False)
    description = Column(Text)
    currency = Column(String(10), default='USD')
    is_default = Column(Boolean, default=False)

    benchmark = Column(String(20))
    rebalance_frequency = Column(String(20))

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="portfolios")
    holdings = relationship("Holding", back_populates="portfolio", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="portfolio", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_portfolio_user', 'user_id'),
        Index('idx_portfolio_default', 'user_id', 'is_default'),
    )

    def to_dict(self) -> dict:
        return {
            'portfolio_id': self.portfolio_id,
            'user_id': self.user_id,
            'name': self.name,
            'description': self.description,
            'currency': self.currency,
            'is_default': self.is_default,
            'benchmark': self.benchmark,
            'rebalance_frequency': self.rebalance_frequency,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class Transaction(Base):
    """거래 기록"""
    __tablename__ = 'transactions'

    transaction_id = Column(String(50), primary_key=True)
    portfolio_id = Column(String(50), ForeignKey('portfolios.portfolio_id'), nullable=False, index=True)

    ticker_cd = Column(String(20), nullable=False, index=True)
    transaction_type = Column(String(20), nullable=False)
    quantity = Column(DECIMAL(20, 8), nullable=False)
    price = Column(DECIMAL(20, 4), nullable=False)
    commission = Column(DECIMAL(20, 4), default=0)
    tax = Column(DECIMAL(20, 4), default=0)
    total_amount = Column(DECIMAL(20, 4))

    transaction_date = Column(DateTime, nullable=False, index=True)
    notes = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    portfolio = relationship("Portfolio", back_populates="transactions")

    __table_args__ = (
        Index('idx_transaction_portfolio', 'portfolio_id'),
        Index('idx_transaction_ticker', 'ticker_cd'),
        Index('idx_transaction_date', 'transaction_date'),
        Index('idx_transaction_type', 'transaction_type'),
    )

    def to_dict(self) -> dict:
        return {
            'transaction_id': self.transaction_id,
            'portfolio_id': self.portfolio_id,
            'ticker_cd': self.ticker_cd,
            'transaction_type': self.transaction_type,
            'quantity': float(self.quantity) if self.quantity else None,
            'price': float(self.price) if self.price else None,
            'commission': float(self.commission) if self.commission else None,
            'tax': float(self.tax) if self.tax else None,
            'total_amount': float(self.total_amount) if self.total_amount else None,
            'transaction_date': self.transaction_date.isoformat() if self.transaction_date else None,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Holding(Base):
    """현재 보유 종목"""
    __tablename__ = 'holdings'

    holding_id = Column(String(50), primary_key=True)
    portfolio_id = Column(String(50), ForeignKey('portfolios.portfolio_id'), nullable=False, index=True)

    ticker_cd = Column(String(20), nullable=False, index=True)
    quantity = Column(DECIMAL(20, 8), nullable=False)
    avg_cost = Column(DECIMAL(20, 4), nullable=False)
    current_price = Column(DECIMAL(20, 4))

    total_cost = Column(DECIMAL(20, 4))
    market_value = Column(DECIMAL(20, 4))
    unrealized_pnl = Column(DECIMAL(20, 4))
    unrealized_pnl_pct = Column(DECIMAL(10, 4))

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    portfolio = relationship("Portfolio", back_populates="holdings")

    __table_args__ = (
        UniqueConstraint('portfolio_id', 'ticker_cd', name='uq_portfolio_ticker'),
        Index('idx_holding_portfolio', 'portfolio_id'),
        Index('idx_holding_ticker', 'ticker_cd'),
    )

    def to_dict(self) -> dict:
        return {
            'holding_id': self.holding_id,
            'portfolio_id': self.portfolio_id,
            'ticker_cd': self.ticker_cd,
            'quantity': float(self.quantity) if self.quantity else None,
            'avg_cost': float(self.avg_cost) if self.avg_cost else None,
            'current_price': float(self.current_price) if self.current_price else None,
            'total_cost': float(self.total_cost) if self.total_cost else None,
            'market_value': float(self.market_value) if self.market_value else None,
            'unrealized_pnl': float(self.unrealized_pnl) if self.unrealized_pnl else None,
            'unrealized_pnl_pct': float(self.unrealized_pnl_pct) if self.unrealized_pnl_pct else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class Watchlist(Base):
    """관심 종목 리스트"""
    __tablename__ = 'watchlists'

    watchlist_id = Column(String(50), primary_key=True)
    user_id = Column(String(50), ForeignKey('users.user_id'), nullable=False, index=True)

    name = Column(String(200), nullable=False, default='기본 관심종목')
    description = Column(Text)
    tickers = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="watchlists")
    items = relationship(
        "WatchlistItem", back_populates="watchlist",
        cascade="all, delete-orphan", order_by="WatchlistItem.sort_order"
    )

    __table_args__ = (
        Index('idx_watchlist_user', 'user_id'),
    )

    def to_dict(self) -> dict:
        import json
        tickers_list = []
        if self.items:
            tickers_list = [item.ticker_cd for item in self.items]
        elif self.tickers:
            tickers_list = json.loads(self.tickers)
        return {
            'watchlist_id': self.watchlist_id,
            'user_id': self.user_id,
            'name': self.name,
            'description': self.description,
            'tickers': tickers_list,
            'items': [item.to_dict() for item in self.items] if self.items else [],
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class WatchlistItem(Base):
    """관심 종목 항목"""
    __tablename__ = 'watchlist_items'

    item_id = Column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    watchlist_id = Column(String(50), ForeignKey('watchlists.watchlist_id'), nullable=False, index=True)
    ticker_cd = Column(String(20), nullable=False, index=True)

    sort_order = Column(Integer, default=0, index=True)
    notes = Column(Text)
    added_at = Column(DateTime, default=datetime.utcnow)

    watchlist = relationship("Watchlist", back_populates="items")

    __table_args__ = (
        UniqueConstraint('watchlist_id', 'ticker_cd', name='uq_watchlist_ticker'),
        Index('idx_watchlist_items_watchlist', 'watchlist_id', 'sort_order'),
        Index('idx_watchlist_items_ticker', 'ticker_cd'),
    )

    def to_dict(self) -> dict:
        return {
            'item_id': self.item_id,
            'watchlist_id': self.watchlist_id,
            'ticker_cd': self.ticker_cd,
            'sort_order': self.sort_order,
            'notes': self.notes,
            'added_at': self.added_at.isoformat() if self.added_at else None
        }


class Alert(Base):
    """가격/뉴스 알림"""
    __tablename__ = 'alerts'

    alert_id = Column(String(50), primary_key=True)
    user_id = Column(String(50), ForeignKey('users.user_id'), nullable=False, index=True)

    alert_type = Column(String(20), nullable=False, index=True)
    ticker_cd = Column(String(20), index=True)

    condition_type = Column(String(20))
    threshold_value = Column(DECIMAL(20, 4))

    is_active = Column(Boolean, default=True, index=True)
    notification_method = Column(String(50), default='email')
    message = Column(Text)

    last_triggered = Column(DateTime)
    trigger_count = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="alerts")

    __table_args__ = (
        Index('idx_alert_user', 'user_id'),
        Index('idx_alert_type', 'alert_type'),
        Index('idx_alert_ticker', 'ticker_cd'),
        Index('idx_alert_active', 'is_active'),
    )

    def to_dict(self) -> dict:
        return {
            'alert_id': self.alert_id,
            'user_id': self.user_id,
            'alert_type': self.alert_type,
            'ticker_cd': self.ticker_cd,
            'condition_type': self.condition_type,
            'threshold_value': float(self.threshold_value) if self.threshold_value else None,
            'is_active': self.is_active,
            'notification_method': self.notification_method,
            'message': self.message,
            'last_triggered': self.last_triggered.isoformat() if self.last_triggered else None,
            'trigger_count': self.trigger_count,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class AlertHistory(Base):
    """알림 발생 이력"""
    __tablename__ = 'alert_history'

    history_id = Column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    alert_id = Column(String(50), ForeignKey('alerts.alert_id'), nullable=False, index=True)

    triggered_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    triggered_value = Column(DECIMAL(20, 4))
    message = Column(Text)
    is_sent = Column(Boolean, default=False)

    __table_args__ = (
        Index('idx_alert_history_alert', 'alert_id'),
        Index('idx_alert_history_triggered', 'triggered_at'),
    )

    def to_dict(self) -> dict:
        return {
            'history_id': self.history_id,
            'alert_id': self.alert_id,
            'triggered_at': self.triggered_at.isoformat() if self.triggered_at else None,
            'triggered_value': float(self.triggered_value) if self.triggered_value else None,
            'message': self.message,
            'is_sent': self.is_sent
        }


class SavedScreener(Base):
    """저장된 스크리너 조건"""
    __tablename__ = 'saved_screeners'

    screener_id = Column(String(50), primary_key=True)
    user_id = Column(String(50), ForeignKey('users.user_id'), nullable=False, index=True)

    name = Column(String(200), nullable=False)
    description = Column(Text)
    filters = Column(Text, nullable=False)

    is_active = Column(Boolean, default=True)
    run_frequency = Column(String(20))

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_run = Column(DateTime)

    __table_args__ = (
        Index('idx_screener_user', 'user_id'),
        Index('idx_screener_active', 'is_active'),
    )

    def to_dict(self) -> dict:
        import json
        return {
            'screener_id': self.screener_id,
            'user_id': self.user_id,
            'name': self.name,
            'description': self.description,
            'filters': json.loads(self.filters) if self.filters else {},
            'is_active': self.is_active,
            'run_frequency': self.run_frequency,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_run': self.last_run.isoformat() if self.last_run else None
        }


class UserNote(Base):
    """사용자 메모"""
    __tablename__ = 'user_notes'

    note_id = Column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(50), ForeignKey('users.user_id'), nullable=False, index=True)
    ticker_cd = Column(String(20), index=True)
    title = Column(String(200))
    content = Column(Text, nullable=False, default='')
    color = Column(String(20), default='default')
    pinned = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")

    __table_args__ = (
        Index('idx_note_user', 'user_id'),
        Index('idx_note_ticker', 'user_id', 'ticker_cd'),
    )

    def to_dict(self) -> dict:
        return {
            'note_id': self.note_id,
            'user_id': self.user_id,
            'ticker_cd': self.ticker_cd,
            'title': self.title,
            'content': self.content,
            'color': self.color,
            'pinned': self.pinned,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class UserWorkspace(Base):
    """사용자 워크스페이스 레이아웃 저장"""
    __tablename__ = 'user_workspaces'

    id = Column(String(50), primary_key=True)
    user_id = Column(String(50), ForeignKey('users.user_id'), nullable=False, index=True)
    screen = Column(String(50), nullable=False)
    name = Column(String(200), nullable=False)
    is_default = Column(Boolean, default=False)
    layout = Column(Text)   # JSON: react-grid-layout positions
    widgets = Column(Text)  # JSON: widget configs + state

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")

    __table_args__ = (
        Index('idx_workspace_user_screen', 'user_id', 'screen'),
    )

    def to_dict(self) -> dict:
        import json
        return {
            'id': self.id,
            'user_id': self.user_id,
            'screen': self.screen,
            'name': self.name,
            'is_default': self.is_default,
            'layout': json.loads(self.layout) if self.layout else [],
            'widgets': json.loads(self.widgets) if self.widgets else [],
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


__all__ = [
    "User",
    "Portfolio",
    "Transaction",
    "Holding",
    "Watchlist",
    "WatchlistItem",
    "Alert",
    "AlertHistory",
    "SavedScreener",
    "UserNote",
    "UserWorkspace",
]
