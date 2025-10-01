import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from pathlib import Path

from ..models.schemas import ArticleResult
from ..models.report import AnalystReport, Insight, TargetPrice
from ..extraction import TargetPriceExtractor, OutlookSummarizer
from ..intelligence import CorrelationEngine, CausalityInference
from ..analysis import NLPAnalyzer

log = logging.getLogger("multiseed-extractor")


class AnalystReportGenerator:
    """애널리스트 리포트 자동 생성기"""

    def __init__(
        self,
        nlp: NLPAnalyzer,
        corr_engine: CorrelationEngine,
        causal_engine: CausalityInference,
        market_hub
    ):
        self.nlp = nlp
        self.corr = corr_engine
        self.causal = causal_engine
        self.market = market_hub
        self.tp_extractor = TargetPriceExtractor()
        self.outlook = OutlookSummarizer()

    def generate(
        self,
        symbol: str,
        articles: List[ArticleResult],
        from_dt: datetime,
        to_dt: datetime,
        peer_symbols: Optional[List[str]] = None
    ) -> AnalystReport:
        """종합 애널리스트 리포트 생성"""

        log.info(f"Generating analyst report for {symbol} ({len(articles)} articles)")

        # 1. 목표주가 집계
        target_prices = self._aggregate_target_prices(articles)

        # 2. 감성 분석 (전체 기사)
        sentiment_result = self._aggregate_sentiment(articles)
        sentiment_score = sentiment_result["score"]
        sentiment_dist = sentiment_result["distribution"]

        # 3. 핵심 인사이트 추출
        insights = self._extract_insights(articles, symbol)

        # 4. 상관관계 분석
        correlations = []
        if peer_symbols:
            correlations = self._analyze_correlations(symbol, peer_symbols, from_dt, to_dt)

        # 5. 영향 예측
        predictions = []
        recent_change = self._get_recent_price_change(symbol, from_dt, to_dt)
        if recent_change is not None:
            predictions = self.causal.predict_impact(symbol, recent_change, window_days=14)

        # 6. 차트 경로 (이미지 다운로드된 것 기준)
        charts = self._collect_chart_paths(articles)

        # 7. 요약 생성
        summary = self._generate_executive_summary(
            symbol,
            sentiment_score,
            sentiment_dist,
            target_prices,
            insights,
            correlations,
            predictions
        )

        # 8. 기사 정보 변환
        supporting_articles = [self._article_to_dict(a) for a in articles]

        report = AnalystReport(
            symbol=symbol,
            period_start=from_dt.strftime("%Y-%m-%d"),
            period_end=to_dt.strftime("%Y-%m-%d"),
            executive_summary=summary,
            target_prices=target_prices,
            sentiment_score=sentiment_score,
            sentiment_distribution=sentiment_dist,
            key_insights=insights,
            correlation_analysis=correlations,
            impact_predictions=predictions,
            charts=charts,
            supporting_articles=supporting_articles,
            generated_at=datetime.now(timezone.utc).isoformat()
        )

        log.info(f"Report generated: {len(target_prices)} targets, {len(correlations)} correlations")
        return report

    def _aggregate_target_prices(self, articles: List[ArticleResult]) -> List[TargetPrice]:
        """기사에서 목표주가 추출 및 집계"""
        all_targets = []

        for article in articles:
            # 본문에서 목표주가 추출
            text = article.summary  # 요약문 사용 (전체 본문은 저장 안 됨)
            targets = self.tp_extractor.extract(text, article.url)
            all_targets.extend(targets)

        # 중복 제거 (같은 브로커, 비슷한 가격)
        unique_targets = self._deduplicate_targets(all_targets)

        log.info(f"Found {len(unique_targets)} unique target prices")
        return unique_targets

    def _deduplicate_targets(self, targets: List[TargetPrice]) -> List[TargetPrice]:
        """목표주가 중복 제거"""
        # 간단히 브로커별 최신값만 유지
        broker_map = {}
        for target in targets:
            key = target.broker
            if key not in broker_map:
                broker_map[key] = target
            # 날짜 비교해서 최신값 유지 (생략)

        return list(broker_map.values())

    def _aggregate_sentiment(self, articles: List[ArticleResult]) -> Dict[str, Any]:
        """감성 집계"""
        if not articles:
            return {
                "score": 0.0,
                "distribution": {"positive": 0, "neutral": 0, "negative": 0}
            }

        sentiments = [a.sentiment for a in articles]

        pos = sum(1 for s in sentiments if s == "good")
        neu = sum(1 for s in sentiments if s == "neutral")
        neg = sum(1 for s in sentiments if s == "bad")

        total = len(sentiments)
        score = (pos - neg) / total if total > 0 else 0.0

        return {
            "score": score,
            "distribution": {"positive": pos, "neutral": neu, "negative": neg}
        }

    def _extract_insights(self, articles: List[ArticleResult], symbol: str) -> List[Insight]:
        """핵심 인사이트 추출"""
        insights = []

        # 1. Valuation 인사이트 (목표주가 관련)
        # 생략 (목표주가 분석 기반)

        # 2. Momentum 인사이트 (감성 기반)
        outlook = self.outlook.summarize(articles, symbol)
        if outlook["sentiment_score"] > 0.3:
            insights.append(Insight(
                category="momentum",
                title="강한 상승 모멘텀",
                description=f"최근 {len(articles)}개 기사에서 긍정적 언급 {outlook['sentiment_distribution']['positive']}회",
                confidence=0.75,
                sources=[a.url for a in articles[:3]]
            ))

        # 3. Risk 인사이트
        if outlook["sentiment_score"] < -0.2:
            insights.append(Insight(
                category="risk",
                title="부정적 시각 증가",
                description=f"부정 기사 {outlook['sentiment_distribution']['negative']}개, 주의 필요",
                confidence=0.70,
                sources=[a.url for a in articles[:3]]
            ))

        # 4. Catalyst 인사이트 (키워드 기반)
        top_keywords = outlook["top_keywords"][:5]
        if any("earnings" in kw["word"].lower() for kw in top_keywords):
            insights.append(Insight(
                category="catalyst",
                title="실적 발표 주목",
                description="실적 관련 언급 빈도 높음",
                confidence=0.65,
                sources=[]
            ))

        return insights

    def _analyze_correlations(
        self,
        symbol: str,
        peer_symbols: List[str],
        from_dt: datetime,
        to_dt: datetime
    ) -> List:
        """상관관계 분석"""
        try:
            results = self.corr.find_related_assets(
                symbol,
                peer_symbols,
                from_dt,
                to_dt,
                threshold=0.4
            )
            return results
        except Exception as e:
            log.warning(f"Correlation analysis failed: {e}")
            return []

    def _get_recent_price_change(
        self,
        symbol: str,
        from_dt: datetime,
        to_dt: datetime
    ) -> Optional[float]:
        """최근 가격 변화율 계산"""
        try:
            from ..data import YahooProvider
            provider = YahooProvider()
            data = provider.fetch(symbol, from_dt, to_dt)

            if not data or len(data) < 2:
                return None

            first_close = data[0]["c"]
            last_close = data[-1]["c"]

            change_pct = ((last_close - first_close) / first_close) * 100
            return change_pct

        except Exception as e:
            log.warning(f"Failed to get price change for {symbol}: {e}")
            return None

    def _collect_chart_paths(self, articles: List[ArticleResult]) -> List[str]:
        """차트 이미지 경로 수집"""
        # 실제로는 ImageStore에서 조회해야 하지만, 간단히 빈 리스트 반환
        return []

    def _generate_executive_summary(
        self,
        symbol: str,
        sentiment_score: float,
        sentiment_dist: Dict[str, int],
        target_prices: List[TargetPrice],
        insights: List[Insight],
        correlations: List,
        predictions: List
    ) -> str:
        """요약문 생성"""

        # 감성 해석
        if sentiment_score > 0.3:
            sentiment_text = "강한 긍정적 전망"
        elif sentiment_score > 0.1:
            sentiment_text = "긍정적 전망"
        elif sentiment_score > -0.1:
            sentiment_text = "중립적 전망"
        elif sentiment_score > -0.3:
            sentiment_text = "부정적 전망"
        else:
            sentiment_text = "강한 부정적 전망"

        # 목표주가 요약
        target_summary = ""
        if target_prices:
            values = [tp.value for tp in target_prices]
            avg_target = sum(values) / len(values)
            max_target = max(values)
            min_target = min(values)
            target_summary = f"주요 브로커 목표가 평균 ${avg_target:.2f} (최고 ${max_target:.2f}, 최저 ${min_target:.2f}). "

        # 상관관계 요약
        corr_summary = ""
        if correlations:
            strong_corrs = [c for c in correlations if c.strength == "strong"]
            if strong_corrs:
                corr_symbols = ", ".join([c.symbol_b for c in strong_corrs[:3]])
                corr_summary = f"{corr_symbols}와 강한 상관관계. "

        # 영향 예측 요약
        pred_summary = ""
        if predictions:
            top_pred = predictions[0]
            pred_summary = f"{top_pred.target} {top_pred.expected_direction} 영향 예상 (신뢰도 {top_pred.confidence*100:.0f}%). "

        summary = (
            f"{symbol} 분석 결과: {sentiment_text} ({sentiment_dist['positive']}개 긍정, "
            f"{sentiment_dist['neutral']}개 중립, {sentiment_dist['negative']}개 부정). "
            f"{target_summary}{corr_summary}{pred_summary}"
        )

        return summary

    @staticmethod
    def _article_to_dict(article: ArticleResult) -> Dict[str, Any]:
        """ArticleResult를 Dict로 변환"""
        return {
            "url": article.url,
            "title": article.title,
            "published_at": article.published_at,
            "summary": article.summary,
            "sentiment": article.sentiment,
            "top_words": article.top_words[:10]
        }