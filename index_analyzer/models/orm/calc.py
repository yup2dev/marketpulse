"""
CALC Layer: 계산 (종목별 메트릭)

테이블 (MBS_CALC_*):
- METRIC : 메트릭 계산 결과 (SENTIMENT/RISK/VOLATILITY 등)
"""
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Date, ForeignKey, Index, DECIMAL
from sqlalchemy.orm import relationship

from .base import Base


class MBS_CALC_METRIC(Base):
    """계산 - 메트릭 계산 결과"""
    __tablename__ = 'mbs_calc_metric'

    calc_id = Column(String(50), primary_key=True)
    stk_cd = Column(String(20), nullable=False, index=True)
    base_ymd = Column(Date, nullable=False, index=True)

    metric_type = Column(String(20), nullable=False, index=True)
    metric_val = Column(DECIMAL(20, 8))

    source_proc_id = Column(String(50), ForeignKey('mbs_proc_article.proc_id'), index=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    source_proc = relationship("MBS_PROC_ARTICLE", back_populates="calc_metrics")
    recommendations = relationship("MBS_RCMD_RESULT", back_populates="source_calc")

    __table_args__ = (
        Index('idx_calc_base_ymd', 'base_ymd'),
        Index('idx_calc_stk_cd', 'stk_cd', 'base_ymd'),
        Index('idx_calc_metric_type', 'metric_type', 'base_ymd'),
        Index('idx_calc_source_proc', 'source_proc_id'),
    )

    def to_dict(self) -> dict:
        return {
            'calc_id': self.calc_id,
            'stk_cd': self.stk_cd,
            'base_ymd': self.base_ymd.isoformat() if self.base_ymd else None,
            'metric_type': self.metric_type,
            'metric_val': float(self.metric_val) if self.metric_val else None,
            'source_proc_id': self.source_proc_id
        }


__all__ = ["MBS_CALC_METRIC"]
