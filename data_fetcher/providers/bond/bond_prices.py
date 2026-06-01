"""Bond Prices Standard Model"""
from datetime import date as date_type
from typing import List, Optional
from pydantic import Field

from data_fetcher.abstract_provider.abstract import BaseQueryParams, BaseData


class BondPricesQueryParams(BaseQueryParams):
    """채권 가격 조회 파라미터"""

    country: Optional[str] = Field(
        default=None,
        description="국가 (부분 이름 매칭, 예: United States, Germany)",
    )
    issuer_name: Optional[str] = Field(
        default=None,
        description="발행기관 이름 (부분 매칭, 대소문자 무관)",
    )
    isin: Optional[str | List[str]] = Field(
        default=None,
        description="국제증권식별번호(ISIN). 단일 또는 리스트",
    )
    lei: Optional[str] = Field(
        default=None,
        description="발행기관 법인식별기호(LEI)",
    )
    currency: Optional[str | List[str]] = Field(
        default=None,
        description="채권 통화. ISO 4217 3자리 코드 (예: USD, EUR, GBP)",
    )
    coupon_min: Optional[float] = Field(
        default=None,
        description="최소 쿠폰금리 (%)",
    )
    coupon_max: Optional[float] = Field(
        default=None,
        description="최대 쿠폰금리 (%)",
    )
    issued_amount_min: Optional[int] = Field(
        default=None,
        description="최소 발행금액",
    )
    issued_amount_max: Optional[int] = Field(
        default=None,
        description="최대 발행금액",
    )
    maturity_date_min: Optional[date_type] = Field(
        default=None,
        description="최소 만기일",
    )
    maturity_date_max: Optional[date_type] = Field(
        default=None,
        description="최대 만기일",
    )
    ytm_min: Optional[float] = Field(
        default=None,
        description="최소 만기수익률 (%)",
    )
    ytm_max: Optional[float] = Field(
        default=None,
        description="최대 만기수익률 (%)",
    )
    limit: Optional[int] = Field(
        default=100,
        description="최대 반환 건수",
    )


class BondPricesData(BaseData):
    """채권 가격 데이터"""

    isin: Optional[str] = Field(
        default=None,
        description="국제증권식별번호(ISIN)",
    )
    lei: Optional[str] = Field(
        default=None,
        description="발행기관 법인식별기호(LEI)",
    )
    figi: Optional[str] = Field(
        default=None,
        description="FIGI 식별자",
    )
    cusip: Optional[str] = Field(
        default=None,
        description="CUSIP 식별자",
    )
    issuer_name: Optional[str] = Field(
        default=None,
        description="발행기관 이름",
    )
    country: Optional[str] = Field(
        default=None,
        description="발행 국가",
    )
    currency: Optional[str] = Field(
        default=None,
        description="채권 통화",
    )
    coupon_rate: Optional[float] = Field(
        default=None,
        description="쿠폰금리 (%)",
    )
    price: Optional[float] = Field(
        default=None,
        description="채권 가격 (액면가 기준, 보통 100 기준)",
    )
    current_yield: Optional[float] = Field(
        default=None,
        description="현재 수익률 (%)",
    )
    ytm: Optional[float] = Field(
        default=None,
        description="만기수익률 — Yield to Maturity (%)",
    )
    ytw: Optional[float] = Field(
        default=None,
        description="최악 수익률 — Yield to Worst (%)",
    )
    duration: Optional[float] = Field(
        default=None,
        description="듀레이션 (년)",
    )
    issued_amount: Optional[float] = Field(
        default=None,
        description="발행금액",
    )
    maturity_date: Optional[date_type] = Field(
        default=None,
        description="만기일",
    )
    call_date: Optional[date_type] = Field(
        default=None,
        description="조기상환 가능일 (Nearest Call Date)",
    )
    issue_date: Optional[date_type] = Field(
        default=None,
        description="발행일",
    )
    rating: Optional[str] = Field(
        default=None,
        description="신용등급 (예: AAA, AA+, BBB)",
    )
    bond_type: Optional[str] = Field(
        default=None,
        description="채권 유형 (Corporate, Government, Municipal 등)",
    )


"""FMP Bond Prices Fetcher"""
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from data_fetcher.abstract_provider.abstract.fetcher import Fetcher
from data_fetcher.utils.api_keys import get_api_key
from data_fetcher.utils.async_http_client import amake_request, HTTPClientError

log = logging.getLogger(__name__)

# FMP Bond API
# Docs: https://site.financialmodelingprep.com/developer/docs/bond-prices-api
BASE_URL = "https://financialmodelingprep.com/stable"


class FMPBondPricesFetcher(Fetcher[BondPricesQueryParams, BondPricesData]):
    """
    FMP Bond Prices Fetcher

    FMP의 채권 데이터 API를 통해 채권 가격, YTM, 듀레이션 등을 조회합니다.
    - ISIN / CUSIP 단일 조회: /stable/bond-prices?isin=...
    - 전체 목록 조회:          /stable/bonds-list
    """

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> BondPricesQueryParams:
        return BondPricesQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: BondPricesQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        """
        FMP API에서 채권 데이터 추출

        - isin 지정 시: 개별 채권 상세 조회
        - 미지정 시: 전체 목록 조회 후 클라이언트 필터링
        """
        api_key = get_api_key(
            credentials=credentials,
            api_name="FMP",
            env_var="FMP_API_KEY",
        )

        try:
            if query.isin:
                # 단일/복수 ISIN 조회
                isins = [query.isin] if isinstance(query.isin, str) else query.isin
                raw = []
                for isin in isins:
                    data = await amake_request(
                        f"{BASE_URL}/bond-prices",
                        params={"isin": isin, "apikey": api_key},
                        timeout=30,
                    )
                    if isinstance(data, list):
                        raw.extend(data)
                    elif isinstance(data, dict) and data:
                        raw.append(data)
                return raw

            # 전체 목록 조회
            raw = await amake_request(
                f"{BASE_URL}/bonds-list",
                params={"apikey": api_key},
                timeout=30,
            )

            if not isinstance(raw, list):
                log.warning("Unexpected bonds-list response format")
                return []

            return raw

        except HTTPClientError as e:
            log.error(f"FMP Bond API request failed: {e}")
            raise

    @staticmethod
    def transform_data(
        query: BondPricesQueryParams,
        data: List[Dict[str, Any]],
        **kwargs: Any,
    ) -> List[BondPricesData]:
        """
        원시 데이터 → BondPricesData 변환 + 쿼리 파라미터 필터링

        FMP 응답 필드 매핑:
          isin, cusip, name → issuer_name, country, currency
          couponRate → coupon_rate, price, currentYield → current_yield
          ytm, ytw, duration, issuedAmount → issued_amount
          maturityDate → maturity_date, callDate → call_date
          issueDate → issue_date, rating, type → bond_type
        """
        result = []

        for item in data:
            try:
                # 날짜 파싱 헬퍼
                def _parse_date(val):
                    if not val:
                        return None
                    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%m/%d/%Y"):
                        try:
                            return datetime.strptime(str(val)[:10], fmt[:len(str(val)[:10])]).date()
                        except ValueError:
                            continue
                    return None

                coupon = _safe_float(item.get("couponRate") or item.get("coupon"))
                price = _safe_float(item.get("price") or item.get("lastPrice"))
                current_yield = _safe_float(item.get("currentYield") or item.get("yield"))
                ytm = _safe_float(item.get("ytm") or item.get("yieldToMaturity"))
                ytw = _safe_float(item.get("ytw") or item.get("yieldToWorst"))
                duration = _safe_float(item.get("duration") or item.get("modifiedDuration"))
                issued_amount = _safe_float(item.get("issuedAmount") or item.get("outstandingAmount"))

                maturity_date = _parse_date(item.get("maturityDate") or item.get("maturity"))
                call_date = _parse_date(item.get("callDate") or item.get("nextCallDate"))
                issue_date = _parse_date(item.get("issueDate"))

                country = item.get("country") or item.get("countryOfRisk") or ""
                currency = item.get("currency") or item.get("couponCurrency") or ""
                issuer_name = item.get("name") or item.get("issuerName") or item.get("companyName") or ""

                bond = BondPricesData(
                    isin=item.get("isin"),
                    lei=item.get("lei"),
                    figi=item.get("figi"),
                    cusip=item.get("cusip"),
                    issuer_name=issuer_name or None,
                    country=country or None,
                    currency=currency or None,
                    coupon_rate=coupon,
                    price=price,
                    current_yield=current_yield,
                    ytm=ytm,
                    ytw=ytw,
                    duration=duration,
                    issued_amount=issued_amount,
                    maturity_date=maturity_date,
                    call_date=call_date,
                    issue_date=issue_date,
                    rating=item.get("rating") or item.get("creditRating"),
                    bond_type=item.get("type") or item.get("bondType") or item.get("securityType"),
                )

                # ── 클라이언트 필터링 ──────────────────────────────────────
                if query.country and not _icontains(country, query.country):
                    continue
                if query.issuer_name and not _icontains(issuer_name, query.issuer_name):
                    continue
                if query.lei and bond.lei != query.lei:
                    continue
                if query.currency:
                    allowed = [query.currency] if isinstance(query.currency, str) else query.currency
                    if currency.upper() not in [c.upper() for c in allowed]:
                        continue
                if query.coupon_min is not None and (coupon is None or coupon < query.coupon_min):
                    continue
                if query.coupon_max is not None and (coupon is None or coupon > query.coupon_max):
                    continue
                if query.issued_amount_min is not None and (issued_amount is None or issued_amount < query.issued_amount_min):
                    continue
                if query.issued_amount_max is not None and (issued_amount is None or issued_amount > query.issued_amount_max):
                    continue
                if query.maturity_date_min and maturity_date and maturity_date < query.maturity_date_min:
                    continue
                if query.maturity_date_max and maturity_date and maturity_date > query.maturity_date_max:
                    continue
                if query.ytm_min is not None and (ytm is None or ytm < query.ytm_min):
                    continue
                if query.ytm_max is not None and (ytm is None or ytm > query.ytm_max):
                    continue

                result.append(bond)

                if query.limit and len(result) >= query.limit:
                    break

            except Exception as e:
                log.warning(f"Error parsing bond record: {e} — {item}")
                continue

        log.info(f"FMPBondPricesFetcher: {len(result)} bonds returned (raw={len(data)})")
        return result


# ── 유틸 ──────────────────────────────────────────────────────────────────────

def _safe_float(val) -> Optional[float]:
    try:
        return float(val) if val is not None else None
    except (TypeError, ValueError):
        return None


def _icontains(text: str, query: str) -> bool:
    return query.lower() in (text or "").lower()
