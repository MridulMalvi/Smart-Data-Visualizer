"""
Export router — streams filtered or original DataFrame as CSV.

GET /api/export/csv/{session_id}?use_filtered=true
"""
import io

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from app.store import get_session

router = APIRouter()


@router.get("/csv/{session_id}")
async def export_csv(
    session_id: str,
    use_filtered: bool = Query(default=True),
):
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found or expired.")

    df = session["filtered_df"] if use_filtered else session["original_df"]
    filename = session.get("filename", "export").rsplit(".", 1)[0]
    suffix = "_filtered" if use_filtered else ""

    buf = io.StringIO()
    df.to_csv(buf, index=False)
    buf.seek(0)

    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}{suffix}.csv"'},
    )
