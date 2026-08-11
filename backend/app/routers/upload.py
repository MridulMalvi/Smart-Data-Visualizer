"""
Upload router — handles CSV/XLSX file ingestion.

POST /api/upload/
  - Validates file type and size
  - Reads into Pandas DataFrame
  - Tries to parse date-like columns automatically
  - Stores session in memory
  - Returns session_id + metadata + auto-suggested chart configs
"""
import uuid
import io

import pandas as pd
from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.store import create_session
from app.services.data_processor import suggest_charts
from app.models.schemas import UploadResponse

router = APIRouter()

ALLOWED_TYPES = {
    "text/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/octet-stream",  # browsers sometimes send this for CSV
}
MAX_SIZE_MB = 50
MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024


@router.post("/", response_model=UploadResponse)
async def upload_file(file: UploadFile = File(...)):
    # ── Validation ─────────────────────────────────────────────────────────
    if file.content_type not in ALLOWED_TYPES and not (
        file.filename.endswith(".csv") or file.filename.endswith(".xlsx")
    ):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type '{file.content_type}'. Upload a CSV or XLSX file.",
        )

    raw_bytes = await file.read()

    if len(raw_bytes) > MAX_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the {MAX_SIZE_MB} MB limit.",
        )

    if len(raw_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    # ── Parse ───────────────────────────────────────────────────────────────
    try:
        fname = file.filename or "upload"
        if fname.lower().endswith(".xlsx"):
            df = pd.read_excel(io.BytesIO(raw_bytes))
        else:
            # Try common encodings
            for enc in ("utf-8", "latin-1", "cp1252"):
                try:
                    df = pd.read_csv(io.BytesIO(raw_bytes), encoding=enc)
                    break
                except UnicodeDecodeError:
                    continue
            else:
                raise ValueError("Could not decode CSV with utf-8, latin-1, or cp1252 encoding.")
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Could not parse file: {exc}",
        )

    if df.empty:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The uploaded file has no data rows.",
        )

    # ── Auto-parse date columns ─────────────────────────────────────────────
    for col in df.columns:
        if df[col].dtype == object:
            try:
                converted = pd.to_datetime(df[col], errors="raise")
                df[col] = converted
            except Exception:
                pass  # Not a date column — keep as-is

    # ── Store session ───────────────────────────────────────────────────────
    session_id = str(uuid.uuid4())
    create_session(session_id, df, fname)

    # ── Build response ──────────────────────────────────────────────────────
    suggested = suggest_charts(df)

    return UploadResponse(
        session_id=session_id,
        filename=fname,
        rows=len(df),
        columns=df.columns.tolist(),
        suggested_charts=suggested,
    )
