"""데이터 도메인 — OpenBB 확장처럼 도메인마다 한 패키지 (commands/<도메인>/).

    router.py   @router.command 선언 — URL · 요청 파라미터 · 받을 입력(inputs = Fetch(provider, model, …))
    그 밖 모듈  로직 — 계산 모듈은 행을 받아 계산만 한다(provider 를 모른다), 데이터 접근 모듈은 적재 DB 를 읽는다

단순 조회는 command 를 만들지 않는다 — 게이트웨이 /api/data/{provider}/{model}.
inputs 는 CommandRunner(app.backend.platform)가 병렬로 받고, 캐시는 입력마다 실행 계층(core/execution)의 모델별 TTL.
등록은 api/routers.py 의 add_command_map 한 곳. 앱 기능(인증 · 알림 · 관심종목 …)은 아직 api/routes · services.
"""
