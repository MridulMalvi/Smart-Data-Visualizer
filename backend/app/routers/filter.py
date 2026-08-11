"""
Filter router — applies column filter rules server-side.

POST /api/filter/apply     → apply rules, update filtered_df in session
POST /api/filter/reset     → reset filtered_df to original_df
"""
from fastapi import APIRouter, HTTPException, status

from app.store import get_session, update_filtered_df
from app.services.data_processor import apply_filter
from app.models.schemas import FilterRequest, FilterResponse

router = APIRouter()


@router.post("/apply", response_model=FilterResponse)
async def apply_filters(request: FilterRequest):
    session = get_session(request.session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found or expired.")

    original_df = session["original_df"]
    rows_before = len(original_df)

    rules = [r.model_dump() for r in request.rules]

    if not rules:
        # No rules — reset to original
        update_filtered_df(request.session_id, original_df)
        return FilterResponse(
            session_id=request.session_id,
            rows_before=rows_before,
            rows_after=rows_before,
        )

    try:
        filtered = apply_filter(original_df, rules)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Filter error: {exc}",
        )

    update_filtered_df(request.session_id, filtered)

    return FilterResponse(
        session_id=request.session_id,
        rows_before=rows_before,
        rows_after=len(filtered),
    )


@router.post("/reset")
async def reset_filters(body: dict):
    session_id = body.get("session_id", "")
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found or expired.")
    update_filtered_df(session_id, session["original_df"])
    return {"session_id": session_id, "rows_after": len(session["original_df"])}
