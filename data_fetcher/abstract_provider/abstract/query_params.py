"""BaseQueryParams — 모든 쿼리 파라미터의 기본 클래스"""
from typing import Any, ClassVar, Dict

from pydantic import BaseModel, ConfigDict


class BaseQueryParams(BaseModel):
    """모든 쿼리 파라미터의 기본 클래스.

    서브클래스에서 `__alias_dict__ = {"python_field": "providerRawField"}` 를 선언하면
    `model_dump()` 시 키를 provider raw 키로 치환한다. `__json_schema_extra__` 는
    choices 등 JSON 스키마 힌트를 위한 메타데이터 슬롯이다(런타임 검증에는 미사용).
    """

    __alias_dict__: ClassVar[Dict[str, str]] = {}
    __json_schema_extra__: ClassVar[Dict[str, Any]] = {}

    model_config = ConfigDict(
        extra='allow',
        validate_assignment=True,
        populate_by_name=True,
        # 기본값에도 field_validator/타입 검증을 적용한다. Pydantic v2는 기본값
        # 검증을 생략하므로, 미적용 시 'country' 등 정규화가 필요한 필드의 기본값이
        # validator를 우회해 downstream에서 깨질 수 있다(예: IMF 차원 제약 위반).
        validate_default=True,
    )

    def model_dump(self, *args, **kwargs):
        """`__alias_dict__` 가 있으면 dump 시 키를 alias 로 치환."""
        original = super().model_dump(*args, **kwargs)
        if self.__alias_dict__:
            return {
                self.__alias_dict__.get(key, key): value
                for key, value in original.items()
            }
        return original
