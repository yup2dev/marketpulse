"""Yahoo Finance Helpers."""
import math
from typing import Any, Optional

SYMBOL_ALIASES: dict[str, str] = {}


def safe_get(data: dict, key: str, default=None) -> Any:
    """NaN/None 안전 조회."""
    val = data.get(key, default)
    if val is None:
        return default
    try:
        if math.isnan(float(val)):
            return default
    except (TypeError, ValueError):
        pass
    return val


def resolve_symbol(symbol: str) -> str:
    """심볼 변환 (한국 시장 등)."""
    return SYMBOL_ALIASES.get(symbol, symbol)
