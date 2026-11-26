"""Bond Provider Helpers."""
FMP_STABLE_BASE = "https://financialmodelingprep.com/stable"


def _safe_float(val) -> float | None:
    try:
        return float(val) if val is not None else None
    except (TypeError, ValueError):
        return None


def _icontains(text: str, query: str) -> bool:
    return query.lower() in (text or "").lower()
