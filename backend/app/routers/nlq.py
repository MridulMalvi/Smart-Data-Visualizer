"""
NLQ router — resolves natural-language queries to chart configs.

POST /api/nlq/parse
  Body: {session_id, query}
  Returns: {resolved, chart_type, x_column, y_column, confidence, suggestion}
"""
from fastapi import APIRouter, HTTPException, status

from app.store import get_session
from app.services.nlq_parser import parse_nlq
from app.models.schemas import NLQRequest, NLQResponse

router = APIRouter()


@router.post("/parse", response_model=NLQResponse)
async def parse_natural_query(request: NLQRequest):
    session = get_session(request.session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found or expired.")

    columns = [c["name"] for c in session["columns"]]

    result = parse_nlq(query=request.query, columns=columns)

    return NLQResponse(**result)
