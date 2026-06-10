class FetcherError(Exception):
    pass


class ProviderError(FetcherError):
    pass


class APIError(ProviderError):
    def __init__(self, provider: str, status_code: int, message: str):
        self.provider = provider
        self.status_code = status_code
        super().__init__(f"{provider} API Error ({status_code}): {message}")


class RateLimitError(APIError):
    pass


class AuthenticationError(APIError):
    pass


class DataValidationError(FetcherError):
    pass


class NetworkError(FetcherError):
    pass
