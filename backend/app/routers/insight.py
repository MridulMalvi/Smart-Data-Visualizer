"""
Insight router — generates NL insight for the current chart view.

POST /api/insight/generate
  Body: InsightRequest {session_id, chart_type, x_column, y_column, stats}
  Returns: InsightResponse {insight, cached}

The endpoint first checks the session's insight cache (keyed by a hash
of the chart config + stats). On a cache miss it calls the NLG service
and caches the result.
"""
import hashlib
import json

from fastapi import APIRouter, HTTPException, Request, status

from app.store import get_session, cache_insight, get_cached_insight
from app.models.schemas import InsightRequest, InsightResponse
from app.services.nlg_service import NLGService

router = APIRouter()

# Fallback singleton — used when app.state.nlg is not populated
# (e.g. pytest TestClient that doesn't run the lifespan context).
_fallback_nlg: NLGService | None = None


def _get_nlg(request: Request) -> NLGService:
    """Return the app-state NLG service, or a lazily-created fallback."""
    global _fallback_nlg
    try:
        return request.app.state.nlg
    except AttributeError:
        if _fallback_nlg is None:
            _fallback_nlg = NLGService()
        return _fallback_nlg


def _make_cache_key(request: InsightRequest) -> str:
    """Stable hash of chart config + stats for cache lookup."""
    payload = {
        "chart_type": request.chart_type,
        "x_column": request.x_column,
        "y_column": request.y_column,
        "stats": request.stats,
    }
    raw = json.dumps(payload, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


@router.post("/generate", response_model=InsightResponse)
async def generate_insight(request: InsightRequest, http_request: Request):
    session = get_session(request.session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found or expired.")

    cache_key = _make_cache_key(request)

    # ── Check cache ─────────────────────────────────────────────────────────
    cached = get_cached_insight(request.session_id, cache_key)
    if cached:
        return InsightResponse(insight=cached, cached=True)

    # ── Generate ─────────────────────────────────────────────────────────────
    nlg = _get_nlg(http_request)
    stats = {**request.stats, "chart_type": request.chart_type, "x_col": request.x_column, "y_col": request.y_column}

    insight_text = nlg.generate_insight(stats)

    # ── Store in cache ───────────────────────────────────────────────────────
    cache_insight(request.session_id, cache_key, insight_text)

    return InsightResponse(insight=insight_text, cached=False)
