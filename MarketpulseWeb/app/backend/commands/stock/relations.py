"""기업 관계 그래프 서비스 (DB-first → Fetcher yahoo fallback).

관계 · 프로필은 db provider fetcher(company_relations · company_profile), 없으면 yahoo company_peers.
외부 소스(Yahoo)는 실행 계층으로 부른다 — 로컬 전용이면 사용자 Fetcher 로 위임된다
(배포 환경에선 RemoteTransport → 사용자 Fetcher(exe)). 서버에서 yfinance를
직접 부르면 고정 IP 차단·OOM 위험이 있다.
"""
import logging
from typing import Any, List

from data_fetcher.core.obbject import OBBject
from app.backend.core.execution import RemoteUnavailableError, ServerExecutor

log = logging.getLogger(__name__)


async def _db(model: str, symbol: str) -> List[Any]:
    """db provider 조회 — 실패해도 관계 화면은 yahoo 로 넘어간다."""
    try:
        return _items(await ServerExecutor.fetch("db", model, {"symbol": symbol}))
    except Exception as e:  # noqa: BLE001
        log.error(f"DB {model} 조회 실패 [{symbol}]: {e}")
        return []


def _items(raw: Any) -> List[Any]:
    return OBBject.unwrap(raw) or []


async def _fetch_profile(symbol: str) -> dict:
    """DB 프로필이 없을 때 Fetcher company_info로 이름·섹터 보충."""
    try:
        items = _items(await ServerExecutor.fetch("yahoo", "company_info", {"symbol": symbol}))
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
        items = _items(await ServerExecutor.fetch("yahoo", "company_peers", {"symbol": symbol}))
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
    symbol = symbol.upper()
    db_nodes = [
        {"symbol": r.symbol, "name": r.name, "type": r.relation_type, "detail": r.detail or "",
         "confidence": r.confidence, "data_source": r.data_source}
        for r in await _db("company_relations", symbol)
    ]
    profiles = await _db("company_profile", symbol)
    profile = profiles[0] if profiles else None

    name   = (profile.company_name or symbol) if profile else symbol
    sector = (profile.sector or "") if profile else ""

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
