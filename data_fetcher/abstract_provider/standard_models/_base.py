"""OpenBB 이식 표준 모델용 베이스.

프로젝트의 BaseData / BaseQueryParams 를 그대로 확장해 OpenBB 모델 동작
(특히 camelCase 검증 alias)을 얹는다. 기존 provider 모델에는 영향을 주지 않도록
별도 서브클래스로 분리한다.

- Data: BaseData + camelCase 검증 alias / snake 직렬화 alias
- QueryParams: BaseQueryParams + __alias_dict__ 기반 model_dump alias
"""
from typing import Annotated, Any

from pydantic import (
    AliasGenerator,
    BeforeValidator,
    ConfigDict,
    alias_generators,
)

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


def check_int(v: int) -> int:
    """값을 int 로 강제."""
    try:
        return int(v)
    except ValueError as exc:
        raise TypeError("value must be an int") from exc


ForceInt = Annotated[int, BeforeValidator(check_int)]


class Data(BaseData):
    """OpenBB 표준 데이터 모델 베이스 (BaseData 확장).

    BaseData 의 __alias_dict__ 리매핑 + 빈문자열 sanitize 를 그대로 상속하고,
    여기에 camelCase 검증 alias 를 추가해 OpenBB raw 키(예: formattedPrice)를 받는다.
    """

    model_config = ConfigDict(
        extra="allow",
        populate_by_name=True,
        validate_assignment=True,
        strict=False,
        alias_generator=AliasGenerator(
            validation_alias=alias_generators.to_camel,
            serialization_alias=alias_generators.to_snake,
        ),
    )


class QueryParams(BaseQueryParams):
    """OpenBB 표준 쿼리 파라미터 베이스 (BaseQueryParams 확장)."""

    __alias_dict__: dict[str, str] = {}
    __json_schema_extra__: dict[str, Any] = {}

    def model_dump(self, *args, **kwargs):
        """alias_dict 가 있으면 dump 시 키를 alias 로 치환."""
        original = super().model_dump(*args, **kwargs)
        if self.__alias_dict__:
            return {
                self.__alias_dict__.get(key, key): value
                for key, value in original.items()
            }
        return original


__all__ = ["Data", "QueryParams", "ForceInt", "check_int"]
