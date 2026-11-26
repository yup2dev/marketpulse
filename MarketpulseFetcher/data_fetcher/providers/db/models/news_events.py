"""DB News Events Fetcher — 크롤 worker 가 분석한 기사(mbs_proc_article)를 원문(mbs_in_article)과 붙인다."""
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.base_fetchers import DbFetcher
from data_fetcher.abstract_provider.standard_models.news_events import NewsEventsData, NewsEventsQueryParams
from data_fetcher.providers.db.schema import MBS_IN_ARTICLE, MBS_PROC_ARTICLE


def _float(v) -> Optional[float]:
    return None if v is None else float(v)


class DBNewsEventsFetcher(DbFetcher[NewsEventsQueryParams, List[NewsEventsData]]):

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> NewsEventsQueryParams:
        return NewsEventsQueryParams(**params)

    @classmethod
    def extract_data(cls, query: NewsEventsQueryParams,
                     credentials: Optional[Dict[str, str]] = None, **kwargs: Any) -> List[Dict[str, Any]]:
        with cls.db_session(**kwargs) as session:
            q = (session.query(MBS_PROC_ARTICLE, MBS_IN_ARTICLE)
                 .join(MBS_IN_ARTICLE, MBS_PROC_ARTICLE.news_id == MBS_IN_ARTICLE.news_id))
            if query.symbol:
                q = q.filter(MBS_PROC_ARTICLE.stk_cd == query.symbol.upper())
            if query.start_date:
                q = q.filter(MBS_PROC_ARTICLE.base_ymd >= query.start_date)
            if query.end_date:
                q = q.filter(MBS_PROC_ARTICLE.base_ymd <= query.end_date)
            rows = q.order_by(MBS_PROC_ARTICLE.base_ymd.desc()).limit(query.limit).all()
            return [
                {
                    "date": proc.base_ymd, "symbol": proc.stk_cd, "title": art.title,
                    "summary": proc.summary_text, "sentiment_score": _float(proc.sentiment_score),
                    "price_impact": _float(proc.price_impact), "match_score": _float(proc.match_score),
                    "price": _float(proc.price), "source": art.source_cd, "url": art.url,
                    "publish_dt": art.publish_dt,
                }
                for proc, art in rows
            ]

    @staticmethod
    def transform_data(query: NewsEventsQueryParams, data: List[Dict[str, Any]],
                       **kwargs: Any) -> List[NewsEventsData]:
        return [NewsEventsData.model_validate(r) for r in data or []]
