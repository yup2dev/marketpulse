"""
Sentiment Analyzer - 금융 뉴스 감성 분석
"""
import logging
from typing import Dict, Optional
import re

log = logging.getLogger(__name__)


class SentimentAnalyzer:
    """
    금융 뉴스 감성 분석기
    - FinBERT 모델 사용 (금융 특화)
    - 티커별 컨텍스트 감성 분석
    """

    def __init__(self, model_name: str = "ProsusAI/finbert", use_transformers: bool = True):
        """
        Args:
            model_name: Hugging Face 모델 이름
            use_transformers: transformers 라이브러리 사용 여부
        """
        self.model_name = model_name
        self.model = None

        if use_transformers:
            try:
                from transformers import pipeline
                self.model = pipeline(
                    "sentiment-analysis",
                    model=model_name,
                    truncation=True,
                    max_length=512
                )
                log.info(f"Loaded sentiment model: {model_name}")
            except Exception as e:
                log.warning(f"Failed to load transformers model: {e}. Using fallback.")
                self.model = None

        # Fallback: 규칙 기반 감성 분석
        if self.model is None:
            log.info("Using rule-based sentiment analysis")
            self._init_lexicon()

    def _init_lexicon(self):
        """간단한 감성 사전 초기화 (Fallback용)"""
        self.positive_words = {
            'gain', 'gains', 'profit', 'profits', 'rise', 'rises', 'rising',
            'up', 'surge', 'surges', 'soar', 'soaring', 'rally', 'rallies',
            'growth', 'growing', 'increase', 'increases', 'strong', 'stronger',
            'beat', 'beats', 'exceed', 'exceeds', 'outperform', 'outperforms',
            'positive', 'bullish', 'buy', 'upgrade', 'upgraded', 'high', 'higher',
            'record', 'breakthrough', 'success', 'successful', 'win', 'wins'
        }

        self.negative_words = {
            'loss', 'losses', 'drop', 'drops', 'fall', 'falls', 'falling',
            'down', 'decline', 'declines', 'plunge', 'plunges', 'crash', 'crashes',
            'weak', 'weaker', 'decrease', 'decreases', 'miss', 'misses',
            'underperform', 'underperforms', 'negative', 'bearish', 'sell',
            'downgrade', 'downgraded', 'low', 'lower', 'worst', 'risk', 'risks',
            'concern', 'concerns', 'worry', 'worries', 'fear', 'fears'
        }

    def analyze(self, text: str) -> Dict:
        """
        텍스트 감성 분석

        Args:
            text: 분석할 텍스트

        Returns:
            {
                'label': 'positive' | 'negative' | 'neutral',
                'score': 0.0 ~ 1.0,  # 감성 강도
                'confidence': 0.0 ~ 1.0  # 예측 신뢰도
            }
        """
        if not text or not text.strip():
            return {
                'label': 'neutral',
                'score': 0.0,
                'confidence': 0.0
            }

        # Transformers 모델 사용
        if self.model:
            return self._analyze_with_model(text)

        # Fallback: 규칙 기반
        return self._analyze_with_rules(text)

    def _analyze_with_model(self, text: str) -> Dict:
        """FinBERT 모델로 감성 분석"""
        try:
            # 텍스트 길이 제한 (512 토큰)
            text_truncated = text[:2000]  # 대략 512 토큰

            result = self.model(text_truncated)[0]

            # FinBERT 출력 형식: {'label': 'positive', 'score': 0.95}
            label = result['label'].lower()
            score = result['score']

            # 점수 정규화 (-1 ~ 1)
            if label == 'positive':
                normalized_score = score
            elif label == 'negative':
                normalized_score = -score
            else:  # neutral
                normalized_score = 0.0

            return {
                'label': label,
                'score': normalized_score,
                'confidence': score
            }

        except Exception as e:
            log.error(f"Model analysis failed: {e}")
            return self._analyze_with_rules(text)

    def _analyze_with_rules(self, text: str) -> Dict:
        """규칙 기반 감성 분석 (Fallback)"""
        text_lower = text.lower()
        words = re.findall(r'\b\w+\b', text_lower)

        positive_count = sum(1 for word in words if word in self.positive_words)
        negative_count = sum(1 for word in words if word in self.negative_words)

        total = positive_count + negative_count

        if total == 0:
            return {
                'label': 'neutral',
                'score': 0.0,
                'confidence': 0.5
            }

        # 감성 점수 계산
        sentiment_score = (positive_count - negative_count) / total

        # 레이블 결정
        if sentiment_score > 0.2:
            label = 'positive'
        elif sentiment_score < -0.2:
            label = 'negative'
        else:
            label = 'neutral'

        # 신뢰도 (단어 수가 많을수록 높음)
        confidence = min(total / 20, 1.0)

        return {
            'label': label,
            'score': sentiment_score,
            'confidence': confidence
        }

    def analyze_ticker_context(self, text: str, ticker: str) -> Dict:
        """
        특정 티커에 대한 컨텍스트 감성 분석

        Args:
            text: 전체 기사 텍스트
            ticker: 분석할 티커 심볼

        Returns:
            감성 분석 결과
        """
        # 티커가 언급된 문장 추출
        sentences = self._extract_ticker_sentences(text, ticker)

        if not sentences:
            # 티커 언급이 없으면 전체 텍스트 분석
            return self.analyze(text)

        # 티커 관련 문장만 분석
        context = ' '.join(sentences)
        result = self.analyze(context)

        # 컨텍스트 기반 분석임을 표시
        result['context_based'] = True
        result['context_sentences'] = len(sentences)

        return result

    def _extract_ticker_sentences(self, text: str, ticker: str) -> list:
        """티커가 언급된 문장 추출"""
        sentences = re.split(r'[.!?]+', text)
        ticker_sentences = []

        for sentence in sentences:
            # 티커 심볼 또는 회사명이 포함된 문장
            if ticker.upper() in sentence.upper():
                ticker_sentences.append(sentence.strip())

        return ticker_sentences

    def batch_analyze(self, texts: list) -> list:
        """배치 감성 분석"""
        results = []
        for text in texts:
            results.append(self.analyze(text))
        return results

    def get_importance_score(self, sentiment: Dict, ticker_count: int, title_included: bool) -> float:
        """
        뉴스 중요도 점수 계산

        Args:
            sentiment: 감성 분석 결과
            ticker_count: 티커 언급 횟수
            title_included: 제목에 포함 여부

        Returns:
            중요도 점수 (0.0 ~ 10.0)
        """
        score = 5.0  # 기본 점수

        # 감성 강도에 따라 가중치
        sentiment_weight = abs(sentiment['score']) * sentiment['confidence']
        score += sentiment_weight * 3

        # 티커 언급 횟수
        score += min(ticker_count * 0.5, 2.0)

        # 제목 포함시 가중치
        if title_included:
            score += 1.5

        return min(score, 10.0)
