"""SEC 13F-HR 제출 목록 — submissions API (HTTP 헬퍼, fetcher 아님).

browse-edgar 스크래핑 대신 submissions JSON 을 쓰는 이유: 한 번의 요청으로 `reportDate`(분기말)까지
정확히 얻는다 (제출일에서 분기말을 역산하면 지연 · 수정 제출에서 어긋난다).
browse-edgar 는 count=2 같은 값을 400 으로 거절해 최신 분기 조회가 깨져 있었다.
"""
from typing import Dict, List

import requests

_HEADERS = {
    'User-Agent': 'MarketPulse research@marketpulse.com',
    'Accept-Encoding': 'gzip, deflate',
}


def list_13f_filings(cik: str, limit: int) -> List[Dict[str, str]]:
    """13F-HR 목록 최신순 — [{accession, filing_date, period}] (13F-HR/A 수정분은 원본과 중복돼 제외)."""
    url = f"https://data.sec.gov/submissions/CIK{str(cik).zfill(10)}.json"
    resp = requests.get(url, headers=_HEADERS, timeout=30)
    resp.raise_for_status()
    recent = (resp.json().get('filings') or {}).get('recent') or {}

    filings: List[Dict[str, str]] = []
    for i, form in enumerate(recent.get('form', [])):
        if form != '13F-HR':
            continue
        filings.append({
            'accession': recent.get('accessionNumber', [])[i],
            'filing_date': recent.get('filingDate', [])[i],
            'period': recent.get('reportDate', [])[i],
        })
        if len(filings) >= limit:
            break
    return filings


def filing_index_url(cik: str, accession: str) -> str:
    """accession number → 필링 인덱스 페이지 URL (SEC13FFetcher._parse_filing 입력)."""
    return (
        f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/"
        f"{accession.replace('-', '')}/{accession}-index.htm"
    )
