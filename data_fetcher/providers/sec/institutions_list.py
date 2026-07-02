"""
SEC Institutions List Fetcher
Dynamically fetches list of institutions that file 13F reports
"""
import logging
import re
import requests
from typing import Any, Dict, List, Optional
from datetime import date, datetime, timedelta

from data_fetcher.abstract_provider.abstract.fetcher import Fetcher
from data_fetcher.abstract_provider.standard_models.institutions_list import (
    InstitutionsListQueryParams,
    InstitutionInfo,
)
from pydantic import Field
from typing import Optional as _Optional

log = logging.getLogger(__name__)

# form.idx 한 줄: "<FormType> <CompanyName> <CIK> <YYYY-MM-DD> <path>" (고정폭이지만
# 회사명에 숫자가 들어갈 수 있어, 날짜를 앵커로 CIK를 비탐욕 매칭한다).
_FORM_IDX_RE = re.compile(r"^(13F-HR(?:/A)?)\s+(.+?)\s+(\d+)\s+(\d{4}-\d{2}-\d{2})\s+")


class SECInstitutionsListQueryParams(InstitutionsListQueryParams):
    """Query parameters for institutions list (standard 경유)"""
    min_aum: _Optional[float] = Field(
        default=None, description="Minimum AUM in billions (optional filter)"
    )


class SECInstitutionsListFetcher(Fetcher[SECInstitutionsListQueryParams, InstitutionInfo]):
    """Fetcher for getting list of institutions that file 13F reports"""

    require_credentials = False

    # Cache for institutions list (refreshed periodically)
    _cache = None
    _cache_time = None
    _cache_duration = timedelta(hours=24)  # Cache for 24 hours

    @staticmethod
    def transform_query(params: Dict[str, Any]) -> SECInstitutionsListQueryParams:
        """Transform query parameters"""
        return SECInstitutionsListQueryParams(**params)

    @staticmethod
    def extract_data(
        query: SECInstitutionsListQueryParams,
        credentials: Optional[Dict[str, str]] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        """
        Extract list of institutions from SEC EDGAR

        Args:
            query: Query parameters
            credentials: Not required for SEC data
            **kwargs: Additional parameters

        Returns:
            Raw data with institutions list
        """
        # Check cache first
        if (SECInstitutionsListFetcher._cache is not None and
            SECInstitutionsListFetcher._cache_time is not None and
            datetime.now() - SECInstitutionsListFetcher._cache_time < SECInstitutionsListFetcher._cache_duration):
            log.info("Using cached institutions list")
            return SECInstitutionsListFetcher._cache

        log.info("Fetching institutions list from SEC EDGAR")

        headers = {
            'User-Agent': 'MarketPulse research@marketpulse.com',
            'Accept-Encoding': 'gzip, deflate',
            'Host': 'www.sec.gov'
        }

        # SEC 분기별 form 인덱스(full-index/{year}/QTR{q}/form.idx)에서 13F-HR
        # 파일러를 열거한다. 한 요청으로 해당 분기 전체 기관을 얻어(수천 건) CIK로
        # dedupe → 실제 13F 유니버스. (기존 browse-edgar getcompany 스크랩은 CIK
        # 없이는 목록을 못 줘서 항상 빈 결과였다.)
        institutions: Dict[str, Dict[str, Any]] = {}  # cik10 -> row (최근 분기 우선)

        try:
            for year, qtr in SECInstitutionsListFetcher._recent_quarters(2):
                url = (
                    f"https://www.sec.gov/Archives/edgar/full-index/"
                    f"{year}/QTR{qtr}/form.idx"
                )
                resp = requests.get(url, headers=headers, timeout=60)
                if resp.status_code != 200:
                    log.warning("form.idx 조회 실패 %sQTR%s: HTTP %s", year, qtr, resp.status_code)
                    continue

                for line in resp.text.splitlines():
                    if not line.startswith("13F-HR"):
                        continue
                    m = _FORM_IDX_RE.match(line)
                    if not m:
                        continue
                    _form_type, name, cik, filed = m.group(1), m.group(2).strip(), m.group(3), m.group(4)
                    cik10 = cik.zfill(10)
                    if cik10 in institutions:  # 최근 분기를 먼저 순회 → 최초 등장 유지
                        continue
                    institutions[cik10] = {
                        'cik': cik10,
                        'name': name,
                        'manager': name,
                        'filing_date': filed,
                    }

            rows = list(institutions.values())
            if query.limit and len(rows) > query.limit:
                rows = rows[: query.limit]

            log.info(f"Found {len(rows)} institutions (form.idx, 13F-HR)")

            cache_data = {'institutions': rows}
            if rows:  # 빈 결과는 캐시하지 않음(다음 호출에서 재시도)
                SECInstitutionsListFetcher._cache = cache_data
                SECInstitutionsListFetcher._cache_time = datetime.now()

            return cache_data

        except Exception as e:
            log.error(f"Error fetching institutions list: {e}")
            # Return empty list on error
            return {'institutions': []}

    @staticmethod
    def _recent_quarters(n: int = 2) -> List[tuple]:
        """오늘 기준 최근 n개 분기를 (year, quarter) 최신순으로 반환."""
        today = date.today()
        q = (today.month - 1) // 3 + 1
        y = today.year
        out: List[tuple] = []
        for _ in range(n):
            out.append((y, q))
            q -= 1
            if q == 0:
                q, y = 4, y - 1
        return out

    @staticmethod
    def transform_data(
        query: SECInstitutionsListQueryParams,
        data: Dict[str, Any],
        **kwargs: Any
    ) -> List[InstitutionInfo]:
        """
        Transform raw SEC data to InstitutionInfo models

        Args:
            query: Query parameters
            data: Raw data from extract_data
            **kwargs: Additional parameters

        Returns:
            List of InstitutionInfo objects
        """
        institutions_data = data.get('institutions', [])

        institutions = []
        for inst in institutions_data:
            # 동적 기관의 식별자는 CIK(안정적·충돌 없음). 알려진 featured 기관은
            # get_institutions_list 가 CIK→slug(berkshire 등)로 후처리해 덮어쓴다.
            institutions.append(InstitutionInfo(
                key=inst['cik'],
                name=inst['name'],
                cik=inst['cik'],
                manager=inst['manager'],
                description=f"13F Filer - {inst['manager']}"
            ))

        log.info(f"Transformed {len(institutions)} institutions")
        return institutions

    @staticmethod
    def _generate_key(name: str) -> str:
        """Generate a URL-friendly key from institution name"""
        # Remove common suffixes and clean up
        key = name.lower()

        # Remove common business entity types
        for suffix in [' inc', ' llc', ' lp', ' ltd', ' corp', ' co',
                      ' limited', ' corporation', ' management',
                      ' advisors', ' capital', ' partners']:
            key = key.replace(suffix, '')

        # Remove special characters and replace spaces with hyphens
        key = ''.join(c if c.isalnum() or c.isspace() else '' for c in key)
        key = '-'.join(key.split())

        # Truncate to reasonable length
        if len(key) > 30:
            key = key[:30]

        return key.strip('-')

    @classmethod
    def clear_cache(cls):
        """Clear the cached institutions list"""
        cls._cache = None
        cls._cache_time = None
        log.info("Institutions cache cleared")
