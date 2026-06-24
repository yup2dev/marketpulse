"""collectors — 중앙 수집 작업 정의 (무엇을/어디서 수집)."""
from index_analyzer.collectors.base import Collector, Target
from index_analyzer.collectors.universe.kr_listing import KRUniverseCollector
from index_analyzer.collectors.universe.us_listing import USUniverseCollector
from index_analyzer.collectors.universe.kr_etf import KRETFCollector
from index_analyzer.collectors.universe.us_etf import USETFCollector
from index_analyzer.collectors.universe.kr_bond import KRBondCollector
from index_analyzer.collectors.institutional.holdings_13f import Institutional13FCollector
