"""
In-memory session store.

Each session holds:
  original_df   — the DataFrame as uploaded (never mutated after upload)
  filtered_df   — the DataFrame after the current filter state is applied
  columns       — column metadata (dtype, sample values)
  cached_insights — dict mapping config-hash → insight string
  created_at    — datetime for TTL cleanup
  filename      — original filename for display
"""
import time
import threading
from typing import Any

import pandas as pd

# TTL: 1 hour in seconds
SESSION_TTL = 3600

_store: dict[str, dict[str, Any]] = {}
_lock = threading.Lock()


def create_session(session_id: str, df: pd.DataFrame, filename: str) -> None:
    """Store a new upload session."""
    with _lock:
        _store[session_id] = {
            "original_df": df.copy(),
            "filtered_df": df.copy(),
            "columns": _extract_column_meta(df),
            "cached_insights": {},
            "created_at": time.time(),
            "filename": filename,
        }


def get_session(session_id: str) -> dict[str, Any] | None:
    """Return session data or None if expired / not found."""
    _evict_expired()
    with _lock:
        return _store.get(session_id)


def update_filtered_df(session_id: str, df: pd.DataFrame) -> None:
    with _lock:
        if session_id in _store:
            _store[session_id]["filtered_df"] = df.copy()


def cache_insight(session_id: str, key: str, insight: str) -> None:
    with _lock:
        if session_id in _store:
            _store[session_id]["cached_insights"][key] = insight


def get_cached_insight(session_id: str, key: str) -> str | None:
    with _lock:
        sess = _store.get(session_id)
        if sess:
            return sess["cached_insights"].get(key)
    return None


def delete_session(session_id: str) -> None:
    with _lock:
        _store.pop(session_id, None)


def _evict_expired() -> None:
    """Remove sessions older than SESSION_TTL."""
    now = time.time()
    with _lock:
        expired = [sid for sid, s in _store.items() if now - s["created_at"] > SESSION_TTL]
        for sid in expired:
            del _store[sid]


def _extract_column_meta(df: pd.DataFrame) -> list[dict]:
    meta = []
    for col in df.columns:
        dtype = str(df[col].dtype)
        sample = df[col].dropna().head(3).tolist()
        meta.append({"name": col, "dtype": dtype, "sample": sample})
    return meta
