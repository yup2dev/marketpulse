"""
Analyzer Consumer - Redis Stream에서 신규 기사 수신 및 분석 파이프라인 실행
"""
from ..utils.logging import get_logger

log = get_logger(__name__)


def start_analyzer_consumer(event_bus):
    """
    Analyzer Consumer 시작

    Args:
        event_bus: RedisEventBus 인스턴스
    """
    try:
        from ..config.settings import settings
        from ..pipeline.proc_stage import process_article, calculate_metrics, generate_recommendation

        log.info("[AnalyzerConsumer] Starting stream consumer...")

        def handle_article(message: dict):
            """
            기사 처리 파이프라인

            Args:
                message: {'news_id': 'NEWS-xxx', 'url': '...', 'source_cd': '...', 'timestamp': '...'}
            """
            try:
                news_id = message.get('news_id')

                if not news_id:
                    log.warning(f"[AnalyzerConsumer] No news_id in message: {message}")
                    return

                log.info(f"[AnalyzerConsumer] Processing article: {news_id}")

                proc_result = process_article(news_id)
                if not proc_result:
                    log.warning(f"[AnalyzerConsumer] PROC failed for {news_id}")
                    return

                calc_result = calculate_metrics(news_id)
                if not calc_result:
                    log.warning(f"[AnalyzerConsumer] CALC failed for {news_id}")
                    return

                rcmd_result = generate_recommendation(news_id)
                if rcmd_result:
                    log.info(f"[AnalyzerConsumer] Pipeline completed for {news_id}")
                else:
                    log.warning(f"[AnalyzerConsumer] RCMD failed for {news_id}")

            except Exception as e:
                log.error(f"[AnalyzerConsumer] Error processing article: {e}", exc_info=True)

        event_bus.consume_stream(
            stream_name=settings.REDIS_STREAM_ARTICLES,
            callback=handle_article,
            consumer_group='analyzer-group',
            consumer_name='analyzer-1'
        )

    except Exception as e:
        log.error(f"[AnalyzerConsumer] Failed to start: {e}", exc_info=True)
