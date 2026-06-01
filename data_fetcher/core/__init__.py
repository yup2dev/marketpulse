"""
data_fetcher.core — API 레이어 핵심 추상화

OBBject, Query, CommandRouter — 라우트와 QueryExecutor 사이의 브리지.
"""
from data_fetcher.core.obbject import OBBject
from data_fetcher.core.query import Query, _command_model
from data_fetcher.core.router import CommandRouter
from data_fetcher.core.warnings import WarningsCollector, add_warning

__all__ = [
    "OBBject",
    "Query",
    "CommandRouter",
    "WarningsCollector",
    "add_warning",
    "_command_model",
]
