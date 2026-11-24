"""FRED Helpers — 상수 (HTTP 없음).

HTTP 는 models/generic_series.py 의 FREDGenericSeriesFetcher 한 곳에서만 한다 (OpenBB fred 와 같은 구조).
지표 모델은 series_id 를 골라 FREDGenericSeriesFetcher.fetch_data 를 부른다.
날짜 기준 전년비는 utils/yoy.py.
"""

FRED_BASE_URL = "https://api.stlouisfed.org/fred"
FRED_SERIES_OBSERVATIONS_URL = f"{FRED_BASE_URL}/series/observations"
