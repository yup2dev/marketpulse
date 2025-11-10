"""
Summarization Service - Transformer 기반 기사 요약
"""
import logging
from typing import Optional, Dict

log = logging.getLogger(__name__)


class SummarizationService:
    """
    Transformer 기반 텍스트 요약 서비스

    지원 모델:
    - facebook/bart-large-cnn (영어, 고품질)
    - sshleifer/distilbart-cnn-12-6 (영어, 빠름, 기본값)
    - t5-small (영어, 가벼움)
    - eenzeenee/t5-base-korean-summarization (한국어)
    """

    def __init__(
        self,
        model_name: str = "sshleifer/distilbart-cnn-12-6",
        use_transformers: bool = True,
        max_length: int = 150,
        min_length: int = 50,
        device: str = "cpu"
    ):
        """
        Args:
            model_name: Hugging Face 모델 이름
            use_transformers: transformers 사용 여부 (False면 추출 요약)
            max_length: 요약 최대 길이 (토큰)
            min_length: 요약 최소 길이 (토큰)
            device: 'cpu' 또는 'cuda'
        """
        self.model_name = model_name
        self.max_length = max_length
        self.min_length = min_length
        self.device = device
        self.summarizer = None

        if use_transformers:
            try:
                from transformers import pipeline

                log.info(f"Loading summarization model: {model_name}")

                self.summarizer = pipeline(
                    "summarization",
                    model=model_name,
                    device=0 if device == "cuda" else -1,  # -1 for CPU
                    truncation=True
                )

                log.info(f"Summarization model loaded successfully on {device}")

            except Exception as e:
                log.warning(f"Failed to load summarization model: {e}. Using extractive fallback.")
                self.summarizer = None
        else:
            log.info("Using extractive summarization (no transformers)")
            self.summarizer = None

    def summarize(
        self,
        text: str,
        max_length: Optional[int] = None,
        min_length: Optional[int] = None
    ) -> Dict[str, str]:
        """
        텍스트 요약

        Args:
            text: 원본 텍스트
            max_length: 요약 최대 길이 (None이면 기본값 사용)
            min_length: 요약 최소 길이 (None이면 기본값 사용)

        Returns:
            {
                'summary': str,  # 요약 텍스트
                'method': 'abstractive' | 'extractive',  # 요약 방법
                'original_length': int,  # 원본 길이
                'summary_length': int  # 요약 길이
            }
        """
        if not text or not text.strip():
            return {
                'summary': '',
                'method': 'none',
                'original_length': 0,
                'summary_length': 0
            }

        # Transformer 모델 사용
        if self.summarizer:
            return self._summarize_abstractive(text, max_length, min_length)

        # Fallback: 추출 요약
        return self._summarize_extractive(text, max_length)

    def _summarize_abstractive(
        self,
        text: str,
        max_length: Optional[int] = None,
        min_length: Optional[int] = None
    ) -> Dict[str, str]:
        """
        추상적 요약 (Abstractive Summarization)
        Transformer 모델을 사용한 생성 기반 요약
        """
        try:
            # 파라미터 설정
            max_len = max_length or self.max_length
            min_len = min_length or self.min_length

            # 텍스트 길이 제한 (BART/T5는 1024 토큰 제한)
            # 대략 토큰 = 단어 수 * 1.3
            max_input_words = 700  # ~900 토큰
            words = text.split()

            if len(words) > max_input_words:
                text_truncated = ' '.join(words[:max_input_words])
            else:
                text_truncated = text

            # 요약 생성
            result = self.summarizer(
                text_truncated,
                max_length=max_len,
                min_length=min_len,
                do_sample=False,  # 결정론적 생성
                truncation=True
            )[0]

            summary_text = result['summary_text']

            return {
                'summary': summary_text,
                'method': 'abstractive',
                'original_length': len(text),
                'summary_length': len(summary_text)
            }

        except Exception as e:
            log.error(f"Abstractive summarization failed: {e}")
            # Fallback to extractive
            return self._summarize_extractive(text, max_length)

    def _summarize_extractive(
        self,
        text: str,
        max_length: Optional[int] = None
    ) -> Dict[str, str]:
        """
        추출 요약 (Extractive Summarization)
        중요 문장을 그대로 추출하는 간단한 요약
        """
        try:
            # 최대 길이 (문자 수)
            max_chars = max_length or 200

            if len(text) <= max_chars:
                return {
                    'summary': text,
                    'method': 'extractive',
                    'original_length': len(text),
                    'summary_length': len(text)
                }

            # 문장 분리
            import re
            sentences = re.split(r'(?<=[.!?])\s+', text)

            # 첫 문장 우선 (뉴스는 주로 첫 문장에 핵심 내용)
            summary_parts = []
            current_length = 0

            for sentence in sentences:
                sentence = sentence.strip()
                if not sentence:
                    continue

                # 마침표로 끝나지 않으면 추가
                if sentence and sentence[-1] not in '.!?':
                    sentence += '.'

                # 길이 체크
                if current_length + len(sentence) > max_chars:
                    # 이미 충분한 길이면 중단
                    if current_length > max_chars * 0.7:
                        break
                    # 아니면 마지막 문장을 잘라서 추가
                    remaining = max_chars - current_length
                    if remaining > 50:  # 최소 50자는 있어야 의미 있음
                        truncated = sentence[:remaining - 3] + '...'
                        summary_parts.append(truncated)
                    break

                summary_parts.append(sentence)
                current_length += len(sentence) + 1  # +1 for space

            summary_text = ' '.join(summary_parts)

            return {
                'summary': summary_text,
                'method': 'extractive',
                'original_length': len(text),
                'summary_length': len(summary_text)
            }

        except Exception as e:
            log.error(f"Extractive summarization failed: {e}")
            # 최후의 Fallback: 단순 절단
            summary = text[:200]
            if len(text) > 200:
                # 마지막 문장 끝까지 포함
                last_period = summary.rfind('.')
                if last_period > 100:
                    summary = summary[:last_period + 1]
                else:
                    summary += '...'

            return {
                'summary': summary,
                'method': 'truncation',
                'original_length': len(text),
                'summary_length': len(summary)
            }

    def batch_summarize(self, texts: list) -> list:
        """
        배치 요약

        Args:
            texts: 텍스트 리스트

        Returns:
            요약 결과 리스트
        """
        results = []
        for text in texts:
            results.append(self.summarize(text))
        return results

    def get_model_info(self) -> Dict:
        """모델 정보 반환"""
        return {
            'model_name': self.model_name,
            'max_length': self.max_length,
            'min_length': self.min_length,
            'device': self.device,
            'is_loaded': self.summarizer is not None,
            'method': 'abstractive' if self.summarizer else 'extractive'
        }


# =============================================================================
# 싱글톤 인스턴스 (메모리 절약)
# =============================================================================

_summarization_service: Optional[SummarizationService] = None


def get_summarization_service(
    model_name: Optional[str] = None,
    use_transformers: bool = True
) -> SummarizationService:
    """
    SummarizationService 싱글톤

    Args:
        model_name: 모델 이름 (None이면 config에서 로드)
        use_transformers: transformers 사용 여부

    Returns:
        SummarizationService 인스턴스
    """
    global _summarization_service

    if _summarization_service is None:
        # config에서 설정 로드
        try:
            from app.core.config import settings

            model = model_name or getattr(
                settings,
                'SUMMARIZATION_MODEL',
                'sshleifer/distilbart-cnn-12-6'
            )

            use_tf = use_transformers and getattr(
                settings,
                'USE_TRANSFORMERS',
                True
            )

            max_len = getattr(settings, 'SUMMARY_MAX_LENGTH', 150)
            min_len = getattr(settings, 'SUMMARY_MIN_LENGTH', 50)

        except Exception as e:
            log.warning(f"Failed to load config: {e}. Using defaults.")
            model = model_name or 'sshleifer/distilbart-cnn-12-6'
            use_tf = use_transformers
            max_len = 150
            min_len = 50

        _summarization_service = SummarizationService(
            model_name=model,
            use_transformers=use_tf,
            max_length=max_len,
            min_length=min_len,
            device='cpu'  # GPU 사용시 'cuda'로 변경
        )

    return _summarization_service
