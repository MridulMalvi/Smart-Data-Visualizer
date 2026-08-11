"""Pydantic schemas shared across routers."""
from typing import Any, Literal, Optional
from pydantic import BaseModel, Field


# ── Upload / Session ──────────────────────────────────────────────────────────

class UploadResponse(BaseModel):
    session_id: str
    filename: str
    rows: int
    columns: list[str]
    suggested_charts: list[dict]


class ColumnMeta(BaseModel):
    name: str
    dtype: str
    sample: list[Any]


# ── Preview ───────────────────────────────────────────────────────────────────

class PreviewResponse(BaseModel):
    columns: list[str]
    rows: list[dict]
    total_rows: int


# ── Summary ───────────────────────────────────────────────────────────────────

class SummaryResponse(BaseModel):
    column_meta: list[ColumnMeta]
    missing_counts: dict[str, int]
    describe_stats: dict[str, dict[str, Any]]
    row_count: int
    col_count: int


# ── Filter ────────────────────────────────────────────────────────────────────

FilterOperator = Literal["==", "!=", ">", ">=", "<", "<=", "contains"]


class FilterRule(BaseModel):
    column: str
    operator: FilterOperator
    value: Any


class FilterRequest(BaseModel):
    session_id: str
    rules: list[FilterRule]


class FilterResponse(BaseModel):
    session_id: str
    rows_before: int
    rows_after: int


# ── Chart ─────────────────────────────────────────────────────────────────────

ChartType = Literal["line", "bar", "scatter", "histogram", "pie", "box"]


class ChartRequest(BaseModel):
    session_id: str
    chart_type: ChartType
    x_column: str
    y_column: Optional[str] = None
    bins: int = Field(default=20, ge=2, le=100)
    use_filtered: bool = True


class OutlierInfo(BaseModel):
    count: int
    method: Literal["iqr", "zscore"]
    row_indices: list[int]


class TrendlineInfo(BaseModel):
    slope: float
    intercept: float
    r_squared: float
    points: list[dict]


class ChartResponse(BaseModel):
    chart_type: ChartType
    data: list[dict]
    x_key: str
    y_key: Optional[str] = None
    outliers: Optional[OutlierInfo] = None
    trendline: Optional[TrendlineInfo] = None
    stats: dict[str, Any]


# ── NLQ ───────────────────────────────────────────────────────────────────────

class NLQRequest(BaseModel):
    session_id: str
    query: str


class NLQResponse(BaseModel):
    resolved: bool
    chart_type: Optional[ChartType] = None
    x_column: Optional[str] = None
    y_column: Optional[str] = None
    confidence: float = 0.0
    suggestion: Optional[str] = None   # shown when resolved=False


# ── Insight ───────────────────────────────────────────────────────────────────

class InsightRequest(BaseModel):
    session_id: str
    chart_type: ChartType
    x_column: str
    y_column: Optional[str] = None
    stats: dict[str, Any]


class InsightResponse(BaseModel):
    insight: str
    cached: bool


# ── Export ────────────────────────────────────────────────────────────────────

class ExportRequest(BaseModel):
    session_id: str
    use_filtered: bool = True
