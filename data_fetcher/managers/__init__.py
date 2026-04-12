"""
Data Fetcher Managers

도메인별 Fetcher 래퍼 클래스 모음.
각 Manager는 동일한 데이터 도메인에 속하는 복수 제공자의 Fetcher를 보유하고,
제공자별로 명시적으로 타입이 지정된 메서드를 제공합니다.

사용 예시:
    from data_fetcher.managers import StockManager, MacroManager

    # 주가 조회
    prices = await StockManager.yahoo_stock_price("AAPL", period="1mo")

    # GDP 조회
    gdp = await MacroManager.fred_gdp_data(start_date="2020-01-01")
"""

from data_fetcher.managers.stock import StockManager
from data_fetcher.managers.company import CompanyManager
from data_fetcher.managers.fundamentals import FundamentalsManager
from data_fetcher.managers.macro import MacroManager
from data_fetcher.managers.market import MarketManager
from data_fetcher.managers.insider import InsiderManager

__all__ = [
    "StockManager",
    "CompanyManager",
    "FundamentalsManager",
    "MacroManager",
    "MarketManager",
    "InsiderManager",
]
