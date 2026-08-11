"""
Summary router — returns column metadata, missing counts, and describe() stats.

GET /api/summary/{session_id}
"""
from fastapi import APIRouter, HTTPException, status

from app.store import get_session
from app.services.data_processor import compute_summary
from app.models.schemas import SummaryResponse, ColumnMeta

router = APIRouter()


@router.get("/{session_id}", response_model=SummaryResponse)
async def get_summary(session_id: str):
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found or expired.")

    df = session["original_df"]
    summary = compute_summary(df)

    return SummaryResponse(
        column_meta=[ColumnMeta(**c) for c in summary["column_meta"]],
        missing_counts=summary["missing_counts"],
        describe_stats=summary["describe_stats"],
        row_count=summary["row_count"],
        col_count=summary["col_count"],
    )
