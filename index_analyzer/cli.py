import os
import json
import logging
import argparse

from .models.schemas import CrawlConfig, AnalysisConfig
from .crawling import URLClassifier, CategoryPolicy
from .parsing import ArticleHeuristics
from .config import ConfigLoader
from .pipeline import Pipeline

log = logging.getLogger("multiseed-extractor")
if not log.handlers:
    h = logging.StreamHandler()
    h.setFormatter(logging.Formatter("[%(levelname)s] %(message)s"))
    log.addHandler(h)
log.setLevel(logging.INFO)

try:
    from constants import SITES_CONFIG_PATH as _CONST_SITES_CFG  # type: ignore
except Exception:
    _CONST_SITES_CFG = os.environ.get("SITES_CONFIG_PATH", "./sites.yaml")


class JSONWriter:
    @staticmethod
    def save(obj, path: str) -> None:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, indent=2)


def run_cli() -> None:
    ap = argparse.ArgumentParser(description="AI Analyst Report Generator")

    # Subcommands
    subparsers = ap.add_subparsers(dest="command", help="Commands")

    # Crawl command (기본 크롤링)
    crawl_parser = subparsers.add_parser("crawl", help="Crawl news articles")
    crawl_parser.add_argument("--sites-config", default=_CONST_SITES_CFG)
    crawl_parser.add_argument("--max-total", type=int, default=40)
    crawl_parser.add_argument("--max-depth", type=int, default=2)
    crawl_parser.add_argument("--sleep", type=float, default=1)
    crawl_parser.add_argument("--topk", type=int, default=3)
    crawl_parser.add_argument("--summary-sents", type=int, default=3)
    crawl_parser.add_argument("--window-days", type=int, default=7)
    crawl_parser.add_argument("--min-word-freq", type=int, default=3)
    crawl_parser.add_argument("--out", default="news_output.json")

    # Analyze-symbol command (Symbol 모드)
    symbol_parser = subparsers.add_parser("analyze-symbol", help="Analyze specific symbol")
    symbol_parser.add_argument("--symbol", required=True, help="Stock ticker (e.g., NVDA)")
    symbol_parser.add_argument("--from", dest="from_date", required=True, help="Start date (YYYY-MM-DD)")
    symbol_parser.add_argument("--to", dest="to_date", required=True, help="End date (YYYY-MM-DD)")
    symbol_parser.add_argument("--peers", help="Comma-separated peer symbols (e.g., AMD,TSM,INTC)")
    symbol_parser.add_argument("--sites-config", default=_CONST_SITES_CFG)
    symbol_parser.add_argument("--max-total", type=int, default=100)
    symbol_parser.add_argument("--max-depth", type=int, default=3)
    symbol_parser.add_argument("--sleep", type=float, default=1)
    symbol_parser.add_argument("--topk", type=int, default=10)
    symbol_parser.add_argument("--summary-sents", type=int, default=5)
    symbol_parser.add_argument("--window-days", type=int, default=14)
    symbol_parser.add_argument("--min-word-freq", type=int, default=2)
    symbol_parser.add_argument("--out", default="symbol_report.json")
    symbol_parser.add_argument("--enable-images", action="store_true", help="Download images")
    symbol_parser.add_argument("--enable-ocr", action="store_true", help="Enable OCR analysis")

    args = ap.parse_args()

    # 커맨드가 없으면 기본 crawl 실행 (하위 호환성)
    if not args.command:
        args.command = "crawl"
        args.sites_config = _CONST_SITES_CFG
        args.max_total = 40
        args.max_depth = 2
        args.sleep = 1
        args.topk = 3
        args.summary_sents = 3
        args.window_days = 7
        args.min_word_freq = 3
        args.out = "news_output.json"

    # Command dispatch
    if args.command == "crawl":
        run_crawl_command(args)
    elif args.command == "analyze-symbol":
        run_symbol_command(args)


def run_crawl_command(args):
    """기본 크롤링 실행"""
    sites = ConfigLoader.load_sites(args.sites_config)
    if not sites:
        log.info("No sites found in %s", args.sites_config)
        return

    # 도메인별 allow/deny 통합
    allows = []
    denies = []
    for s in sites:
        allows.extend(s.article_allow)
        denies.extend(s.article_deny)

    heur = ArticleHeuristics(
        allow=ArticleHeuristics.compile(allows or [r"/news/|/article/|/story|/research|/report"]),
        deny=ArticleHeuristics.compile(denies or [r"/login|/signin|/account|/m/|/video|/photo|/gallery"]),
    )

    ccfg = CrawlConfig(
        max_total=args.max_total,
        max_depth=args.max_depth,
        sleep_between_requests=args.sleep
    )
    acfg = AnalysisConfig(
        top_k_words=args.topk,
        summary_sentences=args.summary_sents,
        data_window_days=args.window_days,
        min_word_freq=args.min_word_freq
    )

    policy = CategoryPolicy(
        category_slugs={"world", "news", "business", "markets", "technology", "politics", "korea", "asia", "us", "uk"}
    )
    classifier = URLClassifier(policy)

    pipe = Pipeline(ccfg, acfg, heur, classifier)
    result = pipe.run(sites)
    JSONWriter.save(result, args.out)
    print(f"[OK] Saved: {args.out}")


def run_symbol_command(args):
    """Symbol 모드 실행"""
    from datetime import datetime
    from .symbol_pipeline import SymbolPipeline

    sites = ConfigLoader.load_sites(args.sites_config)
    if not sites:
        log.info("No sites found in %s", args.sites_config)
        return

    # 도메인별 allow/deny 통합
    allows = []
    denies = []
    for s in sites:
        allows.extend(s.article_allow)
        denies.extend(s.article_deny)

    heur = ArticleHeuristics(
        allow=ArticleHeuristics.compile(allows or [r"/news/|/article/|/story|/research|/report"]),
        deny=ArticleHeuristics.compile(denies or [r"/login|/signin|/account|/m/|/video|/photo|/gallery"]),
    )

    ccfg = CrawlConfig(
        max_total=args.max_total,
        max_depth=args.max_depth,
        sleep_between_requests=args.sleep
    )
    acfg = AnalysisConfig(
        top_k_words=args.topk,
        summary_sentences=args.summary_sents,
        data_window_days=args.window_days,
        min_word_freq=args.min_word_freq
    )

    policy = CategoryPolicy(
        category_slugs={"world", "news", "business", "markets", "technology", "politics", "korea", "asia", "us", "uk"}
    )
    classifier = URLClassifier(policy)

    # Base pipeline 생성
    base_pipe = Pipeline(ccfg, acfg, heur, classifier)

    # Symbol pipeline 생성
    symbol_pipe = SymbolPipeline(
        base_pipeline=base_pipe,
        enable_image_download=args.enable_images,
        enable_ocr=args.enable_ocr
    )

    # 날짜 파싱
    try:
        from_dt = datetime.fromisoformat(args.from_date)
        to_dt = datetime.fromisoformat(args.to_date)
    except ValueError as e:
        print(f"Error: Invalid date format. Use YYYY-MM-DD. {e}")
        return

    # Peer symbols 파싱
    peer_symbols = None
    if args.peers:
        peer_symbols = [s.strip().upper() for s in args.peers.split(",")]

    # 실행
    print(f"Analyzing {args.symbol} from {args.from_date} to {args.to_date}...")
    result = symbol_pipe.run(sites, args.symbol, from_dt, to_dt, peer_symbols)

    # 저장
    JSONWriter.save(result, args.out)
    print(f"[OK] Analysis complete!")
    print(f"[OK] Articles found: {result.get('articles_count', 0)}")
    print(f"[OK] Saved: {args.out}")


if __name__ == "__main__":
    run_cli()