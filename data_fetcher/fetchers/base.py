"""
Base Fetcher Abstract Class

OpenBB 패턴을 따르는 기본 Fetcher 클래스
"""
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, TypeVar, Generic
from pydantic import BaseModel

# Type variables for generic typing
QueryParamsT = TypeVar('QueryParamsT', bound=BaseModel)
DataT = TypeVar('DataT', bound=BaseModel)


class Fetcher(ABC, Generic[QueryParamsT, DataT]):
    """
    기본 Fetcher 추상 클래스

    OpenBB 패턴을 따름:
    1. transform_query: 쿼리 파라미터 변환
    2. extract_data: 데이터 추출 (API 호출)
    3. transform_data: 데이터 변환 (표준 모델로)
    """

    @staticmethod
    @abstractmethod
    def transform_query(params: Dict[str, Any]) -> QueryParamsT:
        """
        쿼리 파라미터 변환

        Args:
            params: 원시 쿼리 파라미터

        Returns:
            변환된 QueryParams 객체
        """
        raise NotImplementedError

    @staticmethod
    @abstractmethod
    def extract_data(
        query: QueryParamsT,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Any:
        """
        데이터 추출 (API 호출)

        Args:
            query: 쿼리 파라미터
            credentials: API 자격증명
            **kwargs: 추가 파라미터

        Returns:
            원시 데이터
        """
        raise NotImplementedError

    @staticmethod
    @abstractmethod
    def transform_data(
        query: QueryParamsT,
        data: Any,
        **kwargs: Any
    ) -> List[DataT]:
        """
        데이터 변환 (표준 모델로)

        Args:
            query: 쿼리 파라미터
            data: 원시 데이터
            **kwargs: 추가 파라미터

        Returns:
            표준 모델 리스트
        """
        raise NotImplementedError

    @classmethod
    def fetch_data(
        cls,
        params: Dict[str, Any],
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> List[DataT]:
        """
        전체 데이터 조회 프로세스

        Args:
            params: 쿼리 파라미터
            credentials: API 자격증명
            **kwargs: 추가 파라미터

        Returns:
            표준 모델 데이터 리스트
        """
        # 1. 쿼리 변환
        query = cls.transform_query(params)

        # 2. 데이터 추출
        raw_data = cls.extract_data(query, credentials, **kwargs)

        # 3. 데이터 변환
        transformed_data = cls.transform_data(query, raw_data, **kwargs)

        return transformed_data
