import logging
from typing import List, Dict, Any
from collections import Counter

from ..models.schemas import ArticleResult

log = logging.getLogger("multiseed-extractor")


class OutlookSummarizer:
    """전망 요약기 (종목별 시황 집계)"""

    def __init__(self):
        pass

    def summarize(self, articles: List[ArticleResult], symbol: str) -> Dict[str, Any]:
        """종목 관련 기사들의 전망 요약"""
        if not articles:
            return {
                "symbol": symbol,
                "total_articles": 0,
                "sentiment_distribution": {},
                "sentiment_score": 0.0,
                "top_keywords": [],
                "summary": "No articles found."
            }

        # 1. 감성 분석 집계
        sentiment_counts = Counter([a.sentiment for a in articles])
        total = len(articles)

        sentiment_distribution = {
            "positive": sentiment_counts.get("good", 0),
            "neutral": sentiment_counts.get("neutral", 0),
            "negative": sentiment_counts.get("bad", 0)
        }

        # 감성 스코어 계산 (-1 ~ 1)
        pos = sentiment_distribution["positive"]
        neg = sentiment_distribution["negative"]
        sentiment_score = (pos - neg) / total if total > 0 else 0.0

        # 2. 키워드 집계 (모든 기사의 top_words 병합)
        all_keywords = []
        for article in articles:
            all_keywords.extend([word for word, count in article.top_words])

        keyword_counter = Counter(all_keywords)
        top_keywords = [
            {"word": word, "count": count}
            for word, count in keyword_counter.most_common(20)
        ]

        # 3. 전망 요약 생성 (간단 버전)
        summary = self._generate_summary(
            symbol, sentiment_score, sentiment_distribution, top_keywords[:5], total
        )

        return {
            "symbol": symbol,
            "total_articles": total,
            "sentiment_distribution": sentiment_distribution,
            "sentiment_score": sentiment_score,
            "top_keywords": top_keywords,
            "summary": summary
        }

    def _generate_summary(
        self,
        symbol: str,
        sentiment_score: float,
        sentiment_dist: Dict[str, int],
        top_keywords: List[Dict],
        total_articles: int
    ) -> str:
        """요약문 생성"""
        # 감성 해석
        if sentiment_score > 0.3:
            sentiment_text = "강한 긍정적"
        elif sentiment_score > 0.1:
            sentiment_text = "긍정적"
        elif sentiment_score > -0.1:
            sentiment_text = "중립적"
        elif sentiment_score > -0.3:
            sentiment_text = "부정적"
        else:
            sentiment_text = "강한 부정적"

        # 키워드 텍스트
        keywords_text = ", ".join([kw["word"] for kw in top_keywords[:5]])

        summary = (
            f"{symbol}에 대한 {total_articles}개 기사 분석 결과, "
            f"전반적으로 {sentiment_text} 시각이 우세합니다. "
            f"(긍정: {sentiment_dist['positive']}, 중립: {sentiment_dist['neutral']}, 부정: {sentiment_dist['negative']}). "
            f"주요 키워드는 {keywords_text} 등입니다."
        )

        return summary