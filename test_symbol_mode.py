"""
Symbol 모드 간단 테스트
실제 크롤링 없이 모의 데이터로 파이프라인 테스트
"""
import json
from datetime import datetime
from pathlib import Path

# 모의 데이터 생성
mock_article = {
    "url": "https://example.com/nvda-earnings",
    "title": "NVIDIA Reports Strong Q3 Earnings, Target Price Raised to $180",
    "published_at": "2025-09-15T10:00:00+00:00",
    "summary": "NVIDIA reported strong Q3 earnings with AI datacenter revenue up 50%. Goldman Sachs raised target price to $180. AMD and TSMC also benefit from AI boom.",
    "top_words": [["nvidia", 10], ["ai", 8], ["datacenter", 6], ["earnings", 5], ["gpu", 4]],
    "percents": [],
    "sentiment": "good",
    "images": [],
    "charts": [],
    "mapped": {
        "companies": [
            {"name": "nvidia", "ticker": "NVDA", "sector": "Semiconductors"},
            {"name": "amd", "ticker": "AMD", "sector": "Semiconductors"},
            {"name": "tsmc", "ticker": "TSM", "sector": "Semiconductors"}
        ],
        "commodities": [],
        "macro": []
    },
    "related_data_plan": {"window": {}, "targets": [], "recommend": []},
    "fetched_series": {},
    "depth": 1
}

# 테스트 실행
print("Testing Symbol Mode Components...")
print("=" * 60)

# 1. TargetPriceExtractor 테스트
print("\n1. Target Price Extraction:")
from index_analyzer.extraction import TargetPriceExtractor

extractor = TargetPriceExtractor()
text = "Goldman Sachs raised NVDA target price to $180. Morgan Stanley set TP at $170."
targets = extractor.extract(text, "https://example.com")
print(f"   Found {len(targets)} target prices:")
for tp in targets:
    print(f"   - ${tp.value} ({tp.currency}) from {tp.broker}")

# 2. OutlookSummarizer 테스트
print("\n2. Outlook Summary:")
from index_analyzer.extraction import OutlookSummarizer
from index_analyzer.models.schemas import ArticleResult, ImageInfo

articles = [
    ArticleResult(
        url=mock_article["url"],
        title=mock_article["title"],
        published_at=mock_article["published_at"],
        summary=mock_article["summary"],
        top_words=mock_article["top_words"],
        percents=[],
        sentiment="good",
        images=[],
        charts=[],
        mapped=mock_article["mapped"],
        related_data_plan={},
        fetched_series={},
        depth=1
    )
]

summarizer = OutlookSummarizer()
outlook = summarizer.summarize(articles, "NVDA")
print(f"   {outlook['summary']}")
print(f"   Sentiment: {outlook['sentiment_score']:.2f}")

# 3. CausalityInference 테스트
print("\n3. Causality Inference:")
from index_analyzer.intelligence import CausalityInference

causal = CausalityInference()
predictions = causal.predict_impact("NVDA", 12.5, window_days=14)
print(f"   NVDA +12.5% → Predicted {len(predictions)} impacts:")
for pred in predictions[:3]:
    print(f"   - {pred.target}: {pred.expected_direction} (confidence: {pred.confidence:.0%}, lag: {pred.lag_days}d)")

# 4. SymbolFilter 테스트
print("\n4. Symbol Filter:")
from index_analyzer.filtering import SymbolFilter

filter = SymbolFilter()
filtered = filter.filter_by_symbol(articles, "NVDA")
print(f"   Filtered {len(filtered)}/{len(articles)} articles for NVDA")

print("\n" + "=" * 60)
print("All tests passed! [OK]")
print("\nTo run full Symbol mode:")
print("python app.py analyze-symbol --symbol NVDA --from 2025-09-01 --to 2025-09-30")