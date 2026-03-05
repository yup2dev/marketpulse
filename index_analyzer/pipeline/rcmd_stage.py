"""
RCMD Stage - CALC → RCMD 변환 (독립 모듈)
추천 결과 생성 (NEWS / STOCK / PORTFOLIO)
"""
import logging
from typing import Dict, List, Optional
from pathlib import Path
from datetime import datetime, date
from sqlalchemy.orm import Session
from decimal import Decimal

from ..utils.db import get_sqlite_db, generate_id
from ..config.settings import settings
from ..models.orm import (
    MBS_CALC_METRIC,
    MBS_PROC_ARTICLE,
    MBS_IN_ARTICLE,
    MBS_RCMD_RESULT,
)

log = logging.getLogger(__name__)


class RcmdGenerator:
    """
    RCMD 모듈: CALC → RCMD 변환 (독립적으로 동작)

    추천 타입:
    - NEWS: 주목할 뉴스 추천 (sentiment + risk 기반)
    - STOCK: 매수/매도/보유 종목 추천
    - PORTFOLIO: 포트폴리오 추천 (다중 종목 조합)
    """

    def __init__(self):
        db_path = Path(settings.SQLITE_PATH)
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self.db = get_sqlite_db(str(db_path))
        log.info(f"RcmdGenerator initialized with DB: {db_path}")

    def generate_news_recommendations(self, base_ymd: date, top_n: int = 10) -> List[str]:
        """뉴스 추천 생성"""
        session: Session = self.db.get_session()
        rcmd_ids = []

        try:
            metrics = session.query(MBS_CALC_METRIC).filter(
                MBS_CALC_METRIC.base_ymd == base_ymd,
                MBS_CALC_METRIC.metric_type.in_(['SENTIMENT', 'RISK'])
            ).all()

            proc_scores = {}
            for metric in metrics:
                proc_id = metric.source_proc_id
                if proc_id not in proc_scores:
                    proc_scores[proc_id] = 0.0

                if metric.metric_type == 'SENTIMENT':
                    proc_scores[proc_id] += abs(float(metric.metric_val)) * 50
                elif metric.metric_type == 'RISK':
                    proc_scores[proc_id] += float(metric.metric_val) * 30

            sorted_procs = sorted(proc_scores.items(), key=lambda x: x[1], reverse=True)[:top_n]

            for proc_id, score in sorted_procs:
                proc = session.query(MBS_PROC_ARTICLE).filter_by(proc_id=proc_id).first()
                if not proc:
                    continue

                rcmd_id = self._create_recommendation(
                    session, rcmd_type='NEWS',
                    ref_news_id=proc.news_id, ref_stk_cd=proc.stk_cd,
                    score=score,
                    reason=f"High impact news (Sentiment: {proc.sentiment_score:.2f})",
                    base_ymd=base_ymd
                )
                if rcmd_id:
                    rcmd_ids.append(rcmd_id)

            session.commit()
            log.info(f"[RcmdGenerator] NEWS recommendations: {len(rcmd_ids)} items for {base_ymd}")
            session.close()
            return rcmd_ids

        except Exception as e:
            session.rollback()
            log.error(f"[RcmdGenerator] News recommendation failed: {e}", exc_info=True)
            session.close()
            return []

    def generate_stock_recommendations(self, base_ymd: date, top_n: int = 10) -> List[str]:
        """종목 추천 생성"""
        session: Session = self.db.get_session()
        rcmd_ids = []

        try:
            stocks_data = self._aggregate_stock_metrics(session, base_ymd)
            stock_recommendations = []

            for stk_cd, metrics in stocks_data.items():
                sentiment = metrics.get('SENTIMENT', 0.0)
                risk = metrics.get('RISK', 0.5)
                volatility = metrics.get('VOLATILITY', 0.0)

                score = (sentiment * 50) - (risk * 30) + (volatility * 10)

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

            stock_recommendations.sort(key=lambda x: abs(x[1]), reverse=True)

            for stk_cd, score, action, reason in stock_recommendations[:top_n]:
                rcmd_id = self._create_recommendation(
                    session, rcmd_type='STOCK', ref_stk_cd=stk_cd,
                    score=score, reason=f"{action}: {reason}", base_ymd=base_ymd
                )
                if rcmd_id:
                    rcmd_ids.append(rcmd_id)

            session.commit()
            log.info(f"[RcmdGenerator] STOCK recommendations: {len(rcmd_ids)} items for {base_ymd}")
            session.close()
            return rcmd_ids

        except Exception as e:
            session.rollback()
            log.error(f"[RcmdGenerator] Stock recommendation failed: {e}", exc_info=True)
            session.close()
            return []

    def generate_portfolio_recommendations(self, base_ymd: date, portfolio_size: int = 5) -> List[str]:
        """포트폴리오 추천 생성"""
        session: Session = self.db.get_session()
        rcmd_ids = []

        try:
            stocks_data = self._aggregate_stock_metrics(session, base_ymd)
            candidates = []

            for stk_cd, metrics in stocks_data.items():
                sentiment = metrics.get('SENTIMENT', 0.0)
                risk = metrics.get('RISK', 0.5)
                if sentiment > 0.2 and risk < 0.6:
                    candidates.append((stk_cd, sentiment - risk))

            candidates.sort(key=lambda x: x[1], reverse=True)
            selected_stocks = [c[0] for c in candidates[:portfolio_size]]

            if selected_stocks:
                rcmd_id = self._create_recommendation(
                    session, rcmd_type='PORTFOLIO',
                    ref_stk_cd=','.join(selected_stocks),
                    score=sum(c[1] for c in candidates[:portfolio_size]),
                    reason=f"Balanced portfolio with {len(selected_stocks)} stocks: {', '.join(selected_stocks)}",
                    base_ymd=base_ymd
                )
                if rcmd_id:
                    rcmd_ids.append(rcmd_id)

            session.commit()
            log.info(f"[RcmdGenerator] PORTFOLIO recommendations: {len(rcmd_ids)} items ({len(selected_stocks)} stocks) for {base_ymd}")
            session.close()
            return rcmd_ids

        except Exception as e:
            session.rollback()
            log.error(f"[RcmdGenerator] Portfolio recommendation failed: {e}", exc_info=True)
            session.close()
            return []

    def _aggregate_stock_metrics(self, session: Session, base_ymd: date) -> Dict[str, Dict[str, float]]:
        """종목별 메트릭 집계"""
        metrics = session.query(MBS_CALC_METRIC).filter(MBS_CALC_METRIC.base_ymd == base_ymd).all()
        stocks_data = {}

        for metric in metrics:
            stk_cd = metric.stk_cd
            if stk_cd not in stocks_data:
                stocks_data[stk_cd] = {}

            metric_type = metric.metric_type
            metric_val = float(metric.metric_val) if metric.metric_val else 0.0

            if metric_type in stocks_data[stk_cd]:
                stocks_data[stk_cd][metric_type] = (stocks_data[stk_cd][metric_type] + metric_val) / 2
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
            log.debug(f"[RcmdGenerator] Created {rcmd_type} recommendation: {rcmd_id} (score: {score:.2f})")
            return rcmd_id
        except Exception as e:
            log.error(f"[RcmdGenerator] Failed to create recommendation: {e}")
            return None

    def batch_generate(self, base_ymd: Optional[date] = None) -> Dict[str, int]:
        """배치 추천 생성"""
        if base_ymd is None:
            base_ymd = date.today()

        try:
            news_ids = self.generate_news_recommendations(base_ymd, top_n=10)
            stock_ids = self.generate_stock_recommendations(base_ymd, top_n=10)
            portfolio_ids = self.generate_portfolio_recommendations(base_ymd, portfolio_size=5)

            log.info(
                f"[RcmdGenerator] Batch generation completed for {base_ymd}: "
                f"NEWS={len(news_ids)}, STOCK={len(stock_ids)}, PORTFOLIO={len(portfolio_ids)}"
            )
            return {'news': len(news_ids), 'stock': len(stock_ids), 'portfolio': len(portfolio_ids)}

        except Exception as e:
            log.error(f"[RcmdGenerator] Batch generation failed: {e}", exc_info=True)
            return {'news': 0, 'stock': 0, 'portfolio': 0}


# ── 스케줄러용 싱글톤 ─────────────────────────────────────────────────────────

_rcmd_generator: Optional[RcmdGenerator] = None


def get_rcmd_generator() -> RcmdGenerator:
    """RcmdGenerator 싱글톤"""
    global _rcmd_generator
    if _rcmd_generator is None:
        _rcmd_generator = RcmdGenerator()
    return _rcmd_generator


def scheduled_rcmd_generation():
    """스케줄러 작업 - CALC → RCMD 배치 생성"""
    try:
        log.info("Scheduled task: rcmd_generation started")
        generator = get_rcmd_generator()
        results = generator.batch_generate()
        log.info(f"Scheduled task: rcmd_generation completed - {results}")
        return results
    except Exception as e:
        log.error(f"Scheduled task: rcmd_generation failed - {e}", exc_info=True)
        return {'news': 0, 'stock': 0, 'portfolio': 0}
