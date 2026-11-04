"""기업 관계 그래프 서비스 (DB-first → Fetcher yahoo fallback).

외부 소스(Yahoo)는 직접 호출하지 않고 QueryExecutor로 Fetcher에 위임한다
(배포 환경에선 RemoteTransport → 사용자 Fetcher(exe)). 서버에서 yfinance를
직접 부르면 고정 IP 차단·OOM 위험이 있다.
"""
import asyncio
import logging
from typing import Any, List, Optional

from data_fetcher.abstract_provider.abstract.annotated_result import AnnotatedResult
from data_fetcher.query_executor import QueryExecutor, RemoteUnavailableError
from marketpulse_common.models.orm import MBS_IN_STK_PROFILE, MBS_IN_STK_RELATIONS
from marketpulse_common.utils.db import default_db

log = logging.getLogger(__name__)


def get_relations_from_db(symbol: str) -> List[dict]:
    """DB에서 종목 관계 조회 (적재: MarketpulseBatch/run_job.py sp500 / relations)"""
    session = default_db.get_session()
    try:
        rows = session.query(MBS_IN_STK_RELATIONS).filter_by(stk_cd=symbol).all()
        return [
            {
                "symbol": row.related_cd,
                "name": row.related_nm or row.related_cd,
                "type": row.relation_type,
                "detail": row.detail or "",
                "confidence": float(row.confidence) if row.confidence else 0.85,
                "data_source": row.data_source,
            }
            for row in rows
        ]
    except Exception as e:
        log.error(f"DB 관계 조회 실패 [{symbol}]: {e}")
        return []
    finally:
        session.close()


def get_profile_from_db(symbol: str) -> Optional[dict]:
    """DB에서 종목 프로필 조회 (적재: MarketpulseBatch/jobs/collect_sp500.py)"""
    session = default_db.get_session()
    try:
        row = session.query(MBS_IN_STK_PROFILE).filter_by(stk_cd=symbol).first()
        return row.to_dict() if row else None
    except Exception as e:
        log.error(f"DB 프로필 조회 실패 [{symbol}]: {e}")
        return None
    finally:
        session.close()


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
