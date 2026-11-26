"""
app.backend.platform — 웹 API 레이어 핵심 (OpenBB openbb_core 대응)

OBBject · Query · Router(@router.command) · CommandRunner · ProviderInterface — 라우트와 실행 계층 사이.
concepts(지표 개념 → provider 구현)도 Query 로 조회하므로 여기 둔다.
웹에서만 쓰는 코드라 fetcher 패키지(data_fetcher)가 아니라 여기 둔다. PC exe 에는 들어가지 않는다.
경고 수집(add_warning · WarningsCollector)은 data_fetcher.core.warnings 에 있고 여기서 다시 내보낸다.
"""
from data_fetcher.core.warnings import WarningsCollector, add_warning

from app.backend.platform.obbject import OBBject
from app.backend.platform.query import Query, _command_model
from app.backend.platform.command_runner import CommandRunner, Fetch
from app.backend.platform.provider_interface import ProviderInterface
from app.backend.platform.router import Router

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
