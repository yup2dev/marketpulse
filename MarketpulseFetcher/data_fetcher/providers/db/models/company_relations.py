"""DB Company Relations Fetcher — 배치(load_all_relations)가 적재한 종목 관계(MBS_IN_STK_RELATIONS)."""
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.base_fetchers import DbFetcher
from data_fetcher.abstract_provider.standard_models.company_relations import (
    CompanyRelationsData,
    CompanyRelationsQueryParams,
)
from data_fetcher.providers.db.schema import MBS_IN_STK_RELATIONS


class DBCompanyRelationsFetcher(DbFetcher[CompanyRelationsQueryParams, List[CompanyRelationsData]]):

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> CompanyRelationsQueryParams:
        return CompanyRelationsQueryParams(**params)

    @classmethod
    def extract_data(cls, query: CompanyRelationsQueryParams,
                     credentials: Optional[Dict[str, str]] = None, **kwargs: Any) -> List[Dict[str, Any]]:
        with cls.db_session(**kwargs) as session:
            rows = session.query(MBS_IN_STK_RELATIONS).filter_by(stk_cd=query.symbol).all()
            return [
                {
                    "symbol": r.related_cd, "name": r.related_nm or r.related_cd,
                    "relation_type": r.relation_type, "detail": r.detail or "",
                    # 신뢰도를 안 적은 관계는 0.85 (배치가 근거 없이 넣은 관계)
                    "confidence": float(r.confidence) if r.confidence else 0.85,
                    "data_source": r.data_source,
                }
                for r in rows
            ]

    @staticmethod
    def transform_data(query: CompanyRelationsQueryParams, data: List[Dict[str, Any]],
                       **kwargs: Any) -> List[CompanyRelationsData]:
        return [CompanyRelationsData.model_validate(r) for r in data or []]
