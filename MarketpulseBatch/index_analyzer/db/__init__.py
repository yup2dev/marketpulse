"""배치 전용 DB 계층 — 로컬 적재 DB(data/marketpulse.db)의 ORM 과 엔진.

웹(MarketpulseWeb)과 코드를 공유하지 않는다. 같은 테이블을 웹도 따로 정의하는데,
둘 사이의 계약은 ORM 이 아니라 /api/ingest 요청 형식이다.
컬럼이 어긋나면 tests/test_ingest_contract.py 가 잡는다.
"""
