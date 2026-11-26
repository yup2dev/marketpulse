"""SEC 13F 제출 기관 목록 — 분기별 form.idx 에서 13F-HR 파일러를 모은다. 이 목록을 받는 곳은 여기 하나다.

    sec_institutions(limit)        13F 제출 기관 → [InstitutionInfo] (24시간 메모리 캐시, 동기)
    fetch_13f_filers(limit)        HTTP 만 ({'institutions': [ {cik, name, manager, filing_date} ]})
    to_institutions(data)          원시 → InstitutionInfo
    recent_quarters(n) · clear_cache()

13F 조회 모델은 sec_institutions 를 부른다 (다른 fetcher 를 부르지 않는다 — tests/test_module_boundaries.py).
범용 SECInstitutionsListFetcher 도 이 함수들을 쓴다.
"""
import logging
import re
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

import requests

log = logging.getLogger(__name__)

# form.idx 한 줄: "<FormType> <CompanyName> <CIK> <YYYY-MM-DD> <path>" (고정폭이지만
# 회사명에 숫자가 들어갈 수 있어, 날짜를 앵커로 CIK를 비탐욕 매칭한다).
_FORM_IDX_RE = re.compile(r"^(13F-HR(?:/A)?)\s+(.+?)\s+(\d+)\s+(\d{4}-\d{2}-\d{2})\s+")

_CACHE_DURATION = timedelta(hours=24)
_state: Dict[str, Any] = {"data": None, "time": None}


def recent_quarters(n: int = 2) -> List[tuple]:
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


def clear_cache() -> None:
    _state["data"] = None
    _state["time"] = None
    log.info("Institutions cache cleared")


def fetch_13f_filers(limit: Optional[int] = None) -> Dict[str, Any]:
    """13F-HR 파일러 목록. 실패하면 빈 목록 (빈 결과는 캐시하지 않는다)."""
    # Check cache first
    if (_state['data'] is not None and
        _state['time'] is not None and
        datetime.now() - _state['time'] < _CACHE_DURATION):
        log.info("Using cached institutions list")
        return _state['data']

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
        for year, qtr in recent_quarters(2):
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
        if limit and len(rows) > limit:
            rows = rows[: limit]

        log.info(f"Found {len(rows)} institutions (form.idx, 13F-HR)")

        cache_data = {'institutions': rows}
        if rows:  # 빈 결과는 캐시하지 않음(다음 호출에서 재시도)
            _state['data'] = cache_data
            _state['time'] = datetime.now()

        return cache_data

    except Exception as e:
        log.error(f"Error fetching institutions list: {e}")
        # Return empty list on error
        return {'institutions': []}


def to_institutions(data: Dict[str, Any]) -> list:
    from data_fetcher.abstract_provider.standard_models.institutions_list import InstitutionInfo

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


def sec_institutions(limit: Optional[int] = None) -> list:
    """13F 제출 기관 — SECInstitutionsListFetcher 와 같은 결과 (다른 fetcher 를 거치지 않는다)."""
    return to_institutions(fetch_13f_filers(limit))
