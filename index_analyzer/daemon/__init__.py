"""
Daemon Module

Redis Stream 기반 데몬 실행
"""

# Worker is now a module, not a class
from index_analyzer.daemon import redis_bus

__all__ = ['redis_bus']
