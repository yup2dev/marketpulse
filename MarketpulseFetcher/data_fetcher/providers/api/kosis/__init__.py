"""KOSIS Provider — 통계청 국가통계포털 OpenAPI"""
from data_fetcher.abstract_provider.abstract.provider import Provider
from data_fetcher.providers.api.kosis.models.series import KOSISSeriesFetcher
from data_fetcher.providers.api.kosis.models.mining_manufacturing_index import KOSISMiningManufacturingIndexFetcher
from data_fetcher.providers.api.kosis.models.capacity_utilization import KOSISCapacityUtilizationFetcher
from data_fetcher.providers.api.kosis.models.ict_exports import KOSISIctExportsFetcher
from data_fetcher.providers.api.kosis.models.product_trade import KOSISProductTradeFetcher


kosis_provider = Provider(
    name="kosis",
    description="통계청 KOSIS — 국내 산업·경제 통계표 시계열 (광공업 생산·수출입·자동차 등)",
    website="https://kosis.kr/openapi",
    credentials=["api_key"],
    fetcher_dict={
        "series": KOSISSeriesFetcher,
        "mining_manufacturing_index": KOSISMiningManufacturingIndexFetcher,
        "capacity_utilization": KOSISCapacityUtilizationFetcher,
        "ict_exports": KOSISIctExportsFetcher,
        "product_trade": KOSISProductTradeFetcher,
    },
    metadata={
        "group": "macro",
        "rate_limit": "분당 200건 (오류코드 40)",
        "data_coverage": "KR industry/economic statistics tables",
    },
)
