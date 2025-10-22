"""
크롤러 실행 스크립트
"""
import io
import sys
import logging
import json
from datetime import datetime

# Fix Windows encoding for Korean characters
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from index_analyzer.crawling.crawler import Crawler
from index_analyzer.crawling.url_classifier import URLClassifier
from index_analyzer.parsing.heuristics import ArticleHeuristics
from index_analyzer.parsing.parser import Parser
from index_analyzer.models.schemas import CrawlConfig, ImageInfo
from index_analyzer.media.image_downloader import ImageDownloader

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

    # 이미지 다운로더 초기화
    image_downloader = ImageDownloader(storage_path="./data/images", max_workers=5)

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

            # 차트 이미지 다운로드
            article_id = f"article_{len(articles)+1:04d}"
            downloaded_chart_paths = []

            if charts:
                print(f"\n차트 이미지 다운로드 중... ({len(charts)}개)")
                chart_paths = image_downloader.download_batch(charts, article_id)
                # None이 아닌 경로만 저장 (다운로드 성공한 것만)
                downloaded_chart_paths = [str(p) for p in chart_paths if p is not None]

            article = {
                "url": url,
                "title": title,
                "published_time": str(published_time) if published_time else None,
                "text_preview": text[:300] if text else "",
                "chart_urls": [c.src for c in charts],  # 원본 URL
                "chart_images": downloaded_chart_paths,  # 다운로드된 이미지 경로
                "depth": depth,
            }
            articles.append(article)

            print(f"\n[{len(articles)}] {title[:80]}")
            print(f"    URL: {url}")
            print(f"    발행일: {published_time or 'N/A'}")
            print(f"    차트 URL: {len(charts)}개")
            print(f"    다운로드된 차트: {len(downloaded_chart_paths)}개")
            if charts:
                for i, chart in enumerate(charts):
                    status = "✓" if i < len(downloaded_chart_paths) else "✗"
                    print(f"      {status} {chart.src}")

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
    total_chart_urls = sum(len(a["chart_urls"]) for a in articles)
    total_chart_images = sum(len(a["chart_images"]) for a in articles)
    print(f"\n통계:")
    print(f"  - 총 기사: {len(articles)}개")
    print(f"  - 총 차트 URL: {total_chart_urls}개")
    print(f"  - 다운로드된 차트 이미지: {total_chart_images}개")
    print(f"  - 다운로드 성공률: {(total_chart_images/total_chart_urls*100):.1f}%" if total_chart_urls > 0 else "")
    print(f"  - 평균 차트/기사: {total_chart_images/len(articles):.1f}개" if articles else "")

if __name__ == "__main__":
    main()
