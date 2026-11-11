"""
USER & PORTFOLIO Layer: 앱 도메인 (파이프라인 단계와 무관한 사용자 데이터)

테이블:
- User / Portfolio / Transaction / Holding   : 계정·포트폴리오·거래·보유
- Watchlist / WatchlistItem                  : 관심종목
- Alert / AlertHistory                       : 알림
- SavedScreener                              : 저장된 스크리너
- UserNote / UserWorkspace                   : 메모·워크스페이스 레이아웃
- UserBacktestItem / UserBacktestRun         : 백테스트 변수·이벤트·전략 정의 / 실행 결과
- UserWidget (+Param / Field / Screen)       : 사용자 정의 위젯 (API → 매핑 → 위젯 → 화면 등록)
- WidgetType / UserWidgetPref(+Screen)       : 위젯 종류 목록(관리자) / 기본 제공 위젯의 사용자별 설정
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


class UserApiKey(Base):
    """사용자별 provider API 키 (암호화 저장).

    key-only provider(FRED/FMP/Polygon/AlphaVantage/KIS)는 서버에서 이 키로 호출한다.
    enc_value는 Fertnet 대칭암호화된 JSON 문자열(단일 키 또는 {field: value} 다중 필드)이다.
    원문 키는 절대 평문으로 저장/응답하지 않는다(조회 시 마스킹).
    """
    __tablename__ = 'user_api_keys'

    user_id = Column(String(50), ForeignKey('users.user_id', ondelete='CASCADE'),
                     primary_key=True)
    provider = Column(String(50), primary_key=True)
    enc_value = Column(Text, nullable=False)   # Fernet 암호문 (JSON 평문을 암호화)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index('idx_user_api_keys_user', 'user_id'),
    )


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


class UserBacktestItem(Base):
    """사용자 백테스트 정의 — 변수(variable) / 이벤트(event) / 전략(strategy).

    계산은 브라우저 엔진이 하고 서버는 정의만 저장한다(운영 서버 메모리 보호).
    spec 은 kind 별 JSON: variable={type: source|formula, ...}, event={type: manual|condition, ...},
    strategy={asset, entry, exit, ...}. variable/event 의 name 은 수식 식별자로 쓰여 사용자·kind 내 유일.
    """
    __tablename__ = 'user_backtest_items'

    item_id = Column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(50), ForeignKey('users.user_id'), nullable=False, index=True)
    kind = Column(String(20), nullable=False)
    name = Column(String(80), nullable=False)
    description = Column(String(500))
    spec = Column(Text, nullable=False, default='{}')

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('user_id', 'kind', 'name', name='uq_bt_item_user_kind_name'),
        Index('idx_bt_item_user_kind', 'user_id', 'kind'),
    )

    def to_dict(self) -> dict:
        import json
        return {
            'item_id': self.item_id,
            'kind': self.kind,
            'name': self.name,
            'description': self.description,
            'spec': json.loads(self.spec) if self.spec else {},
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class UserBacktestRun(Base):
    """사용자 백테스트 실행 결과 스냅샷 — 설정·성과지표·자산곡선(다운샘플)·거래내역."""
    __tablename__ = 'user_backtest_runs'

    run_id = Column(String(50), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(50), ForeignKey('users.user_id'), nullable=False, index=True)
    strategy_id = Column(String(50), index=True)
    name = Column(String(200), nullable=False)
    config = Column(Text, nullable=False, default='{}')
    metrics = Column(Text, nullable=False, default='{}')
    equity = Column(Text, nullable=False, default='[]')
    trades = Column(Text, nullable=False, default='[]')

    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    def to_dict(self, full: bool = True) -> dict:
        import json
        d = {
            'run_id': self.run_id,
            'strategy_id': self.strategy_id,
            'name': self.name,
            'config': json.loads(self.config) if self.config else {},
            'metrics': json.loads(self.metrics) if self.metrics else {},
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if full:
            d['equity'] = json.loads(self.equity) if self.equity else []
            d['trades'] = json.loads(self.trades) if self.trades else []
        return d


# ── 사용자 정의 위젯 (API → 매핑 → 위젯) ──────────────────────────────────────
#
# 설정을 JSON 한 덩어리로 두지 않고 관심사별 행으로 쪼갠다 (스케줄러 설정 DB 방식):
#
#   user_widgets         마스터 — 어떤 API 를 어떤 위젯으로 볼 것인가        (≈ 작업 기본)
#   user_widget_params   API 파라미터 — 고정값 / 화면 변수 / 사용자 입력      (≈ 작업 파라미터·변수)
#   user_widget_fields   매핑 — 응답 필드를 위젯의 어느 자리에 쓸 것인가
#   user_widget_screens  화면 등록 — 어느 화면의 위젯 메뉴에 내놓을 것인가
#
# 위젯 목록 쪽 설정도 같은 방식이다:
#
#   widget_types              위젯 종류 목록 — 관리자가 이름·사용 여부·순서를 관리   (≈ 공통 코드)
#   user_widget_prefs         기본 제공 위젯의 사용자별 사용 여부
#   user_widget_pref_screens  기본 제공 위젯을 내놓을 화면 (행이 없으면 코드의 기본 배치)
#
# 나머지 선택지(바인딩·필드 역할·표시 형식·그리는 방식)는 고정 코드값이고, 목록은
# services/user_widget_service.CODES 한 곳에 있다.

class WidgetType(Base):
    """위젯 종류 — 설정 화면 ③단계 '보여 줄 위젯' 의 목록. 모든 사용자가 같이 쓴다.

    renderer 는 실제로 그리는 방식(코드 RENDERER: table·line·bar·kv …)이다. 그리는 코드는
    프론트에 있으므로 종류를 새로 만들 때도 renderer 는 이미 있는 것 중에서 고른다.
    """
    __tablename__ = 'widget_types'

    type_code = Column(String(30), primary_key=True)
    name = Column(String(100), nullable=False)
    renderer = Column(String(20), nullable=False)
    use_yn = Column(String(1), nullable=False, default='Y')     # N 이면 새 위젯에서 고를 수 없다
    sort_seq = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UserWidgetPref(Base):
    """기본 제공 위젯(코드에 정의된 위젯)의 사용자별 설정. 기본값과 같으면 행을 두지 않는다."""
    __tablename__ = 'user_widget_prefs'

    user_id = Column(String(50), ForeignKey('users.user_id'), primary_key=True)
    widget_type = Column(String(100), primary_key=True)        # 프론트 레지스트리의 위젯 id
    use_yn = Column(String(1), nullable=False, default='Y')    # N 이면 위젯 메뉴에서 숨김
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UserWidgetPrefScreen(Base):
    """기본 제공 위젯을 내놓을 화면. 한 위젯에 행이 하나라도 있으면 그 화면들에서만 메뉴에 나온다."""
    __tablename__ = 'user_widget_pref_screens'

    user_id = Column(String(50), ForeignKey('users.user_id'), primary_key=True)
    widget_type = Column(String(100), primary_key=True)
    screen = Column(String(50), primary_key=True)


class UserWidget(Base):
    """사용자 정의 위젯 마스터."""
    __tablename__ = 'user_widgets'

    widget_id = Column(String(50), primary_key=True)
    user_id = Column(String(50), ForeignKey('users.user_id'), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    description = Column(String(500))
    group_name = Column(String(100))                 # 위젯 메뉴 안에서의 분류
    provider = Column(String(50), nullable=False)    # API = /api/data/{provider}/{model}
    model = Column(String(100), nullable=False)
    view_type = Column(String(30), nullable=False, default='table')   # widget_types.type_code
    use_yn = Column(String(1), nullable=False, default='Y')           # N 이면 메뉴에서 숨김
    sort_seq = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    params = relationship(
        "UserWidgetParam", cascade="all, delete-orphan", order_by="UserWidgetParam.param_seq",
    )
    fields = relationship(
        "UserWidgetField", cascade="all, delete-orphan", order_by="UserWidgetField.field_seq",
    )
    screens = relationship("UserWidgetScreen", cascade="all, delete-orphan")

    def to_dict(self) -> dict:
        return {
            'widget_id': self.widget_id,
            'name': self.name,
            'description': self.description,
            'group_name': self.group_name,
            'provider': self.provider,
            'model': self.model,
            'view_type': self.view_type,
            'use_yn': self.use_yn,
            'sort_seq': self.sort_seq,
            'params': [p.to_dict() for p in self.params],
            'fields': [f.to_dict() for f in self.fields],
            'screens': sorted(s.screen for s in self.screens),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class UserWidgetParam(Base):
    """위젯이 API 를 부를 때 넘길 파라미터 한 개.

    bind_type (코드 BIND_TYPE):
        FIXED  param_value 를 그대로 보낸다
        VAR    화면 변수(var_name: symbol·period)의 현재 값을 보낸다. param_value 는 기본값
        INPUT  위젯 헤더에서 사용자가 바꿀 수 있다. param_value 는 기본값
    """
    __tablename__ = 'user_widget_params'

    widget_id = Column(String(50), ForeignKey('user_widgets.widget_id'), primary_key=True)
    param_seq = Column(Integer, primary_key=True)
    param_name = Column(String(100), nullable=False)
    bind_type = Column(String(10), nullable=False, default='FIXED')
    param_value = Column(String(500))
    var_name = Column(String(50))

    def to_dict(self) -> dict:
        return {
            'param_name': self.param_name,
            'bind_type': self.bind_type,
            'param_value': self.param_value,
            'var_name': self.var_name,
        }


class UserWidgetField(Base):
    """응답 필드 한 개의 매핑. field_seq 가 표시 순서다.

    field_role (코드 FIELD_ROLE): X(차트 가로축) · Y(차트 값) · PRIMARY(요약 타일) ·
    COLUMN(표 컬럼) · HIDDEN(숨김).  format 은 코드 FIELD_FORMAT.
    """
    __tablename__ = 'user_widget_fields'

    widget_id = Column(String(50), ForeignKey('user_widgets.widget_id'), primary_key=True)
    field_seq = Column(Integer, primary_key=True)
    field_name = Column(String(100), nullable=False)
    field_role = Column(String(10), nullable=False, default='COLUMN')
    label = Column(String(200))
    format = Column(String(20), nullable=False, default='auto')

    def to_dict(self) -> dict:
        return {
            'field_name': self.field_name,
            'field_role': self.field_role,
            'label': self.label,
            'format': self.format,
        }


class UserWidgetScreen(Base):
    """위젯을 내놓을 화면. screen 은 화면 경로('/', '/stock' …) 또는 '*'(모든 화면)."""
    __tablename__ = 'user_widget_screens'

    widget_id = Column(String(50), ForeignKey('user_widgets.widget_id'), primary_key=True)
    screen = Column(String(50), primary_key=True)


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
    "UserBacktestItem",
    "UserBacktestRun",
    "UserWidget",
    "UserWidgetParam",
    "UserWidgetField",
    "UserWidgetScreen",
    "WidgetType",
    "UserWidgetPref",
    "UserWidgetPrefScreen",
]
