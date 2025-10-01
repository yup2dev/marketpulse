import re
from collections import Counter
from typing import List, Tuple, Dict, Any

from ..models.schemas import AnalysisConfig

# 정규식
PERCENT_RE = re.compile(r"(?P<value>\d{1,3}(?:\.\d+)?)\s*%")
SENT_SPLIT_RE = re.compile(r"(?<=[\.!?])\s+|(?<=다\.)\s+|(?<=요\.)\s+")
TOKEN_RE = re.compile(r"[A-Za-z가-힣]+")

STOPWORDS = {
    # en
    "the", "a", "an", "of", "and", "to", "in", "for", "on", "at", "by", "with", "from",
    "that", "this", "is", "are", "be", "as", "it", "its", "was", "were", "or", "if",
    "not", "we", "you", "they", "their", "our", "i",
    # ko
    "그리고", "또한", "하지만", "그러나", "이는", "이에", "에서", "으로", "에게",
    "하고", "하며", "및", "등", "대한", "것", "수", "등의", "있다", "없는",
    "됐다", "했다", "된다", "하는", "부터", "더", "가장",
}


class NLPAnalyzer:
    def __init__(self, acfg: AnalysisConfig) -> None:
        self.acfg = acfg

    @staticmethod
    def tokenize(text: str) -> List[str]:
        toks = [t.lower() for t in TOKEN_RE.findall(text)]
        return [t for t in toks if t not in STOPWORDS and len(t) > 1]

    def top_words(self, tokens: List[str]) -> List[Tuple[str, int]]:
        cnt = Counter(tokens)
        # 상위 top_k_words 내에서 빈도 self.acfg.min_word_freq 미만은 제외
        return [(w, c) for (w, c) in cnt.most_common(self.acfg.top_k_words) if c >= self.acfg.min_word_freq]

    def summarize(self, text: str) -> str:
        sents = re.split(SENT_SPLIT_RE, text)
        tokens = self.tokenize(text)
        freqs = Counter(tokens)
        scored: List[Tuple[float, str]] = []
        for s in sents:
            if not s or len(s) < 20:
                continue
            score = sum(freqs.get(tok, 0) for tok in self.tokenize(s))
            if score:
                scored.append((score, s.strip()))
        scored.sort(reverse=True, key=lambda x: x[0])
        return " ".join([s for _, s in scored[:self.acfg.summary_sentences]])

    @staticmethod
    def percent_mentions(text: str) -> List[Dict[str, Any]]:
        out: List[Dict[str, Any]] = []
        for m in PERCENT_RE.finditer(text):
            val = float(m.group("value"))
            start, end = m.span()
            ctx = text[max(0, start-40): min(len(text), end+40)]
            out.append({"value": val, "context": ctx})
        return out

    @staticmethod
    def simple_sentiment(text: str) -> str:
        pos = {"positive", "good", "improve", "growth", "rally", "up", "increase", "beat",
               "strong", "expand", "record", "surge", "bull", "호재", "상승", "개선",
               "강세", "확대", "증가"}
        neg = {"negative", "bad", "decline", "drop", "down", "miss", "weak", "recession",
               "fall", "risk", "bear", "악재", "하락", "둔화", "약세", "축소", "감소"}
        tl = NLPAnalyzer.tokenize(text)
        p = sum(1 for t in tl if t in pos)
        n = sum(1 for t in tl if t in neg)
        if p > n*1.2 and p >= 2:
            return "good"
        if n > p*1.2 and n >= 2:
            return "bad"
        return "neutral"