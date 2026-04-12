"""
Query

라우터 엔드포인트에서 QueryExecutor로 이어지는 브리지 객체.

사용 예시:
    @router.command(model="IncomeStatement")
    async def income_statement(
        symbol: str,
        provider: str = "fmp",
        period: str = "annual",
        limit: int = 5,
    ) -> OBBject:
        return await OBBject.from_query(Query(**locals()))
"""
from __future__ import annotations

from contextvars import ContextVar
from typing import Any, Dict, List, Optional, Union

from data_fetcher.fetchers.base import AnnotatedResult
from data_fetcher.query_executor import QueryExecutor

# CommandRouter가 엔드포인트 호출 직전에 설정하는 모델 이름 ContextVar
# Query(**locals())로 생성 시 이 값을 자동으로 읽어 model을 결정합니다.
_command_model: ContextVar[str] = ContextVar("command_model", default="")


class Query:
    """
    단일 API 요청을 표현하는 객체

    Attributes:
        model:    Fetcher 모델 이름 (예: "IncomeStatement", "BalanceSheet")
        provider: 데이터 제공자 이름 (예: "fmp", "yahoo")
        params:   Fetcher에 전달할 파라미터 딕셔너리
    """

    def __init__(self, **kwargs: Any) -> None:
        # 1. model — ContextVar(CommandRouter가 주입) 또는 kwargs["_model"]
        self.model: str = kwargs.pop("_model", None) or _command_model.get()

        # 2. provider — kwargs에서 추출, 기본값 "fmp"
        self.provider: str = kwargs.pop("provider", "fmp") or "fmp"

        # 3. 나머지 kwargs → Fetcher params
        self.params: Dict[str, Any] = kwargs

    async def execute(self) -> Union[List[Any], AnnotatedResult]:
        """
        QueryExecutor를 통해 Fetcher 파이프라인 실행

        Returns:
            List[DataModel] 또는 AnnotatedResult[List[DataModel]]
        """
        return await QueryExecutor.fetch(
            provider=self.provider,
            model=self.model,
            params=self.params,
        )

    def __repr__(self) -> str:
        return (
            f"Query(model={self.model!r}, provider={self.provider!r}, "
            f"params={self.params!r})"
        )
