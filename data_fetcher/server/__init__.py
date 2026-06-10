"""
Fetcher 로컬 REST 서버 (browser-mediated 구조).

로컬 PC에 상주하며, 같은 PC의 브라우저가 localhost로 직접 호출한다.
API 키를 보유하고 외부 provider(FMP 등)를 조회해 raw 데이터를 반환한다.

    브라우저 ──localhost──▶ Fetcher REST ──▶ 외부 provider ──▶ raw
    (브라우저가 raw를 받아 외부 WebServer /api/calc 로 전달)

모듈:
    rest       FastAPI 앱 팩토리 (CORS + 엔드포인트)
    keystore   API 키 로컬 저장 + os.environ 주입
    cache      QueryExecutor용 인메모리 TTL 캐시
    serialize  조회 결과 → JSON-safe 봉투
"""
from data_fetcher.server.rest import create_app

__all__ = ["create_app"]
