"""Base Models for Standard Models"""
from pydantic import BaseModel


class BaseQueryParams(BaseModel):
    """모든 쿼리 파라미터의 기본 클래스"""

    class Config:
        extra = 'allow'
        validate_assignment = True


class BaseData(BaseModel):
    """모든 데이터 응답의 기본 클래스"""

    class Config:
        extra = 'allow'
        validate_assignment = True
        json_encoders = {
            # 날짜/시간 직렬화
            'datetime': lambda v: v.isoformat() if v else None,
            'date': lambda v: v.isoformat() if v else None,
        }
