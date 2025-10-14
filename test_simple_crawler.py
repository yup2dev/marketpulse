"""
단순화된 크롤러 테스트
"""
import logging
from index_analyzer.crawling.crawler import Crawler
from index_analyzer.crawling.url_classifier import URLClassifier
from index_analyzer.parsing.heuristics import ArticleHeuristics
from index_analyzer.models.schemas import CrawlConfig

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

def main():
    config = CrawlConfig(
        max_total=10,
        max_depth=2,
        same_domain_only=True,
    )

    classifier = URLClassifier()
    heuristics = ArticleHeuristics(allow=(), deny=())

    crawler = Crawler(
        ccfg=config,
        heur=heuristics,
        classifier=classifier,
        max_depth=2,
    )

    seed_urls = ["https://www.reuters.com/world/"]

    print("=" * 80)
    print("단순 크롤러 테스트")
    print("=" * 80)

    results = list(crawler.discover(seed_urls))

    print(f"\n수집된 URL: {len(results)}개\n")

    for url, depth in results:
        print(f"[Depth {depth}] {url}")

if __name__ == "__main__":
    main()
