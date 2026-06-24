"""SEC XBRL Taxonomy Explorer Model."""

# pylint: disable=unused-argument

from typing import Any, Literal

from data_fetcher.utils.provider_errors import OpenBBError
from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.fetcher import Fetcher
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams
from pydantic import Field, model_validator

TAXONOMY_CHOICES = Literal[
    "us-gaap",
    "srt",
    "dei",
    "ecd",
    "cyd",
    "ffd",
    "ifrs",
    "hmrc-dpl",
    "rxp",
    "spac",
    "cef",
    "oef",
    "vip",
    "fnd",
    "sro",
    "sbs",
    "rocr",
    "country",
    "currency",
    "exch",
    "naics",
    "sic",
    "stpr",
    "snj",
]

CATEGORY_CHOICES = Literal[
    "operating_company",
    "investment_company",
    "self_regulatory_org",
    "sbs_repository",
    "nrsro",
    "common_reference",
]


class SecSchemaFilesQueryParams(BaseQueryParams):
    """SEC XBRL Taxonomy Explorer Query.

    Source: https://sec.gov/

    Progressively explore SEC/FASB XBRL taxonomies:

    - No parameters: list all available taxonomy families.
    - taxonomy only: get all parsed structures for the most recent year.
    - taxonomy + year: get all parsed structures for a specific year.
    - taxonomy + component: get one component's structure using the most recent year.
    - taxonomy + year + component: get one component's parsed structure.
    """

    taxonomy: TAXONOMY_CHOICES | None = Field(
        default=None,
        description=(
            "Taxonomy family to explore. "
            + "Omit to list all available taxonomies and their descriptions."
        ),
    )
    year: int | None = Field(
        default=None,
        description=(
            "Taxonomy year (e.g. 2011+ for us-gaap, varies by taxonomy). "
            + "Defaults to the most recent year when omitted."
        ),
    )
    component: str | None = Field(
        default=None,
        description=(
            "Presentation component to retrieve. Values are taxonomy-specific. "
            + "Omit to return all components for the taxonomy."
        ),
    )
    category: CATEGORY_CHOICES | None = Field(
        default=None,
        description=("Filter taxonomies by SEC filer category."),
    )

    @model_validator(mode="after")
    def _validate_progressive_params(self):
        """Enforce progressive drill-down: year requires taxonomy, component requires year."""
        if self.year is not None and self.taxonomy is None:
            raise ValueError(
                "Parameter 'year' requires 'taxonomy' to be set. "
                "Provide a taxonomy first, or omit both to list all taxonomies."
            )
        if self.component is not None and self.taxonomy is None:
            raise ValueError("Parameter 'component' requires 'taxonomy' to be set.")
        if self.category is not None and self.taxonomy is not None:
            raise ValueError(
                "Parameter 'category' is only used when listing all taxonomies "
                "(i.e., when 'taxonomy' is not set)."
            )
        return self


class SecSchemaFilesData(BaseData):
    """SEC XBRL Taxonomy Explorer Data."""

    name: str = Field(
        description=(
            "Identifier: taxonomy key, year, component name, or XBRL element ID "
            "depending on the query mode."
        )
    )
    label: str | None = Field(
        default=None,
        description="Human-readable label.",
    )
    description: str | None = Field(
        default=None,
        description="Description or long name.",
    )
    category: str | None = Field(
        default=None,
        description="Taxonomy category (e.g., operating_company).",
    )
    style: str | None = Field(
        default=None,
        description="Taxonomy style (e.g., FASB_STANDARD, SEC_EMBEDDED).",
    )
    has_label_linkbase: bool | None = Field(
        default=None,
        description="Whether the taxonomy has a parseable label linkbase.",
    )
    url: str | None = Field(
        default=None,
        description="URL to the taxonomy resource or SEC reference page.",
    )
    level: int | None = Field(
        default=None,
        description="Hierarchy depth in presentation structure (0 = root).",
    )
    order: float | None = Field(
        default=None,
        description="Sort order within parent in presentation structure.",
    )
    parent_id: str | None = Field(
        default=None,
        description="Parent XBRL element ID in presentation structure.",
    )
    preferred_label: str | None = Field(
        default=None,
        description="Preferred label role URI for presentation rendering.",
    )
    xbrl_type: str | None = Field(
        default=None,
        description=(
            "XBRL data type (e.g., monetaryItemType, textBlockItemType, "
            "stringItemType, sharesItemType, perShareItemType, domainItemType)."
        ),
    )
    period_type: str | None = Field(
        default=None,
        description="Period type: 'instant' (point-in-time) or 'duration' (over a period).",
    )
    balance_type: str | None = Field(
        default=None,
        description="Balance type for monetary items: 'credit' or 'debit'.",
    )
    abstract: bool | None = Field(
        default=None,
        description="Whether the element is abstract (grouping/heading only, not taggable).",
    )
    substitution_group: str | None = Field(
        default=None,
        description=(
            "XBRL substitution group: 'item' (line item), 'dimensionItem' (axis), "
            "'hypercubeItem' (table)."
        ),
    )
    nillable: bool | None = Field(
        default=None,
        description="Whether the element value can be nil.",
    )


