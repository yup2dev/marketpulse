"""MarketPulse 공통 패키지 — Web·Batch·Fetcher 가 함께 쓰는 ORM, DB 세션, 경로, 로깅.

의존 방향: Web → Fetcher → Common, Batch → Fetcher → Common.
이 패키지는 다른 MarketPulse 패키지(app, data_fetcher, index_analyzer)를 import 하지 않는다.
"""
