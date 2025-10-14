"""
디버깅용 크롤러 테스트
"""
import logging
from index_analyzer.crawling.url_classifier import URLClassifier
from index_analyzer.crawling.http_client import HttpClient
from index_analyzer.models.schemas import CrawlConfig

# 디버그 레벨 로깅
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

def test_url_classifier():
    print("=" * 80)
    print("URL 분류기 테스트")
    print("=" * 80)

    classifier = URLClassifier()

    test_urls = [
        "https://www.reuters.com/world/",
        "https://www.reuters.com/world/europe/",
        "https://www.reuters.com/world/us/trump-election-2024-10-02/",
        "https://www.reuters.com/business/finance/fed-signals-rate-cut-2024-10-02/",
    ]

    for url in test_urls:
        label = classifier.classify(url)
        print(f"{label:12} | {url}")
    print()

def test_http_client():
    print("=" * 80)
    print("HTTP 클라이언트 테스트")
    print("=" * 80)

    config = CrawlConfig()
    client = HttpClient(config.user_agent)

    url = "https://www.reuters.com/world/"
    html = client.get_html(url, timeout=10.0)

    if html:
        print(f"성공: {len(html)} bytes 수신")
        print(f"HTML 미리보기:\n{html[:500]}")
    else:
        print("실패: HTML을 가져올 수 없음")
    print()

if __name__ == "__main__":
    test_url_classifier()
    test_http_client()
