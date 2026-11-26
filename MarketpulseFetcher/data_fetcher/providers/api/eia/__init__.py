"""OpenBB 이식 패키지."""
from data_fetcher.abstract_provider.abstract.provider import Provider
from data_fetcher.providers.api.eia.models.petroleum_status_report import EiaPetroleumStatusReportFetcher
from data_fetcher.providers.api.eia.models.short_term_energy_outlook import EiaShortTermEnergyOutlookFetcher


eia_provider = Provider(
    name="eia",
    description="U.S. Energy Information Administration — 에너지 통계",
    website="https://www.eia.gov",
    credentials=["api_key"],
    fetcher_dict={
        "petroleum_status_report": EiaPetroleumStatusReportFetcher,
        "short_term_energy_outlook": EiaShortTermEnergyOutlookFetcher,
    },
    metadata={"group": "macro", "data_coverage": "US energy data (petroleum, STEO)"},
)
