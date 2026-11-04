"""
Pipeline Module — thin orchestration stages.

뉴스 크롤링 파이프라인: IN → PROC → CALC → RCMD
"""
try:
    from .in_stage import crawl_with_stream
except ImportError:
    pass

try:
    from .proc_stage import process_article, calculate_metrics, generate_recommendation
except ImportError:
    pass

__all__ = []
