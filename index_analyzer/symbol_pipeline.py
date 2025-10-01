import json
import hashlib
import logging
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional
from dataclasses import asdict

from .models.schemas import SiteConfig, CrawlConfig, AnalysisConfig, ArticleResult
from .pipeline import Pipeline
from .filtering import SymbolFilter
from .media import ImageDownloader, ImageStore, ImageAnalyzer
from .intelligence import CorrelationEngine, CausalityInference
from .report import AnalystReportGenerator
from .analysis import NLPAnalyzer
from .data import MarketDataHub

log = logging.getLogger("multiseed-extractor")


class SymbolPipeline:
    """
    Symbol 모드 파이프라인
    특정 종목에 대한 종합 분석 리포트 생성
    """

    def __init__(
        self,
        base_pipeline: Pipeline,
        image_storage_path: Path = Path("./data/images"),
        enable_image_download: bool = True,
        enable_ocr: bool = False
    ):
        self.base_pipeline = base_pipeline
        self.filter = SymbolFilter()
        self.image_downloader = ImageDownloader(image_storage_path) if enable_image_download else None
        self.image_store = ImageStore() if enable_image_download else None
        self.image_analyzer = ImageAnalyzer() if enable_ocr else None

        # Intelligence 엔진
        self.market_hub = base_pipeline.market
        self.corr_engine = CorrelationEngine(self.market_hub)
        self.causal_engine = CausalityInference(self.market_hub)

        # 리포트 생성기
        self.report_generator = AnalystReportGenerator(
            nlp=base_pipeline.nlp,
            corr_engine=self.corr_engine,
            causal_engine=self.causal_engine,
            market_hub=self.market_hub
        )

    def run(
        self,
        sites: List[SiteConfig],
        symbol: str,
        from_dt: datetime,
        to_dt: datetime,
        peer_symbols: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Symbol 모드 실행
        1. 크롤링 (기간 필터링 없이 전체 수집)
        2. Symbol 필터링
        3. 이미지 다운로드 & 분석
        4. 애널리스트 리포트 생성
        """

        log.info(f"Running Symbol Pipeline for {symbol} ({from_dt.date()} ~ {to_dt.date()})")

        # Step 1: 크롤링
        log.info("Step 1: Crawling articles...")
        crawl_result = self.base_pipeline.run(sites)
        all_articles = self._parse_articles(crawl_result["results"])
        log.info(f"Crawled {len(all_articles)} articles")

        # Step 2: 날짜 필터링
        log.info("Step 2: Filtering by date...")
        date_filtered = self._filter_by_date(all_articles, from_dt, to_dt)
        log.info(f"Date filtered: {len(date_filtered)} articles")

        # Step 3: Symbol 필터링
        log.info(f"Step 3: Filtering by symbol {symbol}...")
        symbol_filtered = self.filter.filter_by_symbol(date_filtered, symbol)
        log.info(f"Symbol filtered: {len(symbol_filtered)} articles")

        if not symbol_filtered:
            log.warning(f"No articles found for {symbol}")
            return self._empty_result(symbol, from_dt, to_dt)

        # Step 4: 이미지 다운로드 & 분석
        if self.image_downloader:
            log.info("Step 4: Downloading and analyzing images...")
            self._process_images(symbol_filtered, symbol)

        # Step 5: 애널리스트 리포트 생성
        log.info("Step 5: Generating analyst report...")
        report = self.report_generator.generate(
            symbol=symbol,
            articles=symbol_filtered,
            from_dt=from_dt,
            to_dt=to_dt,
            peer_symbols=peer_symbols or self._get_default_peers(symbol)
        )

        # Step 6: 결과 구성
        result = {
            "symbol": symbol,
            "period": {
                "from": from_dt.strftime("%Y-%m-%d"),
                "to": to_dt.strftime("%Y-%m-%d")
            },
            "report": asdict(report),
            "articles_count": len(symbol_filtered),
            "generated_at": datetime.now().isoformat()
        }

        log.info(f"Symbol pipeline completed for {symbol}")
        return result

    def _parse_articles(self, results: List[Dict]) -> List[ArticleResult]:
        """Dict를 ArticleResult로 변환"""
        articles = []
        for r in results:
            try:
                # 간단한 변환 (정확한 스키마 매핑 필요)
                from ..models.schemas import ImageInfo
                article = ArticleResult(
                    url=r["url"],
                    title=r["title"],
                    published_at=r.get("published_at"),
                    summary=r["summary"],
                    top_words=r["top_words"],
                    percents=r.get("percents", []),
                    sentiment=r["sentiment"],
                    images=[ImageInfo(**img) for img in r.get("images", [])],
                    charts=[ImageInfo(**img) for img in r.get("charts", [])],
                    mapped=r["mapped"],
                    related_data_plan=r["related_data_plan"],
                    fetched_series=r["fetched_series"],
                    depth=r["depth"]
                )
                articles.append(article)
            except Exception as e:
                log.warning(f"Failed to parse article {r.get('url')}: {e}")
                continue

        return articles

    def _filter_by_date(
        self,
        articles: List[ArticleResult],
        from_dt: datetime,
        to_dt: datetime
    ) -> List[ArticleResult]:
        """날짜 필터링"""
        filtered = []

        for article in articles:
            if not article.published_at:
                continue

            try:
                pub_dt = datetime.fromisoformat(article.published_at.replace("Z", "+00:00"))
                if from_dt <= pub_dt <= to_dt:
                    filtered.append(article)
            except Exception:
                continue

        return filtered

    def _process_images(self, articles: List[ArticleResult], symbol: str):
        """이미지 다운로드 & 분석"""
        for article in articles:
            article_id = hashlib.md5(article.url.encode()).hexdigest()[:8]

            # 이미지 + 차트 다운로드
            all_images = article.images + article.charts
            if not all_images:
                continue

            downloaded = self.image_downloader.download_batch(all_images, article_id)

            # 메타데이터 저장
            for img, path in zip(all_images, downloaded):
                if path:
                    self.image_store.add(path, article.url, img.is_chart, img.alt)

            # OCR 분석 (차트만)
            if self.image_analyzer:
                chart_paths = [p for p, img in zip(downloaded, all_images) if img.is_chart and p]
                for chart_path in chart_paths:
                    metadata = self.image_analyzer.analyze(chart_path)
                    # 메타데이터 저장 (생략)

    def _get_default_peers(self, symbol: str) -> List[str]:
        """기본 비교 종목 (섹터 기준)"""
        # 간단한 매핑
        sector_peers = {
            "NVDA": ["AMD", "TSM", "INTC", "AVGO"],
            "AMD": ["NVDA", "TSM", "INTC"],
            "TSLA": ["RIVN", "LCID", "NIO", "F", "GM"],
            "AAPL": ["MSFT", "GOOGL", "AMZN", "META"],
        }

        return sector_peers.get(symbol.upper(), [])

    def _empty_result(self, symbol: str, from_dt: datetime, to_dt: datetime) -> Dict[str, Any]:
        """빈 결과 반환"""
        return {
            "symbol": symbol,
            "period": {
                "from": from_dt.strftime("%Y-%m-%d"),
                "to": to_dt.strftime("%Y-%m-%d")
            },
            "report": None,
            "articles_count": 0,
            "generated_at": datetime.now().isoformat(),
            "error": f"No articles found for {symbol} in the specified period"
        }