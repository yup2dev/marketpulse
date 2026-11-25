"""소셜 감성 — 글 분류 + 강세 · 약세 · 중립 비율.

fetcher 는 StockTwits 메시지(작성자가 단 bullish/bearish 표시 포함)와 Reddit 글 원문만 준다.
Reddit 글은 제목 키워드로 나누고, 둘을 합쳐 비율을 낸다. 계산은 가볍다 — 무거운 쪽은 외부 HTTP 이고
그건 QueryExecutor 의 모델 TTL 캐시가 맡는다 (배치로 미리 계산할 만큼은 아니라고 봤다).
"""
from typing import Any, Dict, List

from app.backend.commands._base import Rows

POSITIVE_WORDS = ("beat", "bull", "buy", "moon", "surge", "gain")
NEGATIVE_WORDS = ("bear", "sell", "dump", "crash", "loss", "miss")


def classify_title(title: str) -> str:
    """제목 키워드 수로 positive · negative · neutral."""
    t = (title or "").lower()
    pos = sum(w in t for w in POSITIVE_WORDS)
    neg = sum(w in t for w in NEGATIVE_WORDS)
    return "positive" if pos > neg else "negative" if neg > pos else "neutral"


def aggregate(labels: List[str]) -> Dict[str, Any]:
    total = len(labels)
    bull = sum(s in ("bullish", "positive") for s in labels)
    bear = sum(s in ("bearish", "negative") for s in labels)

    def share(n: int) -> float:
        return round(n / total * 100, 1) if total else 0

    return {"bullish_pct": share(bull), "bearish_pct": share(bear),
            "neutral_pct": share(total - bull - bear), "message_volume": total}


def score_social(row: Dict[str, Any]) -> Dict[str, Any]:
    posts = [{**p, "sentiment": classify_title(p.get("title", ""))} for p in row.get("reddit_posts") or []]
    labels = [m.get("sentiment", "neutral") for m in row.get("stocktwits_messages") or []] + [p["sentiment"] for p in posts]
    return {**row, "reddit_posts": posts, "aggregate": aggregate(labels)}
