"""기업 관계 그래프 서비스 (DB-first → Fetcher yahoo fallback).

외부 소스(Yahoo)는 직접 호출하지 않고 QueryExecutor로 Fetcher에 위임한다
(배포 환경에선 RemoteTransport → 사용자 Fetcher(exe)). 서버에서 yfinance를
직접 부르면 고정 IP 차단·OOM 위험이 있다.
"""
import asyncio
import logging
from typing import Any, List

from data_fetcher.abstract_provider.abstract.annotated_result import AnnotatedResult
from data_fetcher.query_executor import QueryExecutor, RemoteUnavailableError

log = logging.getLogger(__name__)


def _items(raw: Any) -> List[Any]:
    return raw.result if isinstance(raw, AnnotatedResult) else (raw or [])


async def _fetch_profile(symbol: str) -> dict:
    """DB 프로필이 없을 때 Fetcher company_info로 이름·섹터 보충."""
    try:
        items = _items(await QueryExecutor.fetch("yahoo", "company_info", {"symbol": symbol}))
    except RemoteUnavailableError:
        raise
    except Exception as e:
        log.warning(f"company_info 조회 실패 [{symbol}]: {e}")
        return {}
    if not items:
        return {}
    it = items[0]
    return {"name": getattr(it, "company_name", None), "sector": getattr(it, "sector", None)}


async def _fetch_peers(symbol: str, base_sector: str) -> list:
    try:
        items = _items(await QueryExecutor.fetch("yahoo", "company_peers", {"symbol": symbol}))
    except RemoteUnavailableError:
        raise
    except Exception as e:
        log.warning(f"유사종목 fallback 실패 [{symbol}]: {e}")
        return []

    nodes = []
    for it in items:
        sym = getattr(it, "symbol", None)
        if not sym:
            continue
        industry = getattr(it, "industry", None) or base_sector
        nodes.append({
            "symbol": sym,
            "name": getattr(it, "name", None) or sym,
            "type": "competitor",
            "detail": f"{industry} peer" if industry else "Peer",
        })
    return nodes


async def get_company_relations(symbol: str) -> dict:
    """종목 관계 그래프 반환 (DB-first → Fetcher yahoo fallback)."""
    from index_analyzer.services.stock_service import get_relations_from_db, get_profile_from_db

    symbol = symbol.upper()
    db_nodes = await asyncio.to_thread(get_relations_from_db, symbol)
    profile  = await asyncio.to_thread(get_profile_from_db, symbol)

    name   = profile.get("stk_nm", symbol) if profile else symbol
    sector = profile.get("sector", "") if profile else ""

    if db_nodes:
        return {"symbol": symbol, "name": name, "sector": sector,
                "nodes": db_nodes, "found": True, "data_source": "db_fmp_peers"}

    if not sector:
        extra = await _fetch_profile(symbol)
        name   = extra.get("name") or name
        sector = extra.get("sector") or ""

    peer_nodes = await _fetch_peers(symbol, sector)
    return {"symbol": symbol, "name": name, "sector": sector,
            "nodes": peer_nodes, "found": bool(peer_nodes), "data_source": "yahoo_finance"}
