"""
Chart router — aggregates data for the requested chart type.

POST /api/chart/data    → returns chart records + outlier info + trendline
"""
from fastapi import APIRouter, HTTPException, status

from app.store import get_session
from app.services.data_processor import (
    get_chart_data,
    detect_outliers,
    fit_trendline,
    compute_chart_stats,
)
from app.models.schemas import ChartRequest, ChartResponse, OutlierInfo, TrendlineInfo

router = APIRouter()


@router.post("/data", response_model=ChartResponse)
async def get_chart(request: ChartRequest):
    session = get_session(request.session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found or expired.")

    df = session["filtered_df"] if request.use_filtered else session["original_df"]

    # Validate columns
    if request.x_column not in df.columns:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Column '{request.x_column}' not found in dataset.",
        )
    if request.y_column and request.y_column not in df.columns:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Column '{request.y_column}' not found in dataset.",
        )

    try:
        records, raw_stats = get_chart_data(
            df,
            chart_type=request.chart_type,
            x_col=request.x_column,
            y_col=request.y_column,
            bins=request.bins,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Chart data generation error: {exc}",
        )

    # ── Outlier detection ───────────────────────────────────────────────────
    target_col = request.y_column or request.x_column
    outlier_info = None
    try:
        import pandas as pd
        if pd.api.types.is_numeric_dtype(df[target_col]):
            od = detect_outliers(df, target_col, method="iqr")
            outlier_info = OutlierInfo(**od)
    except Exception:
        pass  # Non-fatal; chart still returns

    # ── Trendline (line/scatter only) ───────────────────────────────────────
    trendline_info = None
    if request.chart_type in ("line", "scatter") and request.y_column:
        try:
            import pandas as pd
            if (
                pd.api.types.is_numeric_dtype(df[request.x_column])
                and pd.api.types.is_numeric_dtype(df[request.y_column])
            ):
                tl = fit_trendline(df, request.x_column, request.y_column)
                if tl:
                    trendline_info = TrendlineInfo(**tl)
        except Exception:
            pass

    # ── Chart-level stats for NLG ───────────────────────────────────────────
    try:
        stats = compute_chart_stats(df, request.chart_type, request.x_column, request.y_column)
        stats.update(raw_stats)
    except Exception:
        stats = dict(raw_stats)  # Fall back to raw chart stats on any error

    return ChartResponse(
        chart_type=request.chart_type,
        data=records,
        x_key="x" if request.chart_type != "pie" else "name",
        y_key="y" if request.chart_type not in ("pie", "box") else "value",
        outliers=outlier_info,
        trendline=trendline_info,
        stats=stats,
    )
