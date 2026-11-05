"""
RCMD Layer: 추천 (평가/추천 결과)

테이블 (MBS_RCMD_*):
- RESULT : 추천 결과 (NEWS/STOCK/PORTFOLIO)
"""
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Date, ForeignKey, Index, DECIMAL
from sqlalchemy.orm import relationship

from .base import Base


class MBS_RCMD_RESULT(Base):
    """추천 - 추천 결과"""
    __tablename__ = 'mbs_rcmd_result'

    rcmd_id = Column(String(50), primary_key=True)

    ref_news_id = Column(String(50), ForeignKey('mbs_in_article.news_id'), index=True)
    ref_stk_cd = Column(String(20), index=True)
    ref_calc_id = Column(String(50), ForeignKey('mbs_calc_metric.calc_id'), index=True)

    rcmd_type = Column(String(20), nullable=False, index=True)
    score = Column(DECIMAL(10, 4))
    reason = Column(Text)

    base_ymd = Column(Date, nullable=False, index=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    source_calc = relationship("MBS_CALC_METRIC", back_populates="recommendations", foreign_keys=[ref_calc_id])

    __table_args__ = (
        Index('idx_rcmd_base_ymd', 'base_ymd'),
        Index('idx_rcmd_type', 'rcmd_type', 'base_ymd'),
        Index('idx_rcmd_stk_cd', 'ref_stk_cd', 'base_ymd'),
        Index('idx_rcmd_score', 'score', 'base_ymd'),
    )

    def to_dict(self) -> dict:
        return {
            'rcmd_id': self.rcmd_id,
            'ref_news_id': self.ref_news_id,
            'ref_stk_cd': self.ref_stk_cd,
            'rcmd_type': self.rcmd_type,
            'score': float(self.score) if self.score else None,
            'reason': self.reason,
            'base_ymd': self.base_ymd.isoformat() if self.base_ymd else None
        }


__all__ = ["MBS_RCMD_RESULT"]
