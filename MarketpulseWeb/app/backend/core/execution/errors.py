"""실행 계층 오류 — fetcher 패키지에는 없는, 서버에서만 생기는 경우."""
from data_fetcher.query_executor import QueryExecutorError


class MissingCredentialsError(QueryExecutorError):
    """로그인 사용자가 키 필요 provider 의 키를 등록하지 않음 — 프론트가 '키 등록' 안내를 띄운다 (424)."""

    def __init__(self, provider: str):
        self.provider = provider
        super().__init__(f"'{provider}' API 키가 설정되지 않았습니다. 설정에서 키를 등록하세요.")


class RemoteUnavailableError(QueryExecutorError):
    """로컬 전용 조회를 맡을 PC Fetcher 에 닿을 수 없음 (워커 미접속 · 타임아웃 · 끊김 · 로그인 없음) — 503.

    서버 직접 실행으로 넘기지 않는다. 프론트가 'Fetcher 실행' 안내를 띄운다.
    워커가 실행했는데 실패한 경우(예: 사용자 키 미설정)는 이 오류가 아니라 QueryExecutorError 다.
    """
