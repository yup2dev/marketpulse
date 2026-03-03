"""
QuantStrategy Model
User-saved quantitative strategy research notes
"""
from datetime import datetime
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, Index
from index_analyzer.models.orm import Base


class QuantStrategy(Base):
    """User-saved strategy research card: formula, variables, conditions, notes"""
    __tablename__ = 'quant_strategies'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(50), ForeignKey('users.user_id'), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    strategy_type = Column(String(50), nullable=False, default='custom')
    # Human-readable formula (e.g., "EMA(n) = P × k + EMA₋₁ × (1 - k)")
    formula = Column(Text)
    # JSON: [{ "name": "fast", "label": "Fast EMA", "value": 20, "desc": "Short-term momentum" }]
    variables = Column(Text)
    buy_condition = Column(Text)
    sell_condition = Column(Text)
    # JSON: actual backtest params {"fast":20,"slow":50,"stop_loss_pct":5,"initial_capital":10000}
    parameters = Column(Text)
    notes = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index('idx_quant_strat_user_date', 'user_id', 'created_at'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'name': self.name,
            'strategy_type': self.strategy_type,
            'formula': self.formula,
            'variables': self.variables,
            'buy_condition': self.buy_condition,
            'sell_condition': self.sell_condition,
            'parameters': self.parameters,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
