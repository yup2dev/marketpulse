"""
Provider Initialization

provider 는 각자 자기 패키지(providers/<p>/__init__.py)에 `<p>_provider = Provider(...)` 로 정의한다
(OpenBB openbb_<p>/__init__.py 와 같은 구조). 여기는 그것들을 모아 ProviderRegistry 에 등록만 한다.
이 파일을 import 하면 모든 provider 가 활성화된다.
"""
import logging

from data_fetcher.abstract_provider.abstract.provider import ProviderRegistry

from data_fetcher.providers.fred import fred_provider
from data_fetcher.providers.yahoo import yahoo_provider
from data_fetcher.providers.alphavantage import alphavantage_provider
from data_fetcher.providers.fmp import fmp_provider
from data_fetcher.providers.polygon import polygon_provider
from data_fetcher.providers.tiingo import tiingo_provider
# OpenBB 이식 provider (MACRO/STOCK) — Provider.metadata["group"] 로 분류 (providers API 가 노출)
from data_fetcher.providers.wsj import wsj_provider
from data_fetcher.providers.bls import bls_provider
from data_fetcher.providers.eia import eia_provider
from data_fetcher.providers.oecd import oecd_provider
from data_fetcher.providers.imf import imf_provider
from data_fetcher.providers.sec import sec_provider
from data_fetcher.providers.social import social_provider
# 무료 · 공개 universe / 캘린더
from data_fetcher.providers.nasdaqtrader import nasdaqtrader_provider
from data_fetcher.providers.nasdaq import nasdaq_provider
from data_fetcher.providers.krx import krx_provider
from data_fetcher.providers.kosis import kosis_provider

log = logging.getLogger(__name__)

# ── 선택적 의존성 provider — 의존성이 없는 환경(Fetcher exe 등)에서는 조용히 건너뛴다 ──────────
# database: sqlalchemy (WebServer/DB 환경에서만)
try:
    from data_fetcher.providers.database import db_provider
except ImportError:
    db_provider = None

# kis: httpx
try:
    from data_fetcher.providers.kis import kis_provider
except ImportError:
    kis_provider = None

# quantlib / quantitative: scipy · QuantLib
try:
    from data_fetcher.providers.quantlib import quantlib_provider
except ImportError:
    quantlib_provider = None

try:
    from data_fetcher.providers.quantitative import quantitative_provider
except ImportError:
    quantitative_provider = None


PROVIDERS = [
    fred_provider,
    yahoo_provider,
    alphavantage_provider,
    fmp_provider,
    polygon_provider,
    tiingo_provider,
    wsj_provider,
    bls_provider,
    eia_provider,
    oecd_provider,
    imf_provider,
    social_provider,
    db_provider,
    nasdaqtrader_provider,
    nasdaq_provider,
    krx_provider,
    kosis_provider,
    kis_provider,
    sec_provider,
    quantlib_provider,
    quantitative_provider,
]


def register_all_providers():
    """모든 Provider 등록"""
    for provider in PROVIDERS:
        if provider is not None:
            ProviderRegistry.register(provider)

    # 선언형 provider (providers/declarative/specs/*.json — 코드 없이 JSON 스펙만으로 추가)
    from data_fetcher.providers.declarative import register_declarative_providers
    register_declarative_providers()

    log.info(f"Registered {len(ProviderRegistry.list())} providers")


# Auto-register on import
register_all_providers()
# FetcherRegistry는 ProviderRegistry에 위임하므로 별도 등록 불필요

log.info("Data Fetcher initialization complete")
