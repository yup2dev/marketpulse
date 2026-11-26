"""command 계층 — 라우트와 실행 계층 사이 (OpenBB openbb_core.app 대응).

OBBject · Query · Router(@router.command) · CommandRunner · ProviderInterface.
fetcher 패키지(MarketpulseFetcher/data_fetcher)는 이 계층을 모른다 — provider 응답을 표준 모델로 맞추는
순수 실행(QueryExecutor)까지만 한다. 이 계층은 웹 서버만 쓰므로 웹에 둔다 (아키텍처 가이드 v9.1 A7).
"""
from data_fetcher.utils.warnings import WarningsCollector, add_warning

from app.backend.core.command.obbject import OBBject
from app.backend.core.command.query import Query, _command_model
from app.backend.core.command.command_runner import CommandRunner, Fetch
from app.backend.core.command.provider_interface import ProviderInterface
from app.backend.core.command.router import Router

__all__ = [
    "OBBject",
    "Query",
    "Router",
    "CommandRunner",
    "Fetch",
    "ProviderInterface",
    "WarningsCollector",
    "add_warning",
    "_command_model",
]
