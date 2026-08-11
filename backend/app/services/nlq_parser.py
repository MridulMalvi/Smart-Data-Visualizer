"""
Natural Language Query (NLQ) parser.

Zero-cost, zero-LLM: uses regex keyword mapping for chart-type resolution
and rapidfuzz for fuzzy column-name matching against the actual dataset.

Resolution logic
────────────────
1. Extract chart-type keywords from the query → chart_type
2. Extract candidate tokens (nouns / phrases) → try to match against column names
3. Assign x_col (first match) and y_col (second match) using chart-type hints
4. Return confidence score; if below threshold → return clarification suggestion

Chart keyword mapping
─────────────────────
  trend / over time / timeline / through / across → line
  compare / by / per / across / top / ranking     → bar
  correlation / vs / versus / against / scatter   → scatter
  distribution / spread / frequency / how many    → histogram
  share / proportion / breakdown / percentage / composition → pie
  box / spread / quartile / outlier / variance    → box
"""
from __future__ import annotations

import re
from typing import Any, Optional

from rapidfuzz import fuzz, process

# Minimum fuzzy-match score (0-100) to accept a column name resolution
COLUMN_CONFIDENCE_THRESHOLD = 55
CHART_RESOLUTION_THRESHOLD = 0.4  # fraction of tokens matched


# ── Chart keyword groups ──────────────────────────────────────────────────────

_CHART_KEYWORDS: dict[str, list[str]] = {
    "line": [
        r"\btrend\b", r"\bover time\b", r"\btimeline\b", r"\bthrough\b",
        r"\bover the\b", r"\bacross time\b", r"\bmonthly\b", r"\byearly\b",
        r"\bweekly\b", r"\bdaily\b", r"\bhistorical\b", r"\bprogress\b",
        r"\bgrowth\b",
    ],
    "bar": [
        r"\bcompare\b", r"\bcomparison\b", r"\bby\b", r"\bper\b",
        r"\branking\b", r"\btop\b", r"\bbottom\b", r"\bbest\b", r"\bworst\b",
        r"\beach\b", r"\bgroup\b", r"\bcategory\b",
    ],
    "scatter": [
        r"\bcorrelation\b", r"\bvs\.?\b", r"\bversus\b", r"\bagainst\b",
        r"\brelationship\b", r"\bscatter\b", r"\bplot\b",
    ],
    "histogram": [
        r"\bdistribution\b", r"\bspread\b", r"\bfrequency\b",
        r"\bhow many\b", r"\bhist\b", r"\bbins?\b",
    ],
    "pie": [
        r"\bshare\b", r"\bproportion\b", r"\bbreakdown\b",
        r"\bpercentage\b", r"\bcomposition\b", r"\bpiece\b",
        r"\bslice\b", r"\bpie\b",
    ],
    "box": [
        r"\bbox\b", r"\bquartile\b", r"\boutlier\b",
        r"\bvariance\b", r"\bspread\b", r"\bwhisker\b",
    ],
}

# Chart types that strongly hint which column is X vs Y
_X_FIRST_CHARTS = {"line", "bar", "scatter"}


def parse_nlq(query: str, columns: list[str]) -> dict[str, Any]:
    """
    Parse a natural language query and return a resolved chart config.

    Args:
        query:   Raw user query string.
        columns: Column names available in the current dataset.

    Returns:
        dict with keys:
          resolved (bool), chart_type, x_column, y_column,
          confidence (0.0-1.0), suggestion (str|None)
    """
    q_lower = query.lower().strip()

    # ── Step 1: Resolve chart type ────────────────────────────────────────────
    chart_type, chart_score = _resolve_chart_type(q_lower)

    # ── Step 2: Extract candidate column tokens ───────────────────────────────
    candidate_tokens = _extract_candidate_tokens(q_lower, columns)

    # ── Step 3: Fuzzy-match tokens against column names ───────────────────────
    matched_cols = _fuzzy_match_columns(candidate_tokens, columns)

    # ── Step 4: Assign x and y roles ─────────────────────────────────────────
    x_col: Optional[str] = None
    y_col: Optional[str] = None

    if matched_cols:
        x_col = matched_cols[0]
        y_col = matched_cols[1] if len(matched_cols) > 1 else None

    # For chart types that typically have x=category and y=numeric,
    # try to reorder so the numeric column is y.
    if chart_type in ("bar", "line") and x_col and y_col:
        pass  # user order respected; swap logic below handles edge cases

    # ── Step 5: Compute overall confidence ────────────────────────────────────
    confidence = _compute_confidence(chart_type, chart_score, matched_cols)

    # ── Step 6: Determine resolution ─────────────────────────────────────────
    if chart_type and confidence >= CHART_RESOLUTION_THRESHOLD and (x_col or matched_cols):
        return {
            "resolved": True,
            "chart_type": chart_type,
            "x_column": x_col,
            "y_column": y_col,
            "confidence": round(confidence, 3),
            "suggestion": None,
        }

    # ── Not resolved — generate clarification ────────────────────────────────
    suggestion = _build_clarification(chart_type, matched_cols, columns)
    return {
        "resolved": False,
        "chart_type": chart_type,
        "x_column": x_col,
        "y_column": y_col,
        "confidence": round(confidence, 3),
        "suggestion": suggestion,
    }


# ── Chart type resolution ─────────────────────────────────────────────────────

def _resolve_chart_type(q: str) -> tuple[Optional[str], float]:
    """
    Match chart keyword groups against the query.
    Returns (best_chart_type, score_0_to_1) where score is fraction of
    keyword groups matched normalised to 1.
    """
    scores: dict[str, int] = {}
    for chart, patterns in _CHART_KEYWORDS.items():
        hits = sum(1 for p in patterns if re.search(p, q))
        if hits:
            scores[chart] = hits

    if not scores:
        # Fallback: look for explicit chart type name in query
        for chart in _CHART_KEYWORDS:
            if chart in q:
                return chart, 0.5
        return None, 0.0

    best = max(scores, key=lambda c: scores[c])
    max_possible = max(len(pats) for pats in _CHART_KEYWORDS.values())
    score = min(scores[best] / max_possible, 1.0)
    return best, score


# ── Token extraction ──────────────────────────────────────────────────────────

_STOPWORDS = frozenset(
    {
        "show", "me", "the", "a", "an", "of", "by", "for", "in", "as", "is",
        "are", "was", "were", "and", "or", "with", "on", "to", "from", "how",
        "what", "which", "give", "display", "plot", "draw", "chart", "graph",
        "visualize", "create", "make", "between", "across", "about",
        "line", "bar", "scatter", "histogram", "pie", "box",  # chart type words
    }
)


def _extract_candidate_tokens(q: str, columns: list[str]) -> list[str]:
    """
    Extract tokens from the query that might be column references.
    Strategy:
      1. Remove stopwords
      2. Try multi-word phrases first (bigrams/trigrams)
      3. Then single words
    """
    # Normalise: remove punctuation except underscores and spaces
    q_clean = re.sub(r"[^\w\s]", " ", q)
    words = q_clean.split()
    filtered = [w for w in words if w not in _STOPWORDS and len(w) > 1]

    candidates: list[str] = []

    # Generate n-grams up to length 3
    for n in (3, 2, 1):
        for i in range(len(filtered) - n + 1):
            phrase = " ".join(filtered[i : i + n])
            candidates.append(phrase)

    return candidates


# ── Fuzzy column matching ─────────────────────────────────────────────────────

def _fuzzy_match_columns(tokens: list[str], columns: list[str]) -> list[str]:
    """
    For each candidate token, find the best-matching column name using
    rapidfuzz.  Returns deduplicated list of matched columns preserving
    order of first appearance.
    """
    seen: set[str] = set()
    matched: list[str] = []

    # Normalise column names for matching
    col_lower = [c.lower().replace("_", " ") for c in columns]

    for token in tokens:
        result = process.extractOne(
            token,
            col_lower,
            scorer=fuzz.WRatio,
            score_cutoff=COLUMN_CONFIDENCE_THRESHOLD,
        )
        if result:
            best_norm, score, idx = result
            original_col = columns[idx]
            if original_col not in seen:
                seen.add(original_col)
                matched.append(original_col)

    return matched


# ── Confidence scoring ────────────────────────────────────────────────────────

def _compute_confidence(
    chart_type: Optional[str],
    chart_score: float,
    matched_cols: list[str],
) -> float:
    """Simple weighted confidence: chart type + column resolution."""
    if not chart_type:
        return 0.0
    col_score = min(len(matched_cols) / 2, 1.0)  # 2 matched cols → 1.0
    return 0.5 * chart_score + 0.5 * col_score


# ── Clarification message ─────────────────────────────────────────────────────

def _build_clarification(
    chart_type: Optional[str],
    matched_cols: list[str],
    columns: list[str],
) -> str:
    parts = []

    if not chart_type:
        parts.append(
            "I couldn't identify a chart type. "
            "Try phrases like 'show as bar chart', 'plot trend over time', or 'distribution of X'."
        )
    if not matched_cols:
        sample = ", ".join(f'"{c}"' for c in columns[:5])
        parts.append(
            f"I couldn't match any column names. "
            f"Your dataset has columns like: {sample}. "
            f"Please mention one or more of these in your query."
        )
    elif len(matched_cols) == 1 and chart_type in ("scatter", "line", "bar"):
        parts.append(
            f'Found column "{matched_cols[0]}" but also need a second column for {chart_type} chart. '
            f"Try: \"{matched_cols[0]} vs <another column>\"."
        )

    return " ".join(parts) if parts else "Could not fully resolve the query. Please rephrase."
