"""
Analyzer Consumer - Redis Stream에서 신규 기사 수신 및 분석 파이프라인 실행
"""
import logging

log = logging.getLogger(__name__)


def start_analyzer_consumer(event_bus):
    """
    Analyzer Consumer 시작

    Args:
        event_bus: RedisEventBus 인스턴스
    """
    try:
        from index_analyzer.core.config import settings
        from index_analyzer.pipeline.proc_module import process_article
        from index_analyzer.pipeline.calc_module import calculate_metrics
        from index_analyzer.pipeline.rcmd_module import generate_recommendation

        log.info("[AnalyzerConsumer] Starting stream consumer...")

        # Stream 구독 및 파이프라인 실행
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

                # PROC: 감정 분석 + 티커 추출
                proc_result = process_article(news_id)

                if not proc_result:
                    log.warning(f"[AnalyzerConsumer] PROC failed for {news_id}")
                    return

                # CALC: 시장 영향도 계산
                calc_result = calculate_metrics(news_id)

                if not calc_result:
                    log.warning(f"[AnalyzerConsumer] CALC failed for {news_id}")
                    return

                # RCMD: 추천 생성
                rcmd_result = generate_recommendation(news_id)

                if rcmd_result:
                    log.info(f"[AnalyzerConsumer] Pipeline completed for {news_id}")
                else:
                    log.warning(f"[AnalyzerConsumer] RCMD failed for {news_id}")

            except Exception as e:
                log.error(f"[AnalyzerConsumer] Error processing article: {e}", exc_info=True)

        # Stream 구독 시작
        event_bus.consume_stream(
            stream_name=settings.REDIS_STREAM_ARTICLES,
            callback=handle_article,
            consumer_group='analyzer-group',
            consumer_name='analyzer-1'
        )

    except Exception as e:
        log.error(f"[AnalyzerConsumer] Failed to start: {e}", exc_info=True)
