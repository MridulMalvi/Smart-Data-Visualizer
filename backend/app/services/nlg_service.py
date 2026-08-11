"""
Natural Language Generation (NLG) service.

Loads google/flan-t5-small once at module import time (called during
FastAPI lifespan startup). All subsequent calls reuse the cached pipeline.

Zero-cost guarantee:
  - flan-t5-small is ~300 MB, stored in HuggingFace cache (~/.cache/huggingface)
  - CPU inference only — no GPU, no API key, no billing
  - Model downloaded once on first run; subsequent runs are fully offline

Fallback:
  If the model fails to load (e.g. no internet on first run), the service
  falls back gracefully to a deterministic template-based insight renderer
  so the rest of the app is never blocked.
"""
from __future__ import annotations

import logging
import textwrap
from typing import Any, Optional

logger = logging.getLogger(__name__)


class NLGService:
    """
    Wraps a flan-t5-small text2text pipeline.  Constructed once at startup.
    """

    MODEL_NAME = "google/flan-t5-small"
    MAX_NEW_TOKENS = 120
    _pipeline = None
    _available = False

    def __init__(self):
        self._load_model()

    def _load_model(self) -> None:
        try:
            from transformers import pipeline as hf_pipeline
            logger.info("Loading NLG model: %s (this may take a moment on first run)…", self.MODEL_NAME)
            self._pipeline = hf_pipeline(
                "text2text-generation",
                model=self.MODEL_NAME,
                device=-1,          # CPU only
                max_new_tokens=self.MAX_NEW_TOKENS,
            )
            self._available = True
            logger.info("NLG model loaded successfully.")
        except Exception as exc:
            logger.warning(
                "NLG model could not be loaded (%s). "
                "Falling back to template-based insights.",
                exc,
            )
            self._available = False

    @property
    def is_available(self) -> bool:
        return self._available

    def generate_insight(self, stats: dict[str, Any]) -> str:
        """
        Generate a 2-3 sentence plain-English insight from chart statistics.

        Args:
            stats: dict containing keys like chart_type, x_col, y_col,
                   min, max, mean, std, correlation, trend_direction,
                   top_category, bottom_category, outlier_count, …

        Returns:
            Insight string (model-generated or template-based fallback).
        """
        if self._available and self._pipeline:
            try:
                prompt = self._build_prompt(stats)
                result = self._pipeline(prompt, do_sample=False)
                raw = result[0]["generated_text"].strip()
                return _clean_output(raw)
            except Exception as exc:
                logger.warning("NLG inference error (%s), using template fallback.", exc)

        return self._template_insight(stats)

    # ── Prompt engineering ────────────────────────────────────────────────────

    @staticmethod
    def _build_prompt(stats: dict[str, Any]) -> str:
        """
        Build a structured input prompt for flan-t5.
        flan-t5 responds best to imperative instruction + context pairs.
        """
        lines = ["Summarize this data chart in 2-3 sentences:"]

        chart_type = stats.get("chart_type", "chart")
        x_col = stats.get("x_col", "x")
        y_col = stats.get("y_col", None)

        lines.append(f"Chart: {chart_type} of {y_col or x_col}" + (f" by {x_col}" if y_col else ""))

        if "mean" in stats:
            lines.append(f"Mean: {stats['mean']}, Min: {stats.get('min')}, Max: {stats.get('max')}")
        if "correlation" in stats and stats["correlation"] is not None:
            lines.append(f"Correlation: {stats['correlation']}")
        if "trend_direction" in stats:
            lines.append(f"Trend: {stats['trend_direction']}")
        if "top_category" in stats:
            lines.append(f"Highest category: {stats['top_category']}")
        if "bottom_category" in stats:
            lines.append(f"Lowest category: {stats['bottom_category']}")
        if stats.get("outlier_count", 0):
            lines.append(f"Outliers detected: {stats['outlier_count']}")

        return "\n".join(lines)

    # ── Template fallback ─────────────────────────────────────────────────────

    @staticmethod
    def _template_insight(stats: dict[str, Any]) -> str:
        """
        Deterministic template-based insight — used when the model is unavailable.
        Produces readable, data-driven sentences without any AI.
        """
        chart_type = stats.get("chart_type", "chart")
        y_col = stats.get("y_col") or stats.get("x_col", "the column")
        x_col = stats.get("x_col", "the axis")

        sentences: list[str] = []

        # Sentence 1 — central tendency
        if "mean" in stats:
            sentences.append(
                f"The {chart_type} shows {y_col} with a mean of {stats['mean']:.2f}, "
                f"ranging from {stats.get('min', 'N/A')} to {stats.get('max', 'N/A')}."
            )

        # Sentence 2 — trend / category insight
        if "trend_direction" in stats:
            r2 = stats.get("trend_r2", 0)
            sentences.append(
                f"There is a {stats['trend_direction']} trend over {x_col}"
                + (f" (R²={r2:.2f})" if r2 else "") + "."
            )
        elif "top_category" in stats:
            sentences.append(
                f"The highest-performing category is '{stats['top_category']}', "
                f"while '{stats.get('bottom_category', 'N/A')}' is the lowest."
            )
        elif "correlation" in stats and stats["correlation"] is not None:
            corr = stats["correlation"]
            strength = "strong" if abs(corr) > 0.7 else "moderate" if abs(corr) > 0.4 else "weak"
            direction = "positive" if corr > 0 else "negative"
            sentences.append(
                f"There is a {strength} {direction} correlation ({corr:.2f}) "
                f"between {x_col} and {y_col}."
            )

        # Sentence 3 — outliers
        outliers = stats.get("outlier_count", 0)
        if outliers:
            sentences.append(
                f"{outliers} outlier{'s' if outliers != 1 else ''} "
                f"{'were' if outliers != 1 else 'was'} detected in the data "
                f"that may warrant further investigation."
            )

        if not sentences:
            sentences = [
                f"This {chart_type} visualizes {y_col}.",
                "Explore the chart interactively for deeper insights.",
            ]

        return " ".join(sentences)


# ── Output cleanup ────────────────────────────────────────────────────────────

def _clean_output(text: str) -> str:
    """Strip model artefacts and ensure reasonable length."""
    # Remove any leading/trailing whitespace
    text = text.strip()
    # Truncate to ~400 chars for display comfort
    if len(text) > 400:
        text = textwrap.shorten(text, width=400, placeholder="…")
    return text
