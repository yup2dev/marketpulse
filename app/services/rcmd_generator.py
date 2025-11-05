"""
Recommendation Generator - CALC → RCMD 변환
추천 결과 생성 (NEWS / STOCK / PORTFOLIO)
"""
import logging
from typing import Dict, List, Optional, Tuple
from pathlib import Path
from datetime import datetime, date
from sqlalchemy.orm import Session
from sqlalchemy import func
from decimal import Decimal

from app.models.database import (
    get_sqlite_db,
    MBS_CALC_METRIC,
    MBS_PROC_ARTICLE,
    MBS_IN_ARTICLE,
    MBS_RCMD_RESULT,
    generate_id
)
from app.core.config import settings

log = logging.getLogger(__name__)


class RcmdGenerator:
    """
    CALC → RCMD 변환 프로세서

    추천 타입:
    - NEWS: 주목할 뉴스 추천
    - STOCK: 매수/매도 종목 추천
    - PORTFOLIO: 포트폴리오 추천
    """

    def __init__(self):
        """초기화"""
        db_path = Path(settings.SQLITE_PATH)
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self.db = get_sqlite_db(str(db_path))

        log.info(f"RcmdGenerator initialized with DB: {db_path}")

    def generate_news_recommendations(
        self,
        base_ymd: date,
        top_n: int = 10
    ) -> List[str]:
        """
        뉴스 추천 생성

        기준:
        - 감성 점수 절대값이 높은 뉴스
        - 리스크가 높은 뉴스
        - 최근 뉴스 우선

        Args:
            base_ymd: 기준 날짜
            top_n: 추천 개수

        Returns:
            생성된 rcmd_id 리스트
        """
        session: Session = self.db.get_session()
        rcmd_ids = []

        try:
            # CALC에서 고 리스크/감성 메트릭 조회
            metrics = session.query(
                MBS_CALC_METRIC
            ).filter(
                MBS_CALC_METRIC.base_ymd == base_ymd,
                MBS_CALC_METRIC.metric_type.in_(['SENTIMENT', 'RISK'])
            ).all()

            # PROC별로 점수 집계
            proc_scores = {}  # proc_id -> score

            for metric in metrics:
                proc_id = metric.source_proc_id
                if proc_id not in proc_scores:
                    proc_scores[proc_id] = 0.0

                if metric.metric_type == 'SENTIMENT':
                    # 감성 절대값 (강한 감성일수록 높은 점수)
                    proc_scores[proc_id] += abs(float(metric.metric_val)) * 50

                elif metric.metric_type == 'RISK':
                    # 리스크가 높을수록 주목할만함
                    proc_scores[proc_id] += float(metric.metric_val) * 30

            # 상위 N개 선택
            sorted_procs = sorted(
                proc_scores.items(),
                key=lambda x: x[1],
                reverse=True
            )[:top_n]

            # 추천 생성
            for proc_id, score in sorted_procs:
                # PROC 정보 조회
                proc = session.query(MBS_PROC_ARTICLE).filter_by(
                    proc_id=proc_id
                ).first()

                if not proc:
                    continue

                # 추천 생성
                rcmd_id = self._create_recommendation(
                    session,
                    rcmd_type='NEWS',
                    ref_news_id=proc.news_id,
                    ref_stk_cd=proc.stk_cd,
                    score=score,
                    reason=f"High impact news (Sentiment: {proc.sentiment_score:.2f})",
                    base_ymd=base_ymd
                )

                if rcmd_id:
                    rcmd_ids.append(rcmd_id)

            session.commit()

            log.info(
                f"[RcmdGenerator] NEWS recommendations: {len(rcmd_ids)} items "
                f"for {base_ymd}"
            )

            session.close()
            return rcmd_ids

        except Exception as e:
            session.rollback()
            log.error(f"[RcmdGenerator] News recommendation failed: {e}", exc_info=True)
            session.close()
            return []

    def generate_stock_recommendations(
        self,
        base_ymd: date,
        top_n: int = 10
    ) -> List[str]:
        """
        종목 추천 생성

        기준:
        - 긍정적 감성 + 낮은 리스크 → 매수
        - 부정적 감성 + 높은 리스크 → 매도/주의
        - 높은 변동성 → 단기 트레이딩

        Args:
            base_ymd: 기준 날짜
            top_n: 추천 개수

        Returns:
            생성된 rcmd_id 리스트
        """
        session: Session = self.db.get_session()
        rcmd_ids = []

        try:
            # 종목별 메트릭 집계
            stocks_data = self._aggregate_stock_metrics(session, base_ymd)

            # 추천 점수 계산
            stock_recommendations = []

            for stk_cd, metrics in stocks_data.items():
                sentiment = metrics.get('SENTIMENT', 0.0)
                risk = metrics.get('RISK', 0.5)
                volatility = metrics.get('VOLATILITY', 0.0)

                # 추천 점수 계산
                # 긍정 감성 + 낮은 리스크 = 높은 점수
                score = (sentiment * 50) - (risk * 30) + (volatility * 10)

                # 추천 이유
                if sentiment > 0.5 and risk < 0.5:
                    action = "BUY"
                    reason = f"Positive sentiment ({sentiment:.2f}), Low risk ({risk:.2f})"
                elif sentiment < -0.5 or risk > 0.7:
                    action = "SELL"
                    reason = f"Negative sentiment ({sentiment:.2f}), High risk ({risk:.2f})"
                else:
                    action = "HOLD"
                    reason = f"Neutral (Sentiment: {sentiment:.2f}, Risk: {risk:.2f})"

                stock_recommendations.append((stk_cd, score, action, reason))

            # 상위 N개 선택
            stock_recommendations.sort(key=lambda x: abs(x[1]), reverse=True)

            for stk_cd, score, action, reason in stock_recommendations[:top_n]:
                rcmd_id = self._create_recommendation(
                    session,
                    rcmd_type='STOCK',
                    ref_stk_cd=stk_cd,
                    score=score,
                    reason=f"{action}: {reason}",
                    base_ymd=base_ymd
                )

                if rcmd_id:
                    rcmd_ids.append(rcmd_id)

            session.commit()

            log.info(
                f"[RcmdGenerator] STOCK recommendations: {len(rcmd_ids)} items "
                f"for {base_ymd}"
            )

            session.close()
            return rcmd_ids

        except Exception as e:
            session.rollback()
            log.error(f"[RcmdGenerator] Stock recommendation failed: {e}", exc_info=True)
            session.close()
            return []

    def generate_portfolio_recommendations(
        self,
        base_ymd: date,
        portfolio_size: int = 5
    ) -> List[str]:
        """
        포트폴리오 추천 생성

        기준:
        - 리스크 분산
        - 섹터 다양성
        - 긍정적 감성 종목 조합

        Args:
            base_ymd: 기준 날짜
            portfolio_size: 포트폴리오 크기

        Returns:
            생성된 rcmd_id 리스트
        """
        session: Session = self.db.get_session()
        rcmd_ids = []

        try:
            # 종목별 메트릭 집계
            stocks_data = self._aggregate_stock_metrics(session, base_ymd)

            # 긍정적 감성 + 낮은 리스크 종목 선택
            candidates = []

            for stk_cd, metrics in stocks_data.items():
                sentiment = metrics.get('SENTIMENT', 0.0)
                risk = metrics.get('RISK', 0.5)

                # 필터링: 긍정 감성 AND 낮은 리스크
                if sentiment > 0.2 and risk < 0.6:
                    score = sentiment - risk
                    candidates.append((stk_cd, score))

            # 상위 종목 선택
            candidates.sort(key=lambda x: x[1], reverse=True)
            selected_stocks = [c[0] for c in candidates[:portfolio_size]]

            if selected_stocks:
                # 포트폴리오 추천 생성
                rcmd_id = self._create_recommendation(
                    session,
                    rcmd_type='PORTFOLIO',
                    ref_stk_cd=','.join(selected_stocks),  # 여러 종목 쉼표 구분
                    score=sum(c[1] for c in candidates[:portfolio_size]),
                    reason=f"Balanced portfolio with {len(selected_stocks)} stocks: {', '.join(selected_stocks)}",
                    base_ymd=base_ymd
                )

                if rcmd_id:
                    rcmd_ids.append(rcmd_id)

            session.commit()

            log.info(
                f"[RcmdGenerator] PORTFOLIO recommendations: {len(rcmd_ids)} items "
                f"({len(selected_stocks)} stocks) for {base_ymd}"
            )

            session.close()
            return rcmd_ids

        except Exception as e:
            session.rollback()
            log.error(f"[RcmdGenerator] Portfolio recommendation failed: {e}", exc_info=True)
            session.close()
            return []

    def _aggregate_stock_metrics(
        self,
        session: Session,
        base_ymd: date
    ) -> Dict[str, Dict[str, float]]:
        """
        종목별 메트릭 집계

        Returns:
            {stk_cd: {metric_type: avg_value}}
        """
        metrics = session.query(MBS_CALC_METRIC).filter(
            MBS_CALC_METRIC.base_ymd == base_ymd
        ).all()

        stocks_data = {}

        for metric in metrics:
            stk_cd = metric.stk_cd
            if stk_cd not in stocks_data:
                stocks_data[stk_cd] = {}

            metric_type = metric.metric_type
            metric_val = float(metric.metric_val) if metric.metric_val else 0.0

            # 평균 계산 (여러 메트릭이 있을 경우)
            if metric_type in stocks_data[stk_cd]:
                stocks_data[stk_cd][metric_type] = (
                    stocks_data[stk_cd][metric_type] + metric_val
                ) / 2
            else:
                stocks_data[stk_cd][metric_type] = metric_val

        return stocks_data

    def _create_recommendation(
        self,
        session: Session,
        rcmd_type: str,
        ref_news_id: Optional[str] = None,
        ref_stk_cd: Optional[str] = None,
        ref_calc_id: Optional[str] = None,
        score: float = 0.0,
        reason: str = "",
        base_ymd: date = None
    ) -> Optional[str]:
        """추천 생성"""
        try:
            rcmd_id = generate_id('RCMD-')

            recommendation = MBS_RCMD_RESULT(
                rcmd_id=rcmd_id,
                ref_news_id=ref_news_id,
                ref_stk_cd=ref_stk_cd,
                ref_calc_id=ref_calc_id,
                rcmd_type=rcmd_type,
                score=Decimal(str(score)),
                reason=reason,
                base_ymd=base_ymd or date.today()
            )

            session.add(recommendation)

            log.debug(
                f"[RcmdGenerator] Created {rcmd_type} recommendation: "
                f"{rcmd_id} (score: {score:.2f})"
            )

            return rcmd_id

        except Exception as e:
            log.error(f"[RcmdGenerator] Failed to create recommendation: {e}")
            return None

    def batch_generate(
        self,
        base_ymd: Optional[date] = None
    ) -> Dict[str, int]:
        """
        배치 추천 생성

        Args:
            base_ymd: 기준 날짜 (None이면 오늘)

        Returns:
            {'news': int, 'stock': int, 'portfolio': int}
        """
        if base_ymd is None:
            base_ymd = date.today()

        try:
            # 1. 뉴스 추천
            news_ids = self.generate_news_recommendations(base_ymd, top_n=10)

            # 2. 종목 추천
            stock_ids = self.generate_stock_recommendations(base_ymd, top_n=10)

            # 3. 포트폴리오 추천
            portfolio_ids = self.generate_portfolio_recommendations(base_ymd, portfolio_size=5)

            log.info(
                f"[RcmdGenerator] Batch generation completed for {base_ymd}: "
                f"NEWS={len(news_ids)}, STOCK={len(stock_ids)}, PORTFOLIO={len(portfolio_ids)}"
            )

            return {
                'news': len(news_ids),
                'stock': len(stock_ids),
                'portfolio': len(portfolio_ids)
            }

        except Exception as e:
            log.error(f"[RcmdGenerator] Batch generation failed: {e}", exc_info=True)
            return {'news': 0, 'stock': 0, 'portfolio': 0}


# =============================================================================
# 스케줄러용 함수
# =============================================================================

_rcmd_generator: Optional[RcmdGenerator] = None


def get_rcmd_generator() -> RcmdGenerator:
    """RcmdGenerator 싱글톤"""
    global _rcmd_generator
    if _rcmd_generator is None:
        _rcmd_generator = RcmdGenerator()
    return _rcmd_generator


def scheduled_rcmd_generation():
    """
    스케줄러 작업 - CALC → RCMD 배치 생성
    """
    try:
        log.info("Scheduled task: rcmd_generation started")
        generator = get_rcmd_generator()
        results = generator.batch_generate()
        log.info(f"Scheduled task: rcmd_generation completed - {results}")
        return results
    except Exception as e:
        log.error(f"Scheduled task: rcmd_generation failed - {e}", exc_info=True)
        return {'news': 0, 'stock': 0, 'portfolio': 0}
