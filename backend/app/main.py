"""
Smart Data Visualizer — FastAPI application entry point.

Model loading happens once during the lifespan context; all routers
are mounted here so import order is explicit and traceable.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import upload, preview, summary, chart, nlq, insight, export
from app.routers import filter as filter_router
from app.services.nlg_service import NLGService


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load heavy resources once at startup, release at shutdown."""
    # Load flan-t5-small onto app.state so every request can reach it
    # without re-instantiating the model pipeline.
    nlg = NLGService()
    app.state.nlg = nlg
    yield
    # Nothing expensive to release for an in-process model, but keeping
    # the pattern explicit for future GPU / connection cleanup.
    del app.state.nlg


app = FastAPI(
    title="Smart Data Visualizer API",
    description=(
        "Zero-cost AI/ML data-visualization backend. "
        "NLQ via rapidfuzz, NLG via flan-t5-small (CPU). "
        "No external API keys required."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite dev server
        "http://127.0.0.1:5173",
        "http://localhost:3000",   # fallback
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(upload.router,   prefix="/api/upload",  tags=["upload"])
app.include_router(preview.router,  prefix="/api/preview", tags=["preview"])
app.include_router(summary.router,  prefix="/api/summary", tags=["summary"])
app.include_router(filter_router.router,   prefix="/api/filter",  tags=["filter"])
app.include_router(chart.router,    prefix="/api/chart",   tags=["chart"])
app.include_router(nlq.router,      prefix="/api/nlq",     tags=["nlq"])
app.include_router(insight.router,  prefix="/api/insight", tags=["insight"])
app.include_router(export.router,   prefix="/api/export",  tags=["export"])


@app.get("/", tags=["health"])
async def root():
    return {"status": "ok", "service": "Smart Data Visualizer API"}


@app.get("/health", tags=["health"])
async def health():
    return {"status": "healthy"}
