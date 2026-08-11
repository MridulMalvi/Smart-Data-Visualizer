"""
Preview router — returns first N rows of the dataset.

GET /api/preview/{session_id}?rows=10&use_filtered=true
"""
from fastapi import APIRouter, HTTPException, Query, status

from app.store import get_session
from app.services.data_processor import df_to_json_records
from app.models.schemas import PreviewResponse

router = APIRouter()


@router.get("/{session_id}", response_model=PreviewResponse)
async def get_preview(
    session_id: str,
    rows: int = Query(default=10, ge=1, le=100),
    use_filtered: bool = Query(default=False),
):
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found or expired.")

    df = session["filtered_df"] if use_filtered else session["original_df"]
    preview_df = df.head(rows)

    return PreviewResponse(
        columns=preview_df.columns.tolist(),
        rows=df_to_json_records(preview_df),
        total_rows=len(df),
    )
