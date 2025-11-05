"""
CALC Module - PROC → CALC 변환 (독립 모듈)
메트릭 계산 (RISK, VOLATILITY, SENTIMENT, PRICE_IMPACT)

역할:
- MBS_PROC_ARTICLE 읽기
- 정량적 메트릭 계산
- MBS_CALC_METRIC 저장

파이프라인: IN → PROC → CALC (Processor) → RCMD
"""
import logging
from typing import Dict, List, Optional
from pathlib import Path
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from decimal import Decimal

from app.models.database import (
    get_sqlite_db,
    MBS_PROC_ARTICLE,
    MBS_CALC_METRIC,
    MBS_IN_STK_STBD,
    generate_id
)
from app.core.config import settings

log = logging.getLogger(__name__)


class CalcProcessor:
    """
    CALC 모듈: PROC → CALC 변환 (독립적으로 동작)

    메트릭 계산:
    - SENTIMENT: 감성 점수 복사 (-1 ~ 1)
    - PRICE_IMPACT: 가격 영향도 예측
    - RISK: 리스크 지표 (sentiment + impact 기반)
    - VOLATILITY: 변동성 지표 (과거 5일 가격 변동)
    """

    def __init__(self):
        """초기화"""
        db_path = Path(settings.SQLITE_PATH)
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self.db = get_sqlite_db(str(db_path))

        log.info(f"CalcProcessor initialized with DB: {db_path}")

    def process_proc_to_calc(
        self,
        proc_id: str
    ) -> List[str]:
        """
        PROC → CALC 변환

        Args:
            proc_id: MBS_PROC_ARTICLE의 proc_id

        Returns:
            생성된 calc_id 리스트
        """
        session: Session = self.db.get_session()
        calc_ids = []

        try:
            # PROC 데이터 조회
            proc_article = session.query(MBS_PROC_ARTICLE).filter_by(
                proc_id=proc_id
            ).first()

            if not proc_article:
                log.warning(f"[CalcProcessor] PROC not found: {proc_id}")
                session.close()
                return []

            stk_cd = proc_article.stk_cd
            if not stk_cd:
                log.warning(f"[CalcProcessor] No stock code in PROC: {proc_id}")
                session.close()
                return []

            # 1. SENTIMENT 메트릭
            if proc_article.sentiment_score is not None:
                calc_id = self._save_metric(
                    session,
                    stk_cd=stk_cd,
                    base_ymd=proc_article.base_ymd,
                    metric_type='SENTIMENT',
                    metric_val=float(proc_article.sentiment_score),
                    source_proc_id=proc_id
                )
                if calc_id:
                    calc_ids.append(calc_id)

            # 2. PRICE_IMPACT 메트릭
            if proc_article.price_impact is not None:
                calc_id = self._save_metric(
                    session,
                    stk_cd=stk_cd,
                    base_ymd=proc_article.base_ymd,
                    metric_type='PRICE_IMPACT',
                    metric_val=float(proc_article.price_impact),
                    source_proc_id=proc_id
                )
                if calc_id:
                    calc_ids.append(calc_id)

            # 3. RISK 메트릭 계산
            risk_val = self._calculate_risk(session, stk_cd, proc_article)
            if risk_val is not None:
                calc_id = self._save_metric(
                    session,
                    stk_cd=stk_cd,
                    base_ymd=proc_article.base_ymd,
                    metric_type='RISK',
                    metric_val=risk_val,
                    source_proc_id=proc_id
                )
                if calc_id:
                    calc_ids.append(calc_id)

            # 4. VOLATILITY 메트릭 계산
            volatility = self._calculate_volatility(session, stk_cd, proc_article.base_ymd)
            if volatility is not None:
                calc_id = self._save_metric(
                    session,
                    stk_cd=stk_cd,
                    base_ymd=proc_article.base_ymd,
                    metric_type='VOLATILITY',
                    metric_val=volatility,
                    source_proc_id=proc_id
                )
                if calc_id:
                    calc_ids.append(calc_id)

            session.commit()

            log.info(
                f"[CalcProcessor] PROC → CALC: {proc_id} → {len(calc_ids)} metrics "
                f"(Stock: {stk_cd})"
            )

            session.close()
            return calc_ids

        except Exception as e:
            session.rollback()
            log.error(f"[CalcProcessor] Error processing {proc_id}: {e}", exc_info=True)
            session.close()
            return []

    def _save_metric(
        self,
        session: Session,
        stk_cd: str,
        base_ymd,
        metric_type: str,
        metric_val: float,
        source_proc_id: str
    ) -> Optional[str]:
        """메트릭 저장"""
        try:
            calc_id = generate_id('CALC-')

            metric = MBS_CALC_METRIC(
                calc_id=calc_id,
                stk_cd=stk_cd,
                base_ymd=base_ymd,
                metric_type=metric_type,
                metric_val=Decimal(str(metric_val)),
                source_proc_id=source_proc_id
            )

            session.add(metric)
            log.debug(f"[CalcProcessor] Created metric: {metric_type} = {metric_val:.4f}")

            return calc_id

        except Exception as e:
            log.error(f"[CalcProcessor] Failed to save metric: {e}")
            return None

    def _calculate_risk(
        self,
        session: Session,
        stk_cd: str,
        proc_article: MBS_PROC_ARTICLE
    ) -> Optional[float]:
        """
        리스크 계산

        간단한 휴리스틱:
        - 감성 점수의 절대값이 클수록 리스크 높음
        - 가격 영향도가 클수록 리스크 높음

        Returns:
            리스크 점수 (0-1)
        """
        try:
            risk = 0.5  # 기본 리스크

            # 감성 점수 기반
            if proc_article.sentiment_score is not None:
                sentiment_abs = abs(float(proc_article.sentiment_score))
                risk += sentiment_abs * 0.3  # 최대 +0.3

            # 가격 영향도 기반
            if proc_article.price_impact is not None:
                impact_abs = abs(float(proc_article.price_impact))
                risk += impact_abs * 0.2  # 최대 +0.2

            return min(risk, 1.0)

        except Exception as e:
            log.error(f"[CalcProcessor] Risk calculation failed: {e}")
            return None

    def _calculate_volatility(
        self,
        session: Session,
        stk_cd: str,
        base_ymd
    ) -> Optional[float]:
        """
        변동성 계산 (과거 5일 가격 변동 기반)

        Returns:
            변동성 (표준편차)
        """
        try:
            # 과거 5일 가격 데이터 조회
            end_date = base_ymd
            start_date = base_ymd - timedelta(days=5)

            prices = session.query(MBS_IN_STK_STBD).filter(
                MBS_IN_STK_STBD.stk_cd == stk_cd,
                MBS_IN_STK_STBD.base_ymd >= start_date,
                MBS_IN_STK_STBD.base_ymd <= end_date
            ).order_by(MBS_IN_STK_STBD.base_ymd).all()

            if len(prices) < 2:
                return None

            # 변동률 계산
            change_rates = [
                float(p.change_rate) for p in prices
                if p.change_rate is not None
            ]

            if not change_rates:
                return None

            # 표준편차 (간단한 변동성 지표)
            import statistics
            volatility = statistics.stdev(change_rates)

            return volatility

        except Exception as e:
            log.error(f"[CalcProcessor] Volatility calculation failed: {e}")
            return None

    def batch_process(
        self,
        base_ymd=None,
        limit: int = 100
    ) -> Dict[str, int]:
        """
        배치 처리 - 미처리 PROC 데이터 일괄 변환

        Args:
            base_ymd: 처리할 날짜 (None이면 전체)
            limit: 최대 처리 개수

        Returns:
            {'processed': int, 'metrics_created': int}
        """
        session: Session = self.db.get_session()

        try:
            # 미처리 PROC 조회
            query = session.query(MBS_PROC_ARTICLE).filter(
                ~MBS_PROC_ARTICLE.calc_metrics.any()  # CALC이 없는 것
            )

            if base_ymd:
                query = query.filter(MBS_PROC_ARTICLE.base_ymd == base_ymd)

            proc_articles = query.limit(limit).all()

            processed_count = 0
            metrics_count = 0

            for proc in proc_articles:
                calc_ids = self.process_proc_to_calc(proc.proc_id)
                if calc_ids:
                    processed_count += 1
                    metrics_count += len(calc_ids)

            session.close()

            log.info(
                f"[CalcProcessor] Batch process completed: "
                f"{processed_count} PROC → {metrics_count} CALC"
            )

            return {
                'processed': processed_count,
                'metrics_created': metrics_count
            }

        except Exception as e:
            log.error(f"[CalcProcessor] Batch process failed: {e}", exc_info=True)
            session.close()
            return {'processed': 0, 'metrics_created': 0}


# =============================================================================
# 스케줄러용 함수
# =============================================================================

_calc_processor: Optional[CalcProcessor] = None


def get_calc_processor() -> CalcProcessor:
    """CalcProcessor 싱글톤"""
    global _calc_processor
    if _calc_processor is None:
        _calc_processor = CalcProcessor()
    return _calc_processor


def scheduled_calc_processing():
    """
    스케줄러 작업 - PROC → CALC 배치 처리
    """
    try:
        log.info("Scheduled task: calc_processing started")
        processor = get_calc_processor()
        results = processor.batch_process(limit=100)
        log.info(f"Scheduled task: calc_processing completed - {results}")
        return results
    except Exception as e:
        log.error(f"Scheduled task: calc_processing failed - {e}", exc_info=True)
        return {'processed': 0, 'metrics_created': 0}
