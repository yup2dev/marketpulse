"""BaseData — 모든 데이터 응답의 기본 클래스"""
from typing import Any, ClassVar, Dict

from pydantic import (
    AliasGenerator,
    BaseModel,
    ConfigDict,
    alias_generators,
    model_validator,
)


_EMPTY_STRINGS = {"", "None", "none", "NaN", "nan", "null", "NULL", "-"}


class BaseData(BaseModel):
    """모든 데이터 응답의 기본 클래스.

    서브클래스에서 `__alias_dict__ = {"python_field": "ProviderRawField"}` 형태로
    매핑을 선언하면, raw dict가 들어왔을 때 자동으로 필드명이 치환된다.
    또한 camelCase 검증 alias 를 기본 제공해 provider raw 키(예: formattedPrice)를
    snake_case 필드(formatted_price)로 자동 매핑한다(populate_by_name 으로 snake 입력도 유지).
    'None' / '' / '-' 등 빈 문자열은 전부 None으로 정리한 뒤 Pydantic이
    타입 강제 변환(str→int/float 등)을 처리한다.
    """

    __alias_dict__: ClassVar[Dict[str, str]] = {}

    model_config = ConfigDict(
        extra='allow',
        validate_assignment=True,
        populate_by_name=True,
        strict=False,
        alias_generator=AliasGenerator(
            validation_alias=alias_generators.to_camel,
            serialization_alias=alias_generators.to_snake,
        ),
    )

    @model_validator(mode='before')
    @classmethod
    def _remap_and_sanitize(cls, values: Any) -> Any:
        if not isinstance(values, dict):
            return values

        alias_map = cls.__alias_dict__
        if alias_map:
            remapped: Dict[str, Any] = {}
            for py_name, raw_name in alias_map.items():
                if raw_name in values and py_name not in values:
                    remapped[py_name] = values[raw_name]
            reverse = set(alias_map.values())
            for k, v in values.items():
                if k in reverse and k not in alias_map:
                    continue
                remapped.setdefault(k, v)
            values = remapped

        return {
            k: (None if isinstance(v, str) and v.strip() in _EMPTY_STRINGS else v)
            for k, v in values.items()
        }
