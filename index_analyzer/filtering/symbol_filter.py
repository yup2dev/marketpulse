import logging
from typing import List
from ..models.schemas import ArticleResult

log = logging.getLogger("multiseed-extractor")


class SymbolFilter:
    """Symbol 모드 필터 - 특정 종목 관련 기사만 추출"""

    @staticmethod
    def filter_by_symbol(articles: List[ArticleResult], symbol: str) -> List[ArticleResult]:
        """특정 종목이 언급된 기사만 필터링"""
        filtered = []

        for article in articles:
            # EntityMapper의 mapped 결과에서 해당 종목 확인
            companies = article.mapped.get("companies", [])

            # 티커 또는 이름으로 매칭
            for company in companies:
                ticker = company.get("ticker", "")
                name = company.get("name", "")

                if symbol.upper() in [ticker.upper(), name.upper()]:
                    filtered.append(article)
                    break

        log.info(f"Filtered {len(filtered)}/{len(articles)} articles for symbol {symbol}")
        return filtered