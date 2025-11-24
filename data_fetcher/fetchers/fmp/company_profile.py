"""FMP Company Profile Fetcher"""
import logging
import requests
from datetime import datetime
from typing import Any, Dict, List, Optional

from data_fetcher.fetchers.base import Fetcher
from data_fetcher.models.fmp.company_profile import CompanyProfileQueryParams, CompanyProfileData
from data_fetcher.utils.api_keys import get_api_key

log = logging.getLogger(__name__)


class FMPCompanyProfileFetcher(Fetcher[CompanyProfileQueryParams, CompanyProfileData]):
    """FMP 회사 프로필 Fetcher"""

    BASE_URL = "https://financialmodelingprep.com/stable"

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> CompanyProfileQueryParams:
        """쿼리 파라미터 변환"""
        return CompanyProfileQueryParams(**params)

    @staticmethod
    def extract_data(
        query: CompanyProfileQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> List[Dict[str, Any]]:
        """
        FMP에서 회사 프로필 데이터 추출

        Args:
            query: 쿼리 파라미터
            credentials: API 키 딕셔너리
            **kwargs: 추가 파라미터

        Returns:
            원시 데이터 리스트
        """
        try:
            # API 키 조회
            api_key = get_api_key(
                credentials=credentials,
                api_name="FMP",
                env_var="FMP_API_KEY"
            )

            # API 엔드포인트 (최신 stable 엔드포인트)
            url = f"{FMPCompanyProfileFetcher.BASE_URL}/profile"

            # 파라미터 설정
            params = {
                "symbol": query.symbol,
                "apikey": api_key
            }

            # API 호출
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()

            data = response.json()

            if not isinstance(data, list):
                log.warning(f"Unexpected response format for {query.symbol}")
                return []

            return data

        except requests.exceptions.RequestException as e:
            log.error(f"Error fetching company profile from FMP for {query.symbol}: {e}")
            raise
        except Exception as e:
            log.error(f"Unexpected error: {e}")
            raise

    @staticmethod
    def transform_data(
        query: CompanyProfileQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any
    ) -> List[CompanyProfileData]:
        """
        원시 데이터를 표준 모델로 변환

        Args:
            query: 쿼리 파라미터
            data: 원시 데이터
            **kwargs: 추가 파라미터

        Returns:
            CompanyProfileData 리스트
        """
        if not data:
            log.info(f"No company profile data for {query.symbol}")
            return []

        profile_list = []

        for item in data:
            try:
                # Parse IPO date
                ipo_date = None
                if item.get("ipoDate"):
                    try:
                        ipo_date = datetime.strptime(item["ipoDate"], "%Y-%m-%d").date()
                    except (ValueError, AttributeError):
                        pass

                profile_data = CompanyProfileData(
                    symbol=item.get("symbol", query.symbol),
                    company_name=item.get("companyName"),
                    price=item.get("price"),
                    beta=item.get("beta"),
                    volume_avg=item.get("volAvg"),
                    market_cap=item.get("mktCap"),
                    last_div=item.get("lastDiv"),
                    range=item.get("range"),
                    changes=item.get("changes"),
                    currency=item.get("currency"),
                    cik=item.get("cik"),
                    isin=item.get("isin"),
                    cusip=item.get("cusip"),
                    exchange=item.get("exchange"),
                    exchange_short_name=item.get("exchangeShortName"),
                    industry=item.get("industry"),
                    sector=item.get("sector"),
                    country=item.get("country"),
                    website=item.get("website"),
                    description=item.get("description"),
                    ceo=item.get("ceo"),
                    full_time_employees=item.get("fullTimeEmployees"),
                    phone=item.get("phone"),
                    address=item.get("address"),
                    city=item.get("city"),
                    state=item.get("state"),
                    zip=item.get("zip"),
                    dcf_diff=item.get("dcfDiff"),
                    dcf=item.get("dcf"),
                    image=item.get("image"),
                    ipo_date=ipo_date,
                    is_etf=item.get("isEtf"),
                    is_actively_trading=item.get("isActivelyTrading"),
                    is_adr=item.get("isAdr"),
                    is_fund=item.get("isFund"),
                )

                profile_list.append(profile_data)

            except (KeyError, ValueError) as e:
                log.warning(f"Error parsing company profile data: {e}")
                continue

        log.info(f"Fetched {len(profile_list)} company profile records for {query.symbol}")
        return profile_list