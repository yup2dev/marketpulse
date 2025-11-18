"""
Base Fetcher Abstract Class

OpenBB 패턴을 따르는 기본 Fetcher 클래스
Enhanced with async support, type safety, and testing capabilities.
"""
import asyncio
import inspect
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, TypeVar, Generic, Union, get_args, get_origin
from pydantic import BaseModel


# Type variables for generic typing
QueryParamsT = TypeVar('QueryParamsT', bound=BaseModel)
DataT = TypeVar('DataT', bound=BaseModel)
ReturnT = TypeVar('ReturnT')


class AnnotatedResult(Generic[ReturnT]):
    """
    메타데이터를 포함한 결과 래퍼

    OpenBB의 AnnotatedResult 패턴을 따름
    """

    def __init__(self, result: ReturnT, metadata: Optional[Dict[str, Any]] = None):
        """
        Args:
            result: 실제 데이터 결과
            metadata: 추가 메타데이터 (예: API 요청 정보, 경고 메시지 등)
        """
        self.result = result
        self.metadata = metadata or {}

    def __repr__(self):
        return f"AnnotatedResult(result={self.result}, metadata={self.metadata})"


class classproperty:
    """Class property decorator for type inspection"""

    def __init__(self, func):
        self.func = func

    def __get__(self, obj, owner):
        return self.func(owner)


class Fetcher(ABC, Generic[QueryParamsT, DataT]):
    """
    기본 Fetcher 추상 클래스

    OpenBB 패턴을 따르며 다음 기능을 제공:
    1. transform_query: 쿼리 파라미터 변환
    2. extract_data/aextract_data: 데이터 추출 (동기/비동기)
    3. transform_data: 데이터 변환 (표준 모델로)
    4. fetch_data: 통합 데이터 조회 (async 지원)
    5. test: 자동화된 테스트

    Type Parameters:
        QueryParamsT: 쿼리 파라미터 타입 (BaseModel 상속)
        DataT: 데이터 타입 (BaseModel 상속)

    Example:
        ```python
        class MyQueryParams(BaseModel):
            symbol: str

        class MyData(BaseModel):
            date: date
            value: float

        class MyFetcher(Fetcher[MyQueryParams, MyData]):
            @staticmethod
            def transform_query(params: Dict[str, Any]) -> MyQueryParams:
                return MyQueryParams(**params)

            @staticmethod
            def extract_data(query: MyQueryParams, credentials=None, **kwargs):
                # API 호출
                return raw_data

            @staticmethod
            def transform_data(query: MyQueryParams, data: Any, **kwargs) -> List[MyData]:
                # 데이터 변환
                return [MyData(...) for item in data]
        ```
    """

    # 자격증명 필요 여부 (서브클래스에서 오버라이드 가능)
    require_credentials: bool = True

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
    async def aextract_data(
        query: QueryParamsT,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Any:
        """
        비동기 데이터 추출 (API 호출)

        서브클래스는 extract_data 또는 aextract_data 중 하나를 구현해야 함.
        둘 다 구현된 경우 aextract_data가 우선.

        Args:
            query: 쿼리 파라미터
            credentials: API 자격증명
            **kwargs: 추가 파라미터

        Returns:
            원시 데이터
        """
        pass

    @staticmethod
    def extract_data(
        query: QueryParamsT,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Any:
        """
        동기 데이터 추출 (API 호출)

        서브클래스는 extract_data 또는 aextract_data 중 하나를 구현해야 함.

        Args:
            query: 쿼리 파라미터
            credentials: API 자격증명
            **kwargs: 추가 파라미터

        Returns:
            원시 데이터
        """
        pass

    @staticmethod
    @abstractmethod
    def transform_data(
        query: QueryParamsT,
        data: Any,
        **kwargs: Any
    ) -> Union[List[DataT], AnnotatedResult[List[DataT]]]:
        """
        데이터 변환 (표준 모델로)

        Args:
            query: 쿼리 파라미터
            data: 원시 데이터
            **kwargs: 추가 파라미터

        Returns:
            표준 모델 리스트 또는 AnnotatedResult로 래핑된 리스트
        """
        raise NotImplementedError

    def __init_subclass__(cls, *args, **kwargs):
        """
        서브클래스 초기화 시 extract_data/aextract_data 검증

        OpenBB 패턴: aextract_data가 구현되면 extract_data를 async 버전으로 대체
        """
        super().__init_subclass__(*args, **kwargs)

        # aextract_data가 오버라이드되었는지 확인
        has_async = cls.aextract_data != Fetcher.aextract_data
        has_sync = cls.extract_data != Fetcher.extract_data

        if has_async:
            # aextract_data가 구현되면 이를 기본으로 사용
            cls.extract_data = cls.aextract_data  # type: ignore
        elif not has_sync:
            # 둘 다 구현 안 되었으면 에러
            raise NotImplementedError(
                f"{cls.__name__} must implement either extract_data or aextract_data"
            )

    @classmethod
    async def fetch_data(
        cls,
        params: Dict[str, Any],
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Union[List[DataT], AnnotatedResult[List[DataT]]]:
        """
        전체 데이터 조회 프로세스 (비동기)

        Args:
            params: 쿼리 파라미터
            credentials: API 자격증명
            **kwargs: 추가 파라미터

        Returns:
            표준 모델 데이터 리스트 또는 AnnotatedResult
        """
        # 1. 쿼리 변환
        query = cls.transform_query(params)

        # 2. 데이터 추출 (async/sync 자동 처리)
        raw_data = await cls._maybe_coroutine(
            cls.extract_data,
            query=query,
            credentials=credentials,
            **kwargs
        )

        # 3. 데이터 변환
        transformed_data = cls.transform_data(query, raw_data, **kwargs)

        return transformed_data

    @classmethod
    def fetch_data_sync(
        cls,
        params: Dict[str, Any],
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Union[List[DataT], AnnotatedResult[List[DataT]]]:
        """
        전체 데이터 조회 프로세스 (동기 - 편의 메서드)

        내부적으로 fetch_data를 호출하고 결과를 기다림

        Args:
            params: 쿼리 파라미터
            credentials: API 자격증명
            **kwargs: 추가 파라미터

        Returns:
            표준 모델 데이터 리스트 또는 AnnotatedResult
        """
        return asyncio.run(cls.fetch_data(params, credentials, **kwargs))

    @staticmethod
    async def _maybe_coroutine(func, **kwargs):
        """
        함수가 코루틴이면 await, 아니면 바로 실행

        OpenBB의 maybe_coroutine 패턴
        """
        result = func(**kwargs)
        if inspect.iscoroutine(result):
            return await result
        return result

    @classproperty
    def query_params_type(cls) -> type:
        """쿼리 파라미터 타입 반환"""
        try:
            return get_args(cls.__orig_bases__[0])[0]  # type: ignore
        except (AttributeError, IndexError):
            return BaseModel

    @classproperty
    def data_type(cls) -> type:
        """데이터 타입 반환"""
        try:
            return get_args(cls.__orig_bases__[0])[1]  # type: ignore
        except (AttributeError, IndexError):
            return BaseModel

    @classmethod
    def test(
        cls,
        params: Dict[str, Any],
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> None:
        """
        Fetcher 테스트 메서드

        Transform-Extract-Transform (TET) 패턴의 각 단계를 검증

        Args:
            params: 테스트용 쿼리 파라미터
            credentials: API 자격증명
            **kwargs: 추가 파라미터

        Raises:
            AssertionError: 테스트 실패 시

        Example:
            ```python
            MyFetcher.test(
                params={"symbol": "AAPL"},
                credentials={"api_key": "test_key"}
            )
            ```
        """
        # 1. Transform Query 테스트
        query = cls.transform_query(params)
        assert query is not None, "Query must not be None"
        assert isinstance(query, cls.query_params_type), \
            f"Query type mismatch. Expected: {cls.query_params_type}, Got: {type(query)}"

        # 2. Extract Data 테스트
        raw_data = asyncio.run(cls._maybe_coroutine(
            cls.extract_data,
            query=query,
            credentials=credentials,
            **kwargs
        ))
        assert raw_data is not None, "Raw data must not be None"
        assert len(raw_data) > 0, "Raw data must not be empty"

        # 3. Transform Data 테스트
        result = cls.transform_data(query, raw_data, **kwargs)

        # AnnotatedResult 언래핑
        transformed_data = result.result if isinstance(result, AnnotatedResult) else result

        assert transformed_data is not None, "Transformed data must not be None"
        assert isinstance(transformed_data, list), "Transformed data must be a list"
        assert len(transformed_data) > 0, "Transformed data must not be empty"

        # 첫 번째 아이템 타입 검증
        first_item = transformed_data[0]
        assert isinstance(first_item, cls.data_type), \
            f"Data type mismatch. Expected: {cls.data_type}, Got: {type(first_item)}"

        print(f"✓ {cls.__name__} test passed!")
        print(f"  - Query: {query}")
        print(f"  - Records fetched: {len(transformed_data)}")
        print(f"  - Sample data: {first_item}")


# Backward compatibility aliases
QueryParams = BaseModel
Data = BaseModel
