"""
Database package for MarketPulse backend
"""
from .db_dependency import get_db, get_db_sync

__all__ = ['get_db', 'get_db_sync']