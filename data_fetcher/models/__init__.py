"""
data_fetcher.models — 하위 호환 re-export

모델 클래스는 아래 위치로 이동했습니다:
  - 기본 클래스: data_fetcher.abstract_provider.abstract
  - 표준 모델:   data_fetcher.abstract_provider.standard_models
  - Provider 모델: data_fetcher.providers.{name}.models
"""
from data_fetcher.abstract_provider.abstract import BaseData, BaseQueryParams

__all__ = ["BaseData", "BaseQueryParams"]
