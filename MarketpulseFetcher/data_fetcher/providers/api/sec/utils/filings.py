"""SEC 회사 공시 목록(submissions) HTTP — 이 목록을 받는 곳은 여기 하나다.

    sec_company_filings(params, credentials)   공시 목록 → [SecCompanyFilingsData] (없으면 EmptyDataError)
    fetch_company_filings(query, ...)          HTTP 만 (원시 행 목록 — 1000건이 넘으면 추가 페이지까지)
    to_filings_rows(query, data)               원시 행 → SecCompanyFilingsData (기간 · 양식 · 개수 필터)

Form 4 · 13F 후보 · MD&A 처럼 공시 목록이 필요한 곳은 sec_company_filings 를 부른다. 다른 fetcher 를 부르지 않는다
(tests/test_module_boundaries.py). 범용 SecCompanyFilingsFetcher 도 이 함수들을 쓴다.
"""
from typing import Any

from data_fetcher.providers.api.sec.utils.definitions import HEADERS
from data_fetcher.utils.provider_errors import EmptyDataError, OpenBBError


async def fetch_company_filings(query: Any, credentials: dict | None = None, **kwargs: Any) -> list[dict]:
    """Extract the data from the SEC endpoint."""
    # pylint: disable=import-outside-toplevel
    from aiohttp_client_cache import SQLiteBackend
    from aiohttp_client_cache.session import CachedSession
    from data_fetcher.utils.provider_settings import get_user_cache_directory
    from data_fetcher.utils.provider_helpers import amake_request, amake_requests
    from data_fetcher.providers.api.sec.utils.helpers import symbol_map
    from pandas import DataFrame

    filings = DataFrame()

    if query.symbol and not query.cik:
        query.cik = await symbol_map(
            query.symbol.lower(), use_cache=query.use_cache
        )
        if not query.cik:
            raise OpenBBError(f"CIK not found for symbol {query.symbol}")
    if query.cik is None:
        raise OpenBBError("CIK or symbol must be provided.")

    # The leading 0s need to be inserted but are typically removed from the data to store as an integer.
    if len(query.cik) != 10:  # type: ignore
        cik_: str = ""
        temp = 10 - len(query.cik)  # type: ignore
        for i in range(temp):
            cik_ = cik_ + "0"
        query.cik = cik_ + str(query.cik)  # type: ignore

    url = f"https://data.sec.gov/submissions/CIK{query.cik}.json"
    data: dict | list[dict] = []
    if query.use_cache is True:
        cache_dir = f"{get_user_cache_directory()}/http/sec_company_filings"
        async with CachedSession(
            cache=SQLiteBackend(cache_dir, expire_after=3600 * 24)
        ) as session:
            await session.delete_expired_responses()
            try:
                data = await amake_request(url, headers=HEADERS, session=session)  # type: ignore
            finally:
                await session.close()
    else:
        data = await amake_request(url, headers=HEADERS)  # type: ignore

    # This seems to work for the data structure.
    filings = (
        DataFrame.from_records(data["filings"].get("recent")) if "filings" in data else DataFrame()  # type: ignore
    )
    results = filings.to_dict("records")

    # If there are lots of filings, there will be custom pagination.
    if (
        (query.limit and len(filings) >= 1000)
        or query.form_type is not None
        or query.limit == 0
    ):

        async def callback(response, session):
            """Response callback for excess company filings."""
            result = await response.json()
            if result:
                new_data = DataFrame.from_records(result)
                results.extend(new_data.to_dict("records"))

        urls: list = []
        new_urls = DataFrame(data["filings"].get("files")) if "filings" in data else DataFrame()  # type: ignore
        for i in new_urls.index:
            new_cik: str = data["filings"]["files"][i]["name"]  # type: ignore
            new_url: str = "https://data.sec.gov/submissions/" + new_cik
            urls.append(new_url)
        if query.use_cache is True:
            cache_dir = f"{get_user_cache_directory()}/http/sec_company_filings"
            async with CachedSession(
                cache=SQLiteBackend(cache_dir, expire_after=3600 * 24)
            ) as session:
                try:
                    await amake_requests(urls, headers=HEADERS, session=session, response_callback=callback)  # type: ignore
                finally:
                    await session.close()
        else:
            await amake_requests(urls, headers=HEADERS, response_callback=callback)  # type: ignore

    return results


def to_filings_rows(query: Any, data: list[dict], **kwargs: Any) -> list:
    from data_fetcher.providers.api.sec.models.company_filings import SecCompanyFilingsData  # 순환 import 방지

    """Transform the data."""
    # pylint: disable=import-outside-toplevel
    from numpy import nan
    from pandas import NA, DataFrame, to_datetime

    if not data:
        raise EmptyDataError(
            f"No filings found for CIK {query.cik}, or symbol {query.symbol}"
        )
    cols = [
        "reportDate",
        "filingDate",
        "acceptanceDateTime",
        "act",
        "form",
        "items",
        "primaryDocDescription",
        "primaryDocument",
        "accessionNumber",
        "fileNumber",
        "filmNumber",
        "isInlineXBRL",
        "isXBRL",
        "size",
    ]
    filings = DataFrame(data, columns=cols).astype(str)
    filings["reportDate"] = to_datetime(filings["reportDate"]).dt.date
    filings["filingDate"] = to_datetime(filings["filingDate"]).dt.date
    filings = filings.sort_values(by=["filingDate", "reportDate"], ascending=False)
    if query.start_date:
        filings = filings[filings["filingDate"] >= query.start_date]
    if query.end_date:
        filings = filings[filings["filingDate"] <= query.end_date]
    base_url = f"https://www.sec.gov/Archives/edgar/data/{str(int(query.cik))}/"  # type: ignore
    filings["primaryDocumentUrl"] = (
        base_url
        + filings["accessionNumber"].str.replace("-", "")
        + "/"
        + filings["primaryDocument"]
    )
    filings["completeSubmissionUrl"] = (
        base_url + filings["accessionNumber"] + ".txt"
    )
    filings["filingDetailUrl"] = (
        base_url + filings["accessionNumber"] + "-index.htm"
    )
    if query.form_type:
        form_types = query.form_type.replace("_", " ").split(",")
        filings = filings[
            filings.form.str.contains("|".join(form_types), case=False, na=False)
        ]
    if query.limit:
        filings = filings.head(query.limit) if query.limit != 0 else filings

    if len(filings) == 0:
        raise EmptyDataError("No filings were found using the filters provided.")
    filings = filings.replace({NA: None, nan: None})

    return [
        SecCompanyFilingsData.model_validate(d) for d in filings.to_dict("records")
    ]


async def sec_company_filings(params: dict, credentials: dict | None = None) -> list:
    """공시 목록 — SecCompanyFilingsFetcher.fetch_data 와 같은 결과 (다른 fetcher 를 거치지 않는다)."""
    from data_fetcher.providers.api.sec.models.company_filings import SecCompanyFilingsQueryParams  # 순환 import 방지

    query = SecCompanyFilingsQueryParams(**params)
    return to_filings_rows(query, await fetch_company_filings(query, credentials))
