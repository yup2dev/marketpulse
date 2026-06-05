"""
PROC Layer: 가공 (ML/요약/티커추출 결과)

테이블 (MBS_PROC_*):
- ARTICLE : 기사 분석 결과 (감정점수·요약·매칭종목)
"""
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Date, ForeignKey, Index, DECIMAL
from sqlalchemy.orm import relationship

from .base import Base


class MBS_PROC_ARTICLE(Base):
    """가공 - 기사 분석 결과"""
    __tablename__ = 'mbs_proc_article'

    proc_id = Column(String(50), primary_key=True)
    news_id = Column(String(50), ForeignKey('mbs_in_article.news_id'), nullable=False, index=True)
    stk_cd = Column(String(20), index=True)

    summary_text = Column(Text)
    match_score = Column(DECIMAL(10, 4))
    price_impact = Column(DECIMAL(10, 4))
    sentiment_score = Column(DECIMAL(10, 4))
    price = Column(DECIMAL(20, 4))

    base_ymd = Column(Date, nullable=False, index=True)
    source_batch_id = Column(String(50), index=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    source_article = relationship("MBS_IN_ARTICLE", back_populates="processed_articles")
    calc_metrics = relationship("MBS_CALC_METRIC", back_populates="source_proc")

    __table_args__ = (
        Index('idx_proc_base_ymd', 'base_ymd'),
        Index('idx_proc_news_id', 'news_id'),
        Index('idx_proc_stk_cd', 'stk_cd', 'base_ymd'),
        Index('idx_proc_sentiment', 'sentiment_score', 'base_ymd'),
    )

    def to_dict(self) -> dict:
        return {
            'proc_id': self.proc_id,
            'news_id': self.news_id,
            'stk_cd': self.stk_cd,
            'summary_text': self.summary_text,
            'match_score': float(self.match_score) if self.match_score else None,
            'price_impact': float(self.price_impact) if self.price_impact else None,
            'sentiment_score': float(self.sentiment_score) if self.sentiment_score else None,
            'price': float(self.price) if self.price else None,
            'base_ymd': self.base_ymd.isoformat() if self.base_ymd else None
        }


__all__ = ["MBS_PROC_ARTICLE"]
