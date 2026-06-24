"""SEC XBRL Taxonomy Explorer Model."""

# pylint: disable=unused-argument

from typing import Any, Literal

from data_fetcher.utils.provider_errors import OpenBBError
from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.fetcher import Fetcher
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams
from pydantic import Field, model_validator

from data_fetcher.abstract_provider.standard_models.schema_files import (
    TAXONOMY_CHOICES,
    CATEGORY_CHOICES,
    SecSchemaFilesQueryParams,
    SecSchemaFilesData,
)


def _flatten_nodes(nodes) -> list[dict[str, Any]]:
    """Recursively flatten XBRLNode trees into a list of dicts."""
    results: list[dict[str, Any]] = []
    for node in nodes:
        results.append(
            {
                "name": node.element_id,
                "label": node.label,
                "description": node.documentation,
                "level": node.level,
                "order": node.order,
                "parent_id": node.parent_id,
                "preferred_label": node.preferred_label,
                "xbrl_type": node.xbrl_type,
                "period_type": node.period_type,
                "balance_type": node.balance_type,
                "abstract": node.abstract,
                "substitution_group": node.substitution_group,
                "nillable": node.nillable,
            }
        )
        if node.children:
            results.extend(_flatten_nodes(node.children))
    return results


class SecSchemaFilesFetcher(
    Fetcher[SecSchemaFilesQueryParams, list[SecSchemaFilesData]]
):
    """SEC XBRL Taxonomy Explorer Fetcher."""

    @staticmethod
    def transform_query(params: dict[str, Any]) -> SecSchemaFilesQueryParams:
        """Transform the query."""
        return SecSchemaFilesQueryParams(**params)

    @staticmethod
    def extract_data(
        query: SecSchemaFilesQueryParams,
        credentials: dict[str, str] | None,
        **kwargs: Any,
    ) -> list[dict[str, Any]]:
        """Extract taxonomy data based on the query parameters.

        Operates in progressive modes:
        1. No params → list all taxonomy families
        2. taxonomy (+ optional year, no component) → auto-resolve year if needed, return all components
        3. taxonomy + component (+ optional year) → return one component's structure
        """
        # pylint: disable=import-outside-toplevel
        from data_fetcher.providers.sec.utils.xbrl_taxonomy_helper import XBRLManager

        manager = XBRLManager()

        # Mode 1: List all taxonomy families
        if query.taxonomy is None:
            taxonomies = manager.list_available_taxonomies(query.category)
            return [
                {
                    "name": key,
                    "label": meta["label"],
                    "description": meta["description"],
                    "category": meta["category"],
                    "style": meta["style"],
                    "has_label_linkbase": meta["has_label_linkbase"] == "True",
                    "url": meta["sec_reference_url"],
                }
                for key, meta in taxonomies.items()
            ]

        # Mode 2: Auto-resolve year to the most recent if not supplied
        year = query.year
        available_years = manager.get_available_years(query.taxonomy)
        if year is None:
            if not available_years:
                raise OpenBBError(
                    f"No years found for taxonomy '{query.taxonomy}'. "
                    "Omit all parameters to list available taxonomies."
                )
            year = max(available_years)
        elif available_years and year not in available_years:
            raise OpenBBError(
                f"Year {year} is not available for taxonomy '{query.taxonomy}'. "
                f"Available years: {sorted(available_years, reverse=True)}"
            )

        # Resolve components to fetch
        if query.component is not None:
            target_components = [query.component]
        else:
            target_components = manager.list_available_components(query.taxonomy, year)
            if not target_components:
                raise OpenBBError(f"No components found for {query.taxonomy} {year}.")

            # Smart default: if multiple components, return component listing
            # with metadata instead of parsing everything (which is too heavy
            # for taxonomies like us-gaap with 26 components or IFRS with 47).
            # Single-component taxonomies auto-parse fully.
            if len(target_components) > 1:
                return manager.get_components_metadata(query.taxonomy, year)

        # Fetch and flatten all target components
        results: list[dict[str, Any]] = []
        for comp in target_components:
            nodes = manager.get_structure(query.taxonomy, year, comp)
            results.extend(_flatten_nodes(nodes))
        return results

    @staticmethod
    def transform_data(
        query: SecSchemaFilesQueryParams,
        data: list[dict[str, Any]],
        **kwargs: Any,
    ) -> list[SecSchemaFilesData]:
        """Transform the data to the standard format."""
        return [SecSchemaFilesData.model_validate(d) for d in data]
