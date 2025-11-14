"""
Pipeline Module

뉴스 크롤링 파이프라인: IN → PROC → CALC → RCMD
"""

# Import functions from modules if classes don't exist
try:
    from index_analyzer.pipeline.in_module import crawl_with_stream
except ImportError:
    pass

try:
    from index_analyzer.pipeline.proc_module import process_article
except ImportError:
    pass

try:
    from index_analyzer.pipeline.calc_module import calculate_metrics
except ImportError:
    pass

try:
    from index_analyzer.pipeline.rcmd_module import generate_recommendation
except ImportError:
    pass

__all__ = []
