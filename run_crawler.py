"""
크롤러 실행 스크립트
"""
import logging
import json
from datetime import datetime
from index_analyzer.crawling.crawler import Crawler
from index_analyzer.crawling.url_classifier import URLClassifier
from index_analyzer.parsing.heuristics import ArticleHeuristics
from index_analyzer.parsing.parser import Parser
from index_analyzer.models.schemas import CrawlConfig

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
log = logging.getLogger(__name__)

def main():
    # 설정
    config = CrawlConfig(
        max_total=30,
        max_depth=2,
        same_domain_only=True,
    )

    classifier = URLClassifier()
    heuristics = ArticleHeuristics(allow=(), deny=())

    crawler = Crawler(
        ccfg=config,
        heur=heuristics,
        classifier=classifier,
        max_depth=config.max_depth,
    )

    # sites.yaml에서 seed URL 로드
    from index_analyzer.config.loader import ConfigLoader

    sites = ConfigLoader.load_sites("./sites.yaml")
    seed_urls = []
    for site in sites:
        seed_urls.extend(site.seed_urls)

    if not seed_urls:
        log.error("sites.yaml에서 seed URL을 찾을 수 없습니다.")
        return

    print("=" * 80)
    print("뉴스 크롤러 시작")
    print(f"Seed URLs: {len(seed_urls)}개")
    print(f"Max Total: {config.max_total}")
    print(f"Max Depth: {config.max_depth}")
    print("=" * 80)

    # 크롤링
    discovered_urls = list(crawler.discover(seed_urls))
    log.info(f"발견된 URL: {len(discovered_urls)}개")

    # 기사 파싱
    articles = []
    for url, depth in discovered_urls:
        try:
            html = crawler.http.get_html(url, timeout=10.0)
            if not html:
                continue

            parser = Parser(url, html)
            title = parser.extract_title()
            published_time = parser.extract_published_time()
            text = parser.extract_main_text()
            _, charts = parser.extract_images()

            article = {
                "url": url,
                "title": title,
                "published_time": str(published_time) if published_time else None,
                "text_preview": text[:300] if text else "",
                "charts": [c.src for c in charts],
                "depth": depth,
            }
            articles.append(article)

            print(f"\n[{len(articles)}] {title[:80]}")
            print(f"    URL: {url}")
            print(f"    발행일: {published_time or 'N/A'}")
            print(f"    차트: {len(charts)}개")
            if charts:
                for chart in charts:
                    print(f"      - {chart.src}")

        except Exception as e:
            log.error(f"파싱 실패 {url}: {e}")
            continue

    # 결과 저장
    with open("articles.json", "w", encoding="utf-8") as f:
        json.dump(articles, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 80)
    print(f"수집 완료: {len(articles)}개 기사")
    print(f"결과 저장: articles.json")
    print("=" * 80)

    # 통계
    total_charts = sum(len(a["charts"]) for a in articles)
    print(f"\n통계:")
    print(f"  - 총 기사: {len(articles)}개")
    print(f"  - 총 차트: {total_charts}개")
    print(f"  - 평균 차트/기사: {total_charts/len(articles):.1f}개" if articles else "")

if __name__ == "__main__":
    main()
