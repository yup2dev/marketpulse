"""Standard Model: Indicator Metadata (지표/테이블 메타데이터 카탈로그)."""
from pydantic import Field

from data_fetcher.abstract_provider.abstract.data import BaseData
from data_fetcher.abstract_provider.abstract.query_params import BaseQueryParams


class IndicatorMetadata(BaseData):
    """지표 메타데이터."""

    symbol: str = Field(
        description="Concatenated series identifier for the indicator.",
        validation_alias="series_id",
        serialization_alias="symbol",
        json_schema_extra={
            "x-widget_config": {
                "renderFn": "cellOnClick",
                "renderFnParams": {
                    "actionType": "groupBy",
                    "groupBy": {"paramName": "symbol", "valueField": "symbol"},
                },
            }
        },
    )
    label: str = Field(description="Human-readable label for the indicator.")
    description: str | None = Field(
        default=None, description="Detailed description of the indicator."
    )
    dimension_id: str = Field(
        description="The dimension ID of the indicator in the data structure."
    )
    indicator: str = Field(description="Indicator code.")
    agency_id: str = Field(description="The agency ID responsible for the indicator.")
    structure_id: str = Field(
        description="The data structure ID associated with the indicator."
    )
    dataflow_id: str = Field(description="The dataflow ID the indicator belongs to.")
    dataflow_name: str = Field(description="The name of the dataflow.")


class TableMetadata(BaseData):
    """테이블 메타데이터."""

    name: str = Field(description="The name of the table.")
    symbol: str = Field(description="The table symbol.")
    description: str = Field(description="Description of the table.")
    agency_id: str = Field(description="The agency ID responsible for the table.")
    dataflow_id: str = Field(description="The dataflow ID the table belongs to.")
    codelist_id: str = Field(description="The codelist ID associated with the table.")


class PresentationTableQueryParams(BaseQueryParams):
    """프레젠테이션 테이블 메타데이터 조회 파라미터."""

    dataflow: str | None = Field(
        default=None, description="The dataflow ID. See list_dataflows() for options."
    )
    table: str | None = Field(
        default=None, description="The table ID. See list_tables() for options."
    )
    country: str | None = Field(default=None, description="Country code to filter the data.")
    frequency: str | None = Field(default=None, description="Frequency of the data.")
    dimension_values: str | None = Field(
        default=None,
        description="Dimension selection for filtering. Format: 'DIM_ID1:VAL1+VAL2.'",
    )
    limit: int = Field(default=4, description="Maximum number of records to retrieve per series.")
    raw: bool = Field(default=False, description="Return presentation table as raw JSON data if True.")
