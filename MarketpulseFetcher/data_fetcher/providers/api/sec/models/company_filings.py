"""SEC Company Filings Model."""

# pylint: disable=unused-argument

from datetime import (
    date as dateType,
    datetime,
)
from typing import Any
from warnings import warn

from data_fetcher.utils.provider_errors import OpenBBError
from data_fetcher.abstract_provider.abstract.base_fetchers import ApiFetcher
from data_fetcher.abstract_provider.standard_models.company_filings import (
    CompanyFilingsData,
    CompanyFilingsQueryParams,
)
from data_fetcher.abstract_provider.field_descriptions import QUERY_DESCRIPTIONS
from data_fetcher.providers.api.sec.utils.definitions import FORM_LIST
from data_fetcher.providers.api.sec.utils.filings import fetch_company_filings, to_filings_rows
from pydantic import Field, field_validator


class SecCompanyFilingsQueryParams(CompanyFilingsQueryParams):
    """SEC Company Filings Query.

    Source: https://sec.gov/
    """

    __json_schema_extra__ = {
        "form_type": {
            "multiple_items_allowed": True,
            "choices": FORM_LIST,
        }
    }

    cik: str | int | None = Field(
        description="Lookup filings by Central Index Key (CIK) instead of by symbol.",
        default=None,
    )
    start_date: dateType | None = Field(
        default=None,
        description=QUERY_DESCRIPTIONS.get("start_date", ""),
    )
    end_date: dateType | None = Field(
        default=None,
        description=QUERY_DESCRIPTIONS.get("end_date", ""),
    )
    form_type: str | None = Field(
        description="SEC form type to filter by.",
        default=None,
    )
    limit: int | None = Field(
        default=None,
        description=QUERY_DESCRIPTIONS.get("limit", ""),
    )
    use_cache: bool = Field(
        description="Whether or not to use cache.  If True, cache will store for one day.",
        default=True,
    )

    @field_validator("form_type", mode="before", check_fields=False)
    @classmethod
    def validate_form_type(cls, v):
        """Validate form_type."""
        if not v:
            return None
        if isinstance(v, str):
            forms = v.split(",")
        elif isinstance(v, list):
            forms = v
        else:
            raise OpenBBError("Unexpected form_type value.")
        new_forms: list = []
        messages: list = []
        for form in forms:
            if form.upper() in FORM_LIST:
                new_forms.append(form.upper())
            else:
                messages.append(f"Invalid form type: {form}")

        if not new_forms:
            raise OpenBBError(
                f"No valid forms provided -> {', '.join(messages)} -> Valid forms: {', '.join(FORM_LIST)}"
            )

        if new_forms and messages:
            warn("\n ".join(messages))

        return ",".join(new_forms) if len(new_forms) > 1 else new_forms[0]


class SecCompanyFilingsData(CompanyFilingsData):
    """SEC Company Filings Data."""

    __alias_dict__ = {
        "filing_date": "filingDate",
        "accepted_date": "acceptanceDateTime",
        "filing_url": "filingDetailUrl",
        "report_url": "primaryDocumentUrl",
        "report_type": "form",
        "report_date": "reportDate",
        "primary_doc_description": "primaryDocDescription",
        "primary_doc": "primaryDocument",
        "accession_number": "accessionNumber",
        "file_number": "fileNumber",
        "film_number": "filmNumber",
        "is_inline_xbrl": "isInlineXBRL",
        "is_xbrl": "isXBRL",
        "complete_submission_url": "completeSubmissionUrl",
        "filing_detail_url": "filingDetailUrl",
    }

    report_date: dateType | None = Field(
        description="The date of the filing.",
        default=None,
    )
    act: str | int | None = Field(description="The SEC Act number.", default=None)
    items: str | float | None = Field(description="The SEC Item numbers.", default=None)
    primary_doc_description: str | None = Field(
        description="The description of the primary document.",
        default=None,
    )
    primary_doc: str | None = Field(
        description="The filename of the primary document.",
        default=None,
    )
    accession_number: str | int | None = Field(
        description="The accession number.",
        default=None,
    )
    file_number: str | int | None = Field(
        description="The file number.",
        default=None,
    )
    film_number: str | int | None = Field(
        description="The film number.",
        default=None,
    )
    is_inline_xbrl: str | int | None = Field(
        description="Whether the filing is an inline XBRL filing.",
        default=None,
    )
    is_xbrl: str | int | None = Field(
        description="Whether the filing is an XBRL filing.",
        default=None,
    )
    size: str | int | None = Field(description="The size of the filing.", default=None)
    complete_submission_url: str | None = Field(
        description="The URL to the complete filing submission.",
        default=None,
    )
    filing_detail_url: str | None = Field(
        description="The URL to the filing details.",
        default=None,
    )

    @field_validator("report_date", mode="before", check_fields=False)
    @classmethod
    def validate_report_date(cls, v: str | dateType | None):
        """Validate report_date."""
        if isinstance(v, dateType):
            return v
        v = v if v != "" else None
        return (
            datetime.strptime(v, "%Y-%m-%d").date()
            if v and isinstance(v, str)
            else None
        )


class SecCompanyFilingsFetcher(
    ApiFetcher[SecCompanyFilingsQueryParams, list[SecCompanyFilingsData]]
):
    """SEC Company Filings Fetcher."""

    require_credentials = False  # SEC EDGAR is keyless

    @staticmethod
    def transform_query(params: dict[str, Any]) -> SecCompanyFilingsQueryParams:
        """Transform query params."""
        return SecCompanyFilingsQueryParams(**params)

    @staticmethod
    async def aextract_data(
        query: SecCompanyFilingsQueryParams,
        credentials: dict[str, str] | None,
        **kwargs: Any,
    ) -> list[dict]:
        """Extract the data from the SEC endpoint (utils/filings.fetch_company_filings)."""
        return await fetch_company_filings(query, credentials, **kwargs)

    @staticmethod
    def transform_data(
        query: SecCompanyFilingsQueryParams, data: list[dict], **kwargs: Any
    ) -> list[SecCompanyFilingsData]:
        """Transform the data (utils/filings.to_filings_rows)."""
        return to_filings_rows(query, data, **kwargs)
