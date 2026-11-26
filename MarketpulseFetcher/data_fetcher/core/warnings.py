"""경고 수집기 — 구현은 provider 계층(data_fetcher.utils.warnings)에 있다. app 계층은 그대로 쓴다.

provider 계층(순수 QueryExecutor · fetcher)이 app 계층을 import 하지 않게 구현을 아래로 내렸다 (의존은 app → provider).
"""
from data_fetcher.utils.warnings import WarningsCollector, add_warning

__all__ = ["WarningsCollector", "add_warning"]
