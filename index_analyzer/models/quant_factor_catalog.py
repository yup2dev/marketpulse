"""
QuantFactorCatalog Model
System-wide factor catalog (formerly STRATEGY_FACTORS constant in strategyFactors.js).
Each row = one factor definition usable by Strategy Builder and Visualize page.
Separate from QuantFactor (which is user-scoped custom formulas).
"""
from datetime import datetime
from sqlalchemy import Column, String, Integer, Text, DateTime
from index_analyzer.models.orm import Base


class QuantFactorCatalog(Base):
    """Built-in factor catalog with category, params, and backend-name mappings."""
    __tablename__ = 'quant_factor_catalog'

    id           = Column(Integer, primary_key=True, autoincrement=True)
    key          = Column(String(50), unique=True, nullable=False, index=True)
    name         = Column(String(100), nullable=False)
    name_ko      = Column(String(100))
    category     = Column(String(30), nullable=False, index=True)  # Macro/Micro/Stock/Chart/Alt/Options
    sub          = Column(String(50))
    desc         = Column(Text)
    examples     = Column(Text)
    strategic    = Column(Text)
    # JSON: [{"name":"period","label":"Period","default":20,"min":2,"max":500,"step":1}, ...]
    params       = Column(Text, nullable=False, default='[]')
    availability = Column(String(20), nullable=False, default='available')  # available|beta|external
    # JSON: [{"back":"EMA","label":"EMA"}, ...] — maps factor id to backend compute names
    backends     = Column(Text, nullable=False, default='[]')
    sort_order   = Column(Integer, nullable=False, default=0)
    use_yn       = Column(String(1), nullable=False, default='Y')

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def to_dict(self):
        import json
        try:
            params = json.loads(self.params or '[]')
        except Exception:
            params = []
        try:
            backends = json.loads(self.backends or '[]')
        except Exception:
            backends = []
        return {
            'id':           self.key,
            'name':         self.name,
            'nameKo':       self.name_ko or '',
            'category':     self.category,
            'sub':          self.sub or '',
            'desc':         self.desc or '',
            'examples':     self.examples or '',
            'strategic':    self.strategic or '',
            'params':       params,
            'availability': self.availability,
            'backends':     backends,
            'sortOrder':    self.sort_order,
        }
