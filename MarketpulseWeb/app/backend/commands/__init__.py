"""분석 command — 표준 모델 데이터를 받아 계산하고 출력 모델로 돌려준다.

fetcher 는 provider 하나의 응답을 표준 모델로 맞추기만 한다. 그 뒤의 분석(파생 지표 · 증감률 ·
여러 모델 조합)은 provider 가 바뀌어도 같은 계산이라 여기 둔다 (OpenBB 의 기술 지표 · 계량 분석 명령과 같은 자리).

  - command 는 provider 이름을 모른다. 어떤 provider · model 을 부를지는 라우트가 Source 로 넘긴다
    (tests/test_module_boundaries.py 가 검사).
  - 분석이 없는 단순 조회(history · db 테이블 읽기)는 command 를 거치지 않고 라우트가 QueryExecutor 를 바로 부른다.
  - 여러 출처는 asyncio.gather 로 병렬로 부르고, 캐시는 출처마다 QueryExecutor 의 모델별 TTL 이 맡는다.
"""
