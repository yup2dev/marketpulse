"""뉴스 감성 — 종목 뉴스 제목의 키워드로 긍정 · 부정 · 중립을 나누고 날짜별 추이를 낸다.

입력은 news 표준 모델(title · published_utc · article_url …)이라 뉴스 provider 를 바꿔도 같은 계산이다.
"""
from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List

from pydantic import BaseModel, Field

from app.backend.commands._base import Rows, Source, fetch_rows

POSITIVE_WORDS = ("beat", "surge", "rally", "gain", "rise", "up", "growth", "profit", "record", "strong",
                  "bullish", "upgrade", "buy")
NEGATIVE_WORDS = ("miss", "fall", "drop", "decline", "loss", "down", "weak", "bearish", "downgrade", "sell",
                  "concern", "risk", "cut")
MAX_ARTICLES = 50


class NewsSentimentData(BaseModel):
    symbol: str
    news: List[Dict[str, Any]] = Field(default_factory=list)
    aggregate: Dict[str, Any] = Field(default_factory=dict, description="positive · negative · neutral 건수 + overall_score(0~100)")
    trend: List[Dict[str, Any]] = Field(default_factory=list, description="날짜별 평균 점수")


def score_title(title: str) -> tuple:
    """(감성, 0~100 점수) — 키워드 하나에 10점."""
    t = (title or "").lower()
    pos = sum(w in t for w in POSITIVE_WORDS)
    neg = sum(w in t for w in NEGATIVE_WORDS)
    if pos > neg:
        return "positive", min(100, 50 + pos * 10)
    if neg > pos:
        return "negative", max(0, 50 - neg * 10)
    return "neutral", 50


def _iso(v: Any) -> Any:
    return v.isoformat() if isinstance(v, datetime) else v


def news_sentiment_from(symbol: str, articles: Rows) -> NewsSentimentData:
    items = []
    for a in articles[:MAX_ARTICLES]:
        sentiment, score = score_title(a.get("title") or "")
        items.append({
            "title": a.get("title"),
            "published_at": _iso(a.get("published_utc")),
            "source": a.get("publisher_name") or a.get("publisher"),
            "url": a.get("article_url"),
            "sentiment": sentiment,
            "sentiment_score": score,
        })
    counts = {k: sum(i["sentiment"] == k for i in items) for k in ("positive", "negative", "neutral")}
    total = len(items)
    overall = int((counts["positive"] * 100 + counts["neutral"] * 50) / total) if total else 50

    by_day: Dict[str, List[int]] = defaultdict(list)
    for i in items:
        if i["published_at"]:
            by_day[str(i["published_at"])[:10]].append(i["sentiment_score"])
    trend = [{"date": d, "score": round(sum(s) / len(s), 1)} for d, s in sorted(by_day.items())]
    return NewsSentimentData(symbol=symbol, news=items, aggregate={**counts, "overall_score": overall}, trend=trend)


async def news_sentiment(symbol: str, news: Source) -> List[NewsSentimentData]:
    rows = await fetch_rows(news.with_params(symbol=symbol, limit=MAX_ARTICLES))
    return [news_sentiment_from(symbol, rows)]
