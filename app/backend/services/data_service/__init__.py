"""
DataService package.

Backward-compatible import:
    from app.backend.services.data_service import data_service
"""
from ._base import DataServiceBase
from .price import PriceMixin
from .company import CompanyMixin
from .financials import FinancialsMixin
from .holders import HoldersMixin
from .market import MarketMixin
from .economics import EconomicsMixin


class DataService(
    PriceMixin,
    CompanyMixin,
    FinancialsMixin,
    HoldersMixin,
    MarketMixin,
    EconomicsMixin,
    DataServiceBase,
):
    """Unified data service for fetching market data."""


data_service = DataService()

__all__ = ['DataService', 'data_service']
