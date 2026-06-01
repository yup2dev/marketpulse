"""Fetcher — 추상 기본 클래스 (TET 파이프라인)"""
import asyncio
import inspect
from typing import Any, Dict, List, Optional, TypeVar, Generic, Union, get_args, get_origin

from pydantic import BaseModel

from data_fetcher.abstract_provider.abstract.annotated_result import AnnotatedResult


Q = TypeVar("Q", bound=BaseModel)
R = TypeVar("R")


class classproperty:
    """Class property decorator for type inspection"""

    def __init__(self, func):
        self.func = func

    def __get__(self, obj, owner):
        return self.func(owner)


async def maybe_coroutine(func, **kwargs):
    """함수가 코루틴이면 await, 아니면 바로 실행"""
    result = func(**kwargs)
    if inspect.iscoroutine(result):
        return await result
    return result


class Fetcher(Generic[Q, R]):
    """Abstract class for the fetcher.

    Type Parameters:
        Q: QueryParams 타입 (BaseModel 상속)
        R: 반환 데이터 엘리먼트 타입

    서브클래스는 다음 중 하나를 구현해야 합니다:
        - extract_data   (동기)
        - aextract_data  (비동기) → extract_data 로 자동 연결

    Example:
        class MyFetcher(Fetcher[MyQueryParams, MyData]):
            @staticmethod
            def transform_query(params):
                return MyQueryParams(**params)

            @staticmethod
            async def aextract_data(query, credentials=None):
                return await some_api_call(query.symbol)

            @staticmethod
            def transform_data(query, data, **kwargs):
                return [MyData(**item) for item in data]
    """

    require_credentials: bool = True

    @staticmethod
    def transform_query(params: dict[str, Any]) -> Q:
        """Transform the params to the provider-specific query."""
        raise NotImplementedError

    @staticmethod
    async def aextract_data(
        query: Q,
        credentials: dict[str, str] | None = None,
        **kwargs: Any,
    ) -> Any:
        """Asynchronously extract the data from the provider."""

    @staticmethod
    def extract_data(
        query: Q,
        credentials: dict[str, str] | None = None,
        **kwargs: Any,
    ) -> Any:
        """Extract the data from the provider."""

    @staticmethod
    def transform_data(query: Q, data: Any, **kwargs: Any) -> "R | AnnotatedResult[R]":
        """Transform the provider-specific data."""
        raise NotImplementedError

    def __init_subclass__(cls, *args, **kwargs):
        super().__init_subclass__(*args, **kwargs)
        if cls.aextract_data != Fetcher.aextract_data:
            cls.extract_data = cls.aextract_data  # type: ignore[method-assign]
        elif cls.extract_data == Fetcher.extract_data:
            raise NotImplementedError(
                "Fetcher subclass must implement either extract_data or aextract_data"
                " method. If both are implemented, aextract_data will be used as the"
                " default."
            )

    @classmethod
    async def fetch_data(
        cls,
        params: dict[str, Any],
        credentials: dict[str, str] | None = None,
        **kwargs,
    ) -> "R | AnnotatedResult[R]":
        """Fetch data from a provider. (transform → extract → transform)"""
        query = cls.transform_query(params=params)
        data = await maybe_coroutine(
            cls.extract_data,
            query=query,
            credentials=credentials,
            **kwargs,
        )
        return cls.transform_data(query=query, data=data, **kwargs)

    @classmethod
    def fetch_data_sync(
        cls,
        params: dict[str, Any],
        credentials: dict[str, str] | None = None,
        **kwargs,
    ) -> "R | AnnotatedResult[R]":
        """동기 편의 메서드"""
        return asyncio.run(cls.fetch_data(params, credentials, **kwargs))

    @classproperty
    def query_params_type(cls) -> type:
        try:
            return cls.__orig_bases__[0].__args__[0]  # type: ignore
        except (AttributeError, IndexError):
            return BaseModel

    @classproperty
    def return_type(cls) -> type:
        try:
            return_type = cls.__orig_bases__[0].__args__[1]  # type: ignore
            if get_origin(return_type) is AnnotatedResult:
                return_type = get_args(return_type)[0]
            return return_type
        except (AttributeError, IndexError):
            return BaseModel

    @classproperty
    def data_type(cls) -> type:
        try:
            raw = cls.__orig_bases__[0].__args__[1]  # type: ignore
            return cls._get_data_type(raw)
        except (AttributeError, IndexError):
            return BaseModel

    @classmethod
    def _get_data_type(cls, t: Any) -> type:
        origin = get_origin(t)
        if origin is AnnotatedResult:
            return cls._get_data_type(get_args(t)[0])
        if origin is list:
            args = get_args(t)
            return args[0] if args else BaseModel
        return t

    @classmethod
    def set_data(
        cls,
        result: "Union[List[R], AnnotatedResult[List[R]], None]",
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        """fetch_data() 결과를 dict 리스트로 직렬화"""
        if result is None:
            return []
        if isinstance(result, AnnotatedResult):
            result = result.result
        if not result:
            return []
        output = []
        for item in result:
            if isinstance(item, BaseModel):
                output.append(item.model_dump(mode="json"))
            else:
                output.append(item)
        return output

    @classmethod
    def test(
        cls,
        params: Dict[str, Any],
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> None:
        """Transform-Extract-Transform 각 단계 검증"""
        query = cls.transform_query(params)
        assert query is not None, "Query must not be None"
        assert isinstance(query, cls.query_params_type), (
            f"Query type mismatch. Expected: {cls.query_params_type}, Got: {type(query)}"
        )

        raw_data = asyncio.run(maybe_coroutine(
            cls.extract_data,
            query=query,
            credentials=credentials,
            **kwargs,
        ))
        assert raw_data is not None, "Raw data must not be None"
        assert len(raw_data) > 0, "Raw data must not be empty"

        result = cls.transform_data(query, raw_data, **kwargs)
        transformed = result.result if isinstance(result, AnnotatedResult) else result

        assert transformed is not None, "Transformed data must not be None"
        assert isinstance(transformed, list), "Transformed data must be a list"
        assert len(transformed) > 0, "Transformed data must not be empty"

        first_item = transformed[0]
        assert isinstance(first_item, cls.data_type), (
            f"Data type mismatch. Expected: {cls.data_type}, Got: {type(first_item)}"
        )

        print(f"✓ {cls.__name__} test passed!")
        print(f"  - Query: {query}")
        print(f"  - Records fetched: {len(transformed)}")
        print(f"  - Sample data: {first_item}")
