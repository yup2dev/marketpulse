"""
data_fetcher.core — fetcher 쪽에 남는 공용 조각

  model_schema  파라미터 스키마 (위젯 폼) — fetcher 의 QueryParams 를 읽는다
  warnings      경고 수집 (add_warning · WarningsCollector)

웹 API 레이어(OBBject · Query · Router · CommandRunner · ProviderInterface · concepts)는
MarketpulseWeb/app/backend/platform/ 에 있다. fetcher 패키지에 다시 만들지 않는다
(tests/test_module_boundaries.py 가 검사).
"""
from data_fetcher.core.warnings import WarningsCollector, add_warning

__all__ = ["WarningsCollector", "add_warning"]
