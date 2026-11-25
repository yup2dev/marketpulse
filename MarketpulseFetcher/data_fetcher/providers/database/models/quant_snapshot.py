"""DB Quant Snapshot Fetcher — mbs_in_quant_snapshot 한 행 (payload = 행 목록 JSON, meta = 덧붙는 값 JSON).

서버는 학습하지 않는다 — 로컬 배치(build_quant.py)가 적재한 값을 그대로 낸다. 적재 전이면 빈 결과 + loaded=False.
"""
import json
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.base_fetchers import DbFetcher
from data_fetcher.abstract_provider.abstract.fetcher import AnnotatedResult
from data_fetcher.abstract_provider.standard_models.quant_snapshot import (
    QuantSnapshotData,
    QuantSnapshotQueryParams,
)
from data_fetcher.providers.database.schema import MBS_IN_QUANT_SNAPSHOT


class DBQuantSnapshotFetcher(DbFetcher[QuantSnapshotQueryParams, AnnotatedResult[List[QuantSnapshotData]]]):

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> QuantSnapshotQueryParams:
        return QuantSnapshotQueryParams(**params)

    @classmethod
    def extract_data(cls, query: QuantSnapshotQueryParams,
                     credentials: Optional[Dict[str, str]] = None, **kwargs: Any) -> Dict[str, Any]:
        with cls.db_session(**kwargs) as session:
            row = (session.query(MBS_IN_QUANT_SNAPSHOT)
                   .filter(MBS_IN_QUANT_SNAPSHOT.universe == query.universe,
                           MBS_IN_QUANT_SNAPSHOT.dataset == query.dataset)
                   .first())
            if row is None:
                return {}
            return {"payload": row.payload, "meta": row.meta, "as_of": row.base_ymd}

    @staticmethod
    def transform_data(query: QuantSnapshotQueryParams, data: Dict[str, Any],
                       **kwargs: Any) -> AnnotatedResult[List[QuantSnapshotData]]:
        meta = {"universe": query.universe, "loaded": bool(data)}
        if not data:
            return AnnotatedResult(result=[], metadata=meta)
        meta.update(json.loads(data["meta"]) if data.get("meta") else {})
        meta["as_of"] = data["as_of"].isoformat()
        rows = [QuantSnapshotData.model_validate(r) for r in json.loads(data["payload"])]
        return AnnotatedResult(result=rows, metadata=meta)
