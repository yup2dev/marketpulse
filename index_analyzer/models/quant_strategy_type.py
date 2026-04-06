"""
QuantStrategyType Model
Stores strategy type definitions (formerly STRATEGY_META constant in quant_service.py).
Each row = one strategy engine (ema_cross, rsi, macd_cross, etc.)
"""
from datetime import datetime
from sqlalchemy import Column, String, Integer, Text, Boolean, DateTime
from index_analyzer.models.orm import Base


class QuantStrategyType(Base):
    """Built-in strategy type definition with scannable parameter metadata."""
    __tablename__ = 'quant_strategy_types'

    id        = Column(Integer, primary_key=True, autoincrement=True)
    key       = Column(String(50), unique=True, nullable=False, index=True)
    label     = Column(String(100), nullable=False)
    group_    = Column('group_name', String(50), nullable=False, default='Technical')
    desc      = Column(Text)
    slow_scan = Column(Boolean, nullable=False, default=False)
    # JSON: [{"key":"fast","label":"Fast EMA","min":5,"max":30,"step":5,"default":20}, ...]
    params    = Column(Text, nullable=False, default='[]')
    use_yn    = Column(String(1), nullable=False, default='Y')

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def to_dict(self):
        import json
        try:
            params = json.loads(self.params or '[]')
        except Exception:
            params = []
        return {
            'key':       self.key,
            'label':     self.label,
            'group':     self.group_,
            'desc':      self.desc or '',
            'slowScan':  self.slow_scan,
            'params':    params,
        }
