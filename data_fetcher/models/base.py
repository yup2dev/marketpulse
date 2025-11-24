"""Base Models for Standard Models"""
from pydantic import BaseModel, ConfigDict


class BaseQueryParams(BaseModel):
    """모든 쿼리 파라미터의 기본 클래스"""

    model_config = ConfigDict(
        extra='allow',
        validate_assignment=True
    )


class BaseData(BaseModel):
    """모든 데이터 응답의 기본 클래스"""

    model_config = ConfigDict(
        extra='allow',
        validate_assignment=True
    )
