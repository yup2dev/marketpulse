"""기업 관계 그래프 서비스 (DB-first → Yahoo Finance fallback)."""
import asyncio
import logging

log = logging.getLogger(__name__)


async def _fetch_yahoo_similar(symbol: str, base_sector: str) -> list:
    import httpx
    url = f"https://query2.finance.yahoo.com/v6/finance/recommendationsbysymbol/{symbol}"
    headers = {"User-Agent": "Mozilla/5.0 (compatible; MarketPulse/1.0)"}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(url, headers=headers)
            if r.status_code != 200:
                return []
            result = r.json().get("finance", {}).get("result", [])
            if not result:
                return []
            syms = result[0].get("recommendedSymbols", [])
    except Exception as e:
        log.warning(f"Yahoo 유사종목 fallback 실패 [{symbol}]: {e}")
        return []

    nodes = []
    for item in syms[:10]:
        sym = item.get("symbol", "")
        if not sym or sym == symbol:
            continue
        try:
            import yfinance as yf
            info = await asyncio.to_thread(lambda s=sym: yf.Ticker(s).info)
            nodes.append({
                "symbol": sym,
                "name": info.get("longName", sym),
                "type": "competitor",
                "detail": f"{info.get('industry', base_sector)} peer",
            })
        except Exception:
            nodes.append({"symbol": sym, "name": sym, "type": "competitor", "detail": "Peer"})
    return nodes


async def get_company_relations(symbol: str) -> dict:
    """종목 관계 그래프 반환 (DB-first → Yahoo Finance fallback)."""
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
        try:
            import yfinance as yf
            info = await asyncio.to_thread(lambda: yf.Ticker(symbol).info)
            name   = info.get("longName", symbol)
            sector = info.get("sector", "")
        except Exception:
            pass

    yahoo_nodes = await _fetch_yahoo_similar(symbol, sector)
    return {"symbol": symbol, "name": name, "sector": sector,
            "nodes": yahoo_nodes, "found": bool(yahoo_nodes), "data_source": "yahoo_finance"}
