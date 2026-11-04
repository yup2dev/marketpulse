"""선언형 provider — JSON 스펙만으로 REST API provider를 등록한다 (Python 코드 없음).

specs/*.json 하나가 provider 하나다. providers_init 이 import 시점에
register_declarative_providers() 로 읽어 ProviderRegistry 에 올리므로, 서버와 Fetcher(exe)
양쪽에 같은 provider 가 생긴다. 이후 경로는 코드 provider 와 동일하다:
/api/data/{provider}/{model}, /schema 파라미터 폼, 사용자 키(BYOK), concepts 매핑.

스펙 형식 (specs/ecos.json 참고):

    {
      "name": "ecos", "description": "...", "website": "...", "group": "macro",
      "credentials": ["api_key"],              # 없으면 무인증
      "models": {
        "series": {
          "description": "...",
          "url": "https://host/{api_key}/{stat_code}/{start_date|period:cycle}",
          "params": {                          # → QueryParams (pydantic) 자동 생성
            "stat_code":  {"type": "str", "required": true, "description": "..."},
            "cycle":      {"type": "str", "default": "M", "choices": ["D", "M", "Q", "A"]},
            "start_date": {"type": "date", "default": "-10y"},   # 상대일(-Ny/-Nm/-Nd) | today
            "limit":      {"type": "int", "default": 10000}
          },
          "records": "Root.row",               # 응답에서 행 배열까지의 dotted path
          "error": {"path": "RESULT", "code": "CODE", "message": "MESSAGE",
                    "empty_codes": ["INFO-200"]},   # 이 코드는 오류가 아니라 '데이터 없음'
          "fields": {                          # → Data 모델 (출력 필드 ← 원본 필드)
            "date":  {"from": "TIME", "parse": "period"},   # 202401 / 2024Q1 / 2024 / 20240115
            "value": {"from": "DATA_VALUE", "type": "float"},
            "unit":  {"from": "UNIT_NAME"}
          }
        }
      }
    }

URL 치환: {name} 은 파라미터(또는 자격증명) 값, {start_date|period:cycle} 은 날짜를 cycle
파라미터 값(D/M/Q/A)에 맞는 기간 문자열(20240115 / 202401 / 2024Q1 / 2024)로 바꾼다.
"""
from data_fetcher.providers.declarative.loader import (  # noqa: F401
    build_provider,
    load_specs,
    register_declarative_providers,
)
