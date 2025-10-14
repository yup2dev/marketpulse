"""
멀티스레드 크롤러 테스트 스크립트
"""
import logging
import json
from datetime import datetime
from index_analyzer.crawling.multi_thread_crawler import MultiThreadCrawler
from index_analyzer.crawling.url_classifier import URLClassifier
from index_analyzer.parsing.heuristics import ArticleHeuristics
from index_analyzer.models.schemas import CrawlConfig

# 로깅 설정
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

def main():
    # 크롤러 설정
    config = CrawlConfig(
        max_total=20,
        max_depth=2,
        same_domain_only=True,
        timeout_get=10.0,
    )

    # URL 분류기
    classifier = URLClassifier()

    # 휴리스틱 (빈 패턴)
    heuristics = ArticleHeuristics(
        allow=(),
        deny=()
    )

    # 크롤러 초기화
    crawler = MultiThreadCrawler(
        config=config,
        heuristics=heuristics,
        classifier=classifier,
        max_workers=5,
    )

    # 테스트 seed URL
    seed_urls = [
        "https://www.reuters.com/world/",
    ]

    print("=" * 80)
    print("멀티스레드 크롤러 테스트 시작")
    print(f"Seed URLs: {seed_urls}")
    print(f"Max Total: {config.max_total}")
    print(f"Max Depth: {config.max_depth}")
    print(f"Workers: 5")
    print("=" * 80)

    # 크롤링 실행
    results = crawler.crawl(seed_urls)

    # 결과 출력
    print(f"\n수집된 기사: {len(results)}개\n")

    for i, article in enumerate(results, 1):
        print(f"{i}. {article.title[:80]}")
        print(f"   URL: {article.url}")
        print(f"   발행일: {article.published_time or 'N/A'}")
        print(f"   차트: {len(article.charts)}개")
        print(f"   깊이: {article.depth}")
        if article.charts:
            for chart_url in article.charts:
                print(f"      - {chart_url}")
        print(f"   본문 미리보기: {article.text[:100]}...")
        print()

    # JSON 저장
    output_data = []
    for article in results:
        output_data.append({
            "url": article.url,
            "title": article.title,
            "published_time": article.published_time,
            "text_preview": article.text[:200] if article.text else "",
            "charts": article.charts,
            "depth": article.depth,
        })

    with open("crawler_results.json", "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)

    print("=" * 80)
    print(f"결과 저장: crawler_results.json")
    print("=" * 80)

if __name__ == "__main__":
    main()
