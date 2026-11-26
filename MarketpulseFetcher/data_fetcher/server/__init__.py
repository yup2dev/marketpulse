"""
PC Fetcher 의 서버 쪽 — 웹 서버가 넘긴 로컬 전용 조회를 이 PC 에서 실행한다.

    웹 서버 ──/ws/fetcher (PC 가 먼저 접속)──▶ ws_worker ──▶ runner(QueryExecutor, TET 전체) ──▶ {data, metadata}
    브라우저 ──127.0.0.1:8765──▶ rest   /health · /user-token · /shutdown (관리용 — 데이터는 받지 않는다)

데이터는 항상 웹 서버를 거친다. 브라우저가 Fetcher 에서 데이터를 받아 서버로 넘기는 구조는 쓰지 않는다.

모듈:
    ws_worker  /ws/fetcher 워커 — fetch 요청 처리 (운영 경로)
    runner     조회 한 번 (순수 QueryExecutor + 이 PC 의 키)
    rest       FastAPI 앱 팩토리 — 관리 엔드포인트 + /fetch (서버 · Fetcher 가 같은 PC 인 개발용 pull 모드)
    keystore   API 키 로컬 저장 + os.environ 주입
    cache      QueryExecutor용 인메모리 TTL 캐시
    serialize  조회 결과 → JSON-safe 봉투
"""
from data_fetcher.server.rest import create_app

__all__ = ["create_app"]
