"""
Data Base Class with __alias_dict__ Support

OpenBB 스타일의 Data 모델 베이스 클래스. `__alias_dict__` 를 선언해
외부 API 응답의 필드명 (camelCase 등) 을 내부 snake_case 필드명으로
자동 매핑할 수 있습니다.

사용 예:
    class FMPBalanceSheetData(Data):
        __alias_dict__ = {
            "cash_and_cash_equivalents": "cashAndCashEquivalents",
            "total_assets":              "totalAssets",
        }

        period_ending: date
        cash_and_cash_equivalents: float
        total_assets: float

    # Fetcher.transform_data 내부:
    return [FMPBalanceSheetData.from_api_dict(item) for item in raw_list]

기존 Pydantic `Field(alias=...)` 패턴도 호환되지만, __alias_dict__ 는
여러 필드를 한 곳에서 선언적으로 관리할 수 있어 가독성이 좋습니다.

점진적 도입 가이드:
    - 신규 Fetcher 부터 Data(BaseModel 대신) 를 상속해 사용
    - 기존 Fetcher 는 리팩토링 시 전환
    - __alias_dict__ 를 빈 dict 로 두면 일반 BaseModel 과 동일하게 동작
"""
from __future__ import annotations

from typing import Any, ClassVar, Dict, Type, TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound="Data")


class Data(BaseModel):
    """__alias_dict__ 지원 Pydantic BaseModel 확장"""

    __alias_dict__: ClassVar[Dict[str, str]] = {}

    model_config = {"populate_by_name": True}

    @classmethod
    def _remap(cls, raw: Dict[str, Any]) -> Dict[str, Any]:
        """raw dict 의 외부 키를 내부 필드명으로 변환"""
        if not cls.__alias_dict__:
            return raw

        # external_key -> internal_field_name 역매핑 테이블
        reverse = {ext: internal for internal, ext in cls.__alias_dict__.items()}

        remapped: Dict[str, Any] = {}
        for k, v in raw.items():
            if k in reverse:
                remapped[reverse[k]] = v
            else:
                remapped[k] = v
        return remapped

    @classmethod
    def from_api_dict(cls: Type[T], raw: Dict[str, Any]) -> T:
        """외부 API dict → 내부 모델 인스턴스 (alias 자동 매핑)"""
        return cls(**cls._remap(raw))

    @classmethod
    def from_api_list(cls: Type[T], raw_list: list) -> list:
        """외부 API list[dict] → list[Model]"""
        return [cls.from_api_dict(item) for item in raw_list if item is not None]
