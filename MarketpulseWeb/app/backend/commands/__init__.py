"""분석 command — 표준 모델 데이터를 받아 계산하고 출력 모델로 돌려준다.

fetcher 는 provider 하나의 응답을 표준 모델로 맞추기만 한다. 그 뒤의 분석(파생 지표 · 증감률 ·
여러 모델 조합)은 provider 가 바뀌어도 같은 계산이라 여기 둔다 (OpenBB 의 기술 지표 · 계량 분석 명령과 같은 자리).

  - command 는 provider 이름을 모른다. 어떤 provider · model 을 받을지는 라우터의 command inputs(Fetch)가 정하고
    조회는 CommandRunner 가 한다 (data_fetcher.core) — 여기 함수는 행을 받아 계산만 한다
    (tests/test_module_boundaries.py 가 검사).
  - 분석이 없는 단순 조회는 command 를 만들지 않는다 — 게이트웨이 /api/data/{provider}/{model}.
  - inputs 는 CommandRunner 가 병렬로 받고, 캐시는 입력마다 QueryExecutor 의 모델별 TTL 이 맡는다.
"""
