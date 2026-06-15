"""Provider 공통 예외/경고 (OpenBB 이식 provider 용).

OpenBB 의 OpenBBError/OpenBBWarning/EmptyDataError/UnauthorizedError 에 대응.
이식한 provider 코드가 이름 그대로 import 하므로 동일 이름으로 둔다.
"""


class OpenBBError(Exception):
    """Provider 공통 예외."""


class EmptyDataError(Exception):
    """요청 결과가 비어있을 때."""

    def __init__(self, message: str = "The request was returned empty."):
        self.message = message
        super().__init__(self.message)


class UnauthorizedError(Exception):
    """인증 실패 (잘못된 API 키 등)."""

    def __init__(self, message: str = "Unauthorized."):
        self.message = message
        super().__init__(self.message)


class OpenBBWarning(Warning):
    """Provider 공통 경고."""


__all__ = ["OpenBBError", "EmptyDataError", "UnauthorizedError", "OpenBBWarning"]
