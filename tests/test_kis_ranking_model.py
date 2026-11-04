"""kis:ranking — standard StockRanking shape 공유 (DB 랭킹과 같은 필드) + 파라미터 정규화."""
import pytest

import data_fetcher.providers_init  # noqa: F401 — provider 등록
from data_fetcher.abstract_provider.abstract.provider import ProviderRegistry
from data_fetcher.abstract_provider.standard_models.stock_ranking import (
    StockRankingData,
    StockRankingQueryParams,
)
from data_fetcher.providers.kis.models import ranking as kis
from data_fetcher.query_executor import QueryExecutor

ROW = {"stk_cd": "005930", "stk_nm": "삼성전자", "curr": "KRW", "sector": "",
       "close_price": 71000.0, "change_rate": 2.31, "volume": 1234567, "trade_value": 8.7e10}


def test_models_inherit_standard_ranking():
    assert issubclass(kis.KISRankingQueryParams, StockRankingQueryParams)
    assert issubclass(kis.KISRankingData, StockRankingData)
    db = ProviderRegistry.get("db").fetcher_dict["stock_ranking"]
    # DB 랭킹과 같은 표준 필드 집합을 반환한다 (위젯이 provider 전환에 안전)
    assert set(StockRankingData.model_fields) <= set(kis.KISRankingData.model_fields)
    assert set(StockRankingData.model_fields) <= set(db.data_type.model_fields)


def test_query_params_defaults_and_large_limit():
    q = kis.KISRankingFetcher.transform_query({"limit": 200, "sort_by": "volume"})
    assert (q.sort_by, q.market, q.limit, q.period) == ("volume", "domestic", 200, "1d")
    with pytest.raises(ValueError):
        kis.KISRankingFetcher.transform_query({"limit": 0})


def test_transform_data_dump_keeps_row_keys():
    q = kis.KISRankingFetcher.transform_query({})
    row = kis.KISRankingFetcher.transform_data(q, [ROW])[0].model_dump()
    for k in ("stk_cd", "stk_nm", "curr", "close_price", "change_rate", "volume", "trade_value"):
        assert row[k] == ROW[k]
    assert kis.KISRankingData(stk_cd="1", stk_nm="x").curr == "KRW"


class _NoCache:
    async def get(self, key):
        return None

    async def set(self, key, value, ttl):
        pass


@pytest.mark.asyncio
async def test_fetch_via_query_executor(monkeypatch):
    seen = {}

    async def fake(sort_by, market, limit, env, credentials):
        seen.update(sort_by=sort_by, market=market, limit=limit, creds=credentials)
        return [ROW]

    monkeypatch.setattr(kis, "fetch_kis_ranking", fake)
    monkeypatch.setattr(QueryExecutor, "_cache", _NoCache())
    monkeypatch.setattr(QueryExecutor, "_inflight", {})
    monkeypatch.setattr(QueryExecutor, "_swr_pending", set())
    raw = await QueryExecutor.fetch("kis", "ranking", {"sort_by": "losers", "limit": 5},
                                    credentials={"appkey": "a", "appsecret": "s"})
    rows = getattr(raw, "result", raw)
    assert rows[0].stk_cd == "005930"
    assert seen["sort_by"] == "losers" and seen["limit"] == 5 and seen["creds"]["appkey"] == "a"
