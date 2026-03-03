"""
Sentiment Analyzer - 금융 뉴스 감성 분석
"""
import re
import logging
from typing import Dict, Optional

from ..utils.logging import get_logger

log = get_logger(__name__)


class SentimentAnalyzer:
    """
    금융 뉴스 감성 분석기
    - FinBERT 모델 사용 (금융 특화)
    - 티커별 컨텍스트 감성 분석
    """

    def __init__(self, model_name: str = "ProsusAI/finbert", use_transformers: bool = True, db_session=None):
        """
        Args:
            model_name: Hugging Face 모델 이름
            use_transformers: transformers 라이브러리 사용 여부
            db_session: SQLAlchemy session (ticker 매핑용)
        """
        self.model_name = model_name
        self.model = None
        self.ticker_to_names = {}  # ticker → [name variants]

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

        # DB에서 ticker → name 매핑 로드
        self._load_ticker_mappings(db_session)

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

    def _load_ticker_mappings(self, db_session=None):
        """DB에서 ticker → name 매핑 로드"""
        try:
            if db_session is None:
                from ..utils.db import get_sqlite_db
                from pathlib import Path
                DB_PATH = Path(__file__).parent.parent.parent / "data" / "marketpulse.db"
                db = get_sqlite_db(str(DB_PATH))
                session = db.get_session()
                close_session = True
            else:
                session = db_session
                close_session = False

            from ..models.orm import MBS_IN_STBD_MST
            tickers = session.query(MBS_IN_STBD_MST).filter_by(is_active=True).all()

            for ticker in tickers:
                symbol = ticker.ticker_cd
                if not ticker.ticker_nm:
                    continue

                name_variants = set()
                company_name = ticker.ticker_nm.lower()
                name_variants.add(company_name)

                clean_name = re.sub(r'[,\(\)\[\]{}.]', '', company_name).strip()
                name_variants.add(clean_name)

                base_name = clean_name
                for suffix in [' inc', ' incorporated', ' corporation', ' corp', ' ltd', ' limited', ' llc', ' co', ' plc', ' group', ' company']:
                    base_name = base_name.replace(suffix, '')
                base_name = base_name.strip()

                if base_name:
                    name_variants.add(base_name)

                words = base_name.split()
                if len(words) == 1 and len(base_name) > 3:
                    name_variants.add(base_name)

                self.ticker_to_names[symbol.upper()] = list(name_variants)

            if close_session:
                session.close()

            log.info(f"Loaded {len(self.ticker_to_names)} ticker name mappings from database")

        except Exception as e:
            log.warning(f"Failed to load ticker mappings from database: {e}")
            self.ticker_to_names = {}

    def analyze(self, text: str) -> Dict:
        """
        텍스트 감성 분석

        Returns:
            {'label': 'positive'|'negative'|'neutral', 'score': float, 'confidence': float}
        """
        if not text or not text.strip():
            return {'label': 'neutral', 'score': 0.0, 'confidence': 0.0}

        if self.model:
            return self._sentiment_analyze(text)
        return self._analyze_with_rules(text)

    def _sentiment_analyze(self, text: str) -> Dict:
        """FinBERT 모델로 감성 분석"""
        try:
            text_truncated = text[:2000]
            result = self.model(text_truncated)[0]
            label = result['label'].lower()
            score = result['score']

            if label == 'positive':
                normalized_score = score
            elif label == 'negative':
                normalized_score = -score
            else:
                normalized_score = 0.0

            return {'label': label, 'score': normalized_score, 'confidence': score}

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
            return {'label': 'neutral', 'score': 0.0, 'confidence': 0.5}

        sentiment_score = (positive_count - negative_count) / total

        if sentiment_score > 0.2:
            label = 'positive'
        elif sentiment_score < -0.2:
            label = 'negative'
        else:
            label = 'neutral'

        confidence = min(total / 20, 1.0)
        return {'label': label, 'score': sentiment_score, 'confidence': confidence}

    def analyze_ticker_context(self, text: str, ticker: str) -> Dict:
        """특정 티커에 대한 컨텍스트 감성 분석"""
        sentences = self._extract_ticker_sentences(text, ticker)
        if not sentences:
            return self.analyze(text)

        context = ' '.join(sentences)
        result = self.analyze(context)
        result['context_based'] = True
        result['context_sentences'] = len(sentences)
        return result

    def _extract_ticker_sentences(self, text: str, ticker: str) -> list:
        """티커가 언급된 문장 추출"""
        sentences = re.split(r'[.!?]+', text)
        ticker_sentences = []
        ticker_upper = ticker.upper()

        for sentence in sentences:
            sentence_lower = sentence.lower()
            sentence_upper = sentence.upper()

            if ticker_upper in sentence_upper:
                ticker_sentences.append(sentence.strip())
                continue

            for name_variant in self.ticker_to_names.get(ticker_upper, []):
                if re.search(r'\b' + re.escape(name_variant) + r'\b', sentence_lower):
                    ticker_sentences.append(sentence.strip())
                    break

        return ticker_sentences

    def batch_analyze(self, texts: list) -> list:
        """배치 감성 분석"""
        return [self.analyze(text) for text in texts]

    def get_importance_score(self, sentiment: Dict, ticker_count: int, title_included: bool) -> float:
        """뉴스 중요도 점수 계산 (0.0 ~ 10.0)"""
        score = 5.0
        sentiment_weight = abs(sentiment['score']) * sentiment['confidence']
        score += sentiment_weight * 3
        score += min(ticker_count * 0.5, 2.0)
        if title_included:
            score += 1.5
        return min(score, 10.0)
