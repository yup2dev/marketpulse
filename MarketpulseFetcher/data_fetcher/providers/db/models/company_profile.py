"""DB Company Profile Fetcher — 배치가 적재한 종목 프로필(MBS_IN_STK_PROFILE). symbol 은 쉼표로 여러 개."""
from typing import Any, Dict, List, Optional

from pydantic import Field

from data_fetcher.abstract_provider.abstract.base_fetchers import DbFetcher
from data_fetcher.abstract_provider.standard_models.company_profile import (
    CompanyProfileData,
    CompanyProfileQueryParams,
)
from data_fetcher.providers.db.schema import MBS_IN_STK_PROFILE


class DBCompanyProfileData(CompanyProfileData):
    in_sp500: Optional[bool] = Field(default=None, description="S&P 500 편입")
    in_nasdaq100: Optional[bool] = Field(default=None, description="나스닥 100 편입")
    in_dow30: Optional[bool] = Field(default=None, description="다우 30 편입")


def _float(v) -> Optional[float]:
    return None if v is None else float(v)


def profile_row(r: MBS_IN_STK_PROFILE) -> Dict[str, Any]:
    return {
        "symbol": r.stk_cd, "company_name": r.stk_nm, "sector": r.sector, "industry": r.industry,
        "description": r.description, "website": r.website, "ceo": r.ceo,
        "full_time_employees": r.employees, "country": r.country, "exchange": r.exchange,
        "currency": r.currency, "ipo_date": r.ipo_date, "image": r.image_url,
        "market_cap": _float(r.market_cap), "price": _float(r.price), "beta": _float(r.beta),
        "in_sp500": r.in_sp500, "in_nasdaq100": r.in_nasdaq100, "in_dow30": r.in_dow30,
    }


class DBCompanyProfileFetcher(DbFetcher[CompanyProfileQueryParams, List[DBCompanyProfileData]]):

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> CompanyProfileQueryParams:
        return CompanyProfileQueryParams(**params)

    @classmethod
    def extract_data(cls, query: CompanyProfileQueryParams,
                     credentials: Optional[Dict[str, str]] = None, **kwargs: Any) -> List[Dict[str, Any]]:
        codes = [c.strip() for c in query.symbol.split(",") if c.strip()]
        if not codes:
            return []
        with cls.db_session(**kwargs) as session:
            rows = session.query(MBS_IN_STK_PROFILE).filter(MBS_IN_STK_PROFILE.stk_cd.in_(codes)).all()
            return [profile_row(r) for r in rows]

    @staticmethod
    def transform_data(query: CompanyProfileQueryParams, data: List[Dict[str, Any]],
                       **kwargs: Any) -> List[DBCompanyProfileData]:
        return [DBCompanyProfileData.model_validate(r) for r in data or []]
