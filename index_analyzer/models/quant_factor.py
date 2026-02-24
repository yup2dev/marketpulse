"""
QuantFactor Model
User-saved custom factor definitions
"""
from datetime import datetime
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, Index
from index_analyzer.models.database import Base


class QuantFactor(Base):
    """User-defined custom factor: name, category, type, params, formula, description"""
    __tablename__ = 'quant_factors'

    id          = Column(Integer, primary_key=True, autoincrement=True)
    user_id     = Column(String(50), ForeignKey('users.user_id'), nullable=False, index=True)
    name        = Column(String(200), nullable=False)
    category    = Column(String(50), nullable=False)   # Market Sensitivity | Sentiment | Statistical
    factor_type = Column(String(50), nullable=False)   # BETA | CORR | NEWS_SENTIMENT | ZSCORE …
    # JSON: { "window": 60, "vs_ticker": "SPY" }
    params      = Column(Text, default='{}')
    formula     = Column(Text)
    description = Column(Text)
    # available | external
    status      = Column(String(20), default='available')

    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index('idx_quant_factor_user', 'user_id', 'created_at'),
    )

    def to_dict(self):
        return {
            'id':          self.id,
            'user_id':     self.user_id,
            'name':        self.name,
            'category':    self.category,
            'factor_type': self.factor_type,
            'params':      self.params,
            'formula':     self.formula,
            'description': self.description,
            'status':      self.status,
            'created_at':  self.created_at.isoformat() if self.created_at else None,
        }
