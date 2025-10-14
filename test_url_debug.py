"""
URL 분류 디버깅
"""
from index_analyzer.crawling.url_classifier import URLClassifier

classifier = URLClassifier()

# CNN URL 테스트
test_urls = [
    # 카테고리 (기사 아님)
    "https://edition.cnn.com/world",
    "https://edition.cnn.com/world/africa",
    "https://edition.cnn.com/world/americas",
    "https://edition.cnn.com/business/tech",
    "https://edition.cnn.com/business/media",
    "https://edition.cnn.com/markets/premarkets",

    # 실제 기사
    "https://edition.cnn.com/2025/10/02/world/ukraine-russia-war-latest/index.html",
    "https://edition.cnn.com/2025/10/02/business/tesla-stock-analysis/index.html",
    "https://edition.cnn.com/world/live-news/israel-gaza-war-10-02-25/index.html",
]

print("URL 분류 테스트")
print("=" * 80)

for url in test_urls:
    label = classifier.classify(url)
    print(f"{label:12} | {url}")
