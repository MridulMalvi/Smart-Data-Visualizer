"""
Data processing service — all Pandas / NumPy / SciPy / sklearn operations.

Everything here is pure computation; no FastAPI or HTTP concerns.
"""
from __future__ import annotations

import hashlib
import json
from typing import Any, Literal, Optional

import numpy as np
import pandas as pd
from scipy import stats as scipy_stats
from sklearn.linear_model import LinearRegression


# ── Chart type auto-suggestion ────────────────────────────────────────────────

def suggest_charts(df: pd.DataFrame) -> list[dict]:
    """
    Return a list of suggested chart configs based on column dtype combos.
    Rules:
      datetime + numeric  → line
      categorical + numeric → bar
      two numerics          → scatter
      single numeric        → histogram
      low-cardinality cat   → pie  (≤12 unique values)
    """
    suggestions = []
    cols = df.columns.tolist()
    numeric_cols = df.select_dtypes(include="number").columns.tolist()
    cat_cols = df.select_dtypes(include=["object", "str", "category", "bool"]).columns.tolist()
    dt_cols = df.select_dtypes(include=["datetime", "datetimetz"]).columns.tolist()

    # Datetime + numeric → line
    for dt_col in dt_cols:
        for num_col in numeric_cols:
            suggestions.append(
                {
                    "chart_type": "line",
                    "x_column": dt_col,
                    "y_column": num_col,
                    "label": f"Trend of {num_col} over {dt_col}",
                }
            )

    # Categorical + numeric → bar / pie
    for cat_col in cat_cols:
        n_unique = df[cat_col].nunique()
        for num_col in numeric_cols:
            suggestions.append(
                {
                    "chart_type": "bar",
                    "x_column": cat_col,
                    "y_column": num_col,
                    "label": f"{num_col} by {cat_col}",
                }
            )
            if n_unique <= 12:
                suggestions.append(
                    {
                        "chart_type": "pie",
                        "x_column": cat_col,
                        "y_column": num_col,
                        "label": f"Share of {num_col} by {cat_col}",
                    }
                )

    # Two numerics → scatter
    for i, a in enumerate(numeric_cols):
        for b in numeric_cols[i + 1 :]:
            suggestions.append(
                {
                    "chart_type": "scatter",
                    "x_column": a,
                    "y_column": b,
                    "label": f"{a} vs {b}",
                }
            )

    # Single numeric → histogram / box
    for num_col in numeric_cols:
        suggestions.append(
            {
                "chart_type": "histogram",
                "x_column": num_col,
                "y_column": None,
                "label": f"Distribution of {num_col}",
            }
        )
        suggestions.append(
            {
                "chart_type": "box",
                "x_column": num_col,
                "y_column": None,
                "label": f"Spread of {num_col}",
            }
        )

    return suggestions[:20]  # cap at 20 suggestions


# ── Summary stats ─────────────────────────────────────────────────────────────

def compute_summary(df: pd.DataFrame) -> dict[str, Any]:
    """Return dtype info, missing counts, and describe() stats."""
    missing = df.isnull().sum().to_dict()
    missing = {k: int(v) for k, v in missing.items()}

    # describe() on numeric only; convert to plain Python types
    num_df = df.select_dtypes(include="number")
    if not num_df.empty:
        desc = num_df.describe().round(4).to_dict()
        desc = {
            col: {k: _safe_scalar(v) for k, v in stats.items()}
            for col, stats in desc.items()
        }
    else:
        desc = {}

    col_meta = []
    for col in df.columns:
        dtype = str(df[col].dtype)
        sample = df[col].dropna().head(3).tolist()
        col_meta.append({"name": col, "dtype": dtype, "sample": [_safe_scalar(s) for s in sample]})

    return {
        "column_meta": col_meta,
        "missing_counts": missing,
        "describe_stats": desc,
        "row_count": len(df),
        "col_count": len(df.columns),
    }


# ── Filtering ─────────────────────────────────────────────────────────────────

def apply_filter(df: pd.DataFrame, rules: list[dict]) -> pd.DataFrame:
    """
    Apply a list of filter rules to df.
    Each rule: {column, operator, value}
    Supported operators: ==, !=, >, >=, <, <=, contains
    """
    mask = pd.Series([True] * len(df), index=df.index)
    for rule in rules:
        col = rule["column"]
        op = rule["operator"]
        val = rule["value"]
        if col not in df.columns:
            continue
        series = df[col]
        if op == "==":
            mask &= series == _coerce(series, val)
        elif op == "!=":
            mask &= series != _coerce(series, val)
        elif op == ">":
            mask &= pd.to_numeric(series, errors="coerce") > float(val)
        elif op == ">=":
            mask &= pd.to_numeric(series, errors="coerce") >= float(val)
        elif op == "<":
            mask &= pd.to_numeric(series, errors="coerce") < float(val)
        elif op == "<=":
            mask &= pd.to_numeric(series, errors="coerce") <= float(val)
        elif op == "contains":
            mask &= series.astype(str).str.contains(str(val), case=False, na=False)
    return df[mask].reset_index(drop=True)


def _coerce(series: pd.Series, val: Any) -> Any:
    """Try to coerce value to match the series dtype."""
    if pd.api.types.is_numeric_dtype(series):
        try:
            return float(val)
        except (ValueError, TypeError):
            return val
    return val


# ── Chart data ────────────────────────────────────────────────────────────────

def get_chart_data(
    df: pd.DataFrame,
    chart_type: str,
    x_col: str,
    y_col: Optional[str],
    bins: int = 20,
) -> tuple[list[dict], dict[str, Any]]:
    """
    Aggregate data for the requested chart type.
    Returns (records_list, stats_dict).
    """
    if chart_type == "line":
        return _line_data(df, x_col, y_col)
    elif chart_type == "bar":
        return _bar_data(df, x_col, y_col)
    elif chart_type == "scatter":
        return _scatter_data(df, x_col, y_col)
    elif chart_type == "histogram":
        return _histogram_data(df, x_col, bins)
    elif chart_type == "pie":
        return _pie_data(df, x_col, y_col)
    elif chart_type == "box":
        return _box_data(df, x_col, y_col)
    return [], {}


def _line_data(df: pd.DataFrame, x_col: str, y_col: Optional[str]):
    if y_col and y_col in df.columns:
        # Coerce y to numeric — prevents 'str dtype does not support mean' on Pandas 3.0
        d = df[[x_col, y_col]].copy()
        d[y_col] = pd.to_numeric(d[y_col], errors="coerce")
        d = d.dropna()
    else:
        d = df[[x_col]].dropna().copy()

    # Bug 12 fix: keep x numeric if it is numeric — casting to string makes trendline
    # overlay points (which use float x-values) incompatible with the chart's X-axis.
    # Only cast to string for non-numeric / datetime columns.
    x_numeric = pd.api.types.is_numeric_dtype(df[x_col])
    if not x_numeric:
        d[x_col] = d[x_col].astype(str)

    renamed = d.rename(columns={x_col: "x", **({y_col: "y"} if y_col else {})})
    records = [{k: _safe_scalar(v) for k, v in row.items()} for row in renamed.to_dict("records")]
    stats = _numeric_stats(d[y_col] if y_col else pd.to_numeric(d[x_col], errors="coerce"))
    return records, stats


def _bar_data(df: pd.DataFrame, x_col: str, y_col: Optional[str]):
    if y_col:
        # Coerce y to numeric before groupby mean — Pandas 3.0 string dtypes disallow mean()
        tmp = df[[x_col, y_col]].copy()
        tmp[y_col] = pd.to_numeric(tmp[y_col], errors="coerce")
        tmp = tmp.dropna(subset=[y_col])
        grp = tmp.groupby(x_col)[y_col].mean().reset_index()
        grp.columns = ["x", "y"]
        grp["x"] = grp["x"].astype(str)
        grp = grp.nlargest(30, "y")
        records = [{"x": str(r["x"]), "y": _safe_scalar(r["y"])} for r in grp.to_dict("records")]
        stats = _numeric_stats(tmp[y_col])
    else:
        vc = df[x_col].value_counts().head(30).reset_index()
        vc.columns = ["x", "y"]
        vc["x"] = vc["x"].astype(str)
        records = [{"x": str(r["x"]), "y": _safe_scalar(r["y"])} for r in vc.to_dict("records")]
        stats = {}
    return records, stats


def _scatter_data(df: pd.DataFrame, x_col: str, y_col: Optional[str]):
    if not y_col:
        return [], {}
    # If same column used for both axes, create a temp copy to avoid duplicate-column issues
    if x_col == y_col:
        d = pd.DataFrame({"x": pd.to_numeric(df[x_col], errors="coerce"),
                          "y": pd.to_numeric(df[x_col], errors="coerce")}).dropna()
        records = d.to_dict("records")
        records = [{"x": _safe_scalar(r["x"]), "y": _safe_scalar(r["y"])} for r in records]
        stats = {**_numeric_stats(df[x_col]), "correlation": 1.0}
        return records, stats

    d = df[[x_col, y_col]].dropna().copy()
    # Convert to numeric where possible
    d[x_col] = pd.to_numeric(d[x_col], errors="coerce")
    d[y_col] = pd.to_numeric(d[y_col], errors="coerce")
    d = d.dropna()
    # Use to_dict for safe scalar conversion, then rename keys
    raw = d.rename(columns={x_col: "x", y_col: "y"}).to_dict("records")
    records = [{"x": _safe_scalar(r["x"]), "y": _safe_scalar(r["y"])} for r in raw]
    try:
        corr = float(d[x_col].corr(d[y_col]))
        if corr != corr:  # NaN check without pd.isna
            corr = 0.0
    except Exception:
        corr = 0.0
    stats = {**_numeric_stats(d[y_col]), "correlation": round(corr, 4)}
    return records, stats


def _histogram_data(df: pd.DataFrame, x_col: str, bins: int):
    series = pd.to_numeric(df[x_col], errors="coerce").dropna()
    counts, edges = np.histogram(series, bins=bins)
    records = [
        {"x": round(float(edges[i]), 4), "x_end": round(float(edges[i + 1]), 4), "y": int(counts[i])}
        for i in range(len(counts))
    ]
    return records, _numeric_stats(series)


def _pie_data(df: pd.DataFrame, x_col: str, y_col: Optional[str]):
    if y_col:
        # Coerce y to numeric before sum — Pandas 3.0 string dtypes disallow sum()
        tmp = df[[x_col, y_col]].copy()
        tmp[y_col] = pd.to_numeric(tmp[y_col], errors="coerce")
        tmp = tmp.dropna(subset=[y_col])
        grp = tmp.groupby(x_col)[y_col].sum().reset_index()
        grp.columns = ["name", "value"]
    else:
        grp = df[x_col].value_counts().head(12).reset_index()
        grp.columns = ["name", "value"]
    grp["name"] = grp["name"].astype(str)
    records = [{"name": r["name"], "value": _safe_scalar(r["value"])} for r in grp.to_dict("records")]
    return records, {}


def _box_data(df: pd.DataFrame, x_col: str, y_col: Optional[str]):
    """
    Return box-plot stats: min, q1, median, q3, max per group (or overall).
    Recharts BoxPlot uses a ComposedChart; we return the five-number summary.
    """
    def five_num(series: pd.Series):
        s = pd.to_numeric(series, errors="coerce").dropna()
        if s.empty:
            return None
        return {
            "min": _safe_scalar(s.min()),
            "q1": _safe_scalar(s.quantile(0.25)),
            "median": _safe_scalar(s.median()),
            "q3": _safe_scalar(s.quantile(0.75)),
            "max": _safe_scalar(s.max()),
        }

    if y_col and x_col in df.columns:
        records = []
        for grp_key, sub in df.groupby(x_col):
            fn = five_num(sub[y_col])
            if fn:
                records.append({"group": str(grp_key), **fn})
    else:
        fn = five_num(df[x_col])
        records = [{"group": x_col, **fn}] if fn else []

    stats = _numeric_stats(pd.to_numeric(df[y_col if y_col else x_col], errors="coerce"))
    return records, stats


# ── Outlier detection ─────────────────────────────────────────────────────────

def detect_outliers(
    df: pd.DataFrame,
    column: str,
    method: Literal["iqr", "zscore"] = "iqr",
) -> dict[str, Any]:
    """Detect outliers and return count + row indices (0-based)."""
    series = pd.to_numeric(df[column], errors="coerce")

    if method == "iqr":
        q1, q3 = series.quantile(0.25), series.quantile(0.75)
        iqr = q3 - q1
        mask = (series < q1 - 1.5 * iqr) | (series > q3 + 1.5 * iqr)
    else:  # zscore
        z = np.abs(scipy_stats.zscore(series.dropna()))
        outlier_idx = series.dropna().index[z > 3]
        mask = series.index.isin(outlier_idx)

    row_indices = [int(i) for i in df.index[mask]]
    return {
        "count": int(mask.sum()),
        "method": method,
        "row_indices": row_indices,
    }


# ── Trendline ─────────────────────────────────────────────────────────────────

def fit_trendline(
    df: pd.DataFrame,
    x_col: str,
    y_col: str,
    n_points: int = 50,
) -> Optional[dict[str, Any]]:
    """
    Fit a linear regression trendline using numpy polyfit.
    Returns slope, intercept, r², and evenly spaced overlay points.
    """
    x_raw = pd.to_numeric(df[x_col], errors="coerce")
    y_raw = pd.to_numeric(df[y_col], errors="coerce")
    valid = x_raw.notna() & y_raw.notna()
    x, y = x_raw[valid].values, y_raw[valid].values

    if len(x) < 2:
        return None

    try:
        coeffs = np.polyfit(x, y, 1)
        slope, intercept = float(coeffs[0]), float(coeffs[1])
        y_pred = np.polyval(coeffs, x)
        ss_res = float(np.sum((y - y_pred) ** 2))
        ss_tot = float(np.sum((y - y.mean()) ** 2))
        r2 = 1 - ss_res / ss_tot if ss_tot != 0 else 0.0

        x_range = np.linspace(x.min(), x.max(), n_points)
        y_range = np.polyval(coeffs, x_range)
        points = [{"x": round(float(xi), 4), "trend": round(float(yi), 4)} for xi, yi in zip(x_range, y_range)]

        return {
            "slope": round(slope, 6),
            "intercept": round(intercept, 6),
            "r_squared": round(r2, 4),
            "points": points,
        }
    except Exception:
        return None


# ── Chart-level stats for NLG ─────────────────────────────────────────────────

def compute_chart_stats(
    df: pd.DataFrame,
    chart_type: str,
    x_col: str,
    y_col: Optional[str],
) -> dict[str, Any]:
    """
    Compute high-level statistics to feed into the NLG prompt.
    Returns a flat dict of stat names → values.
    """
    stats: dict[str, Any] = {"chart_type": chart_type, "x_col": x_col, "y_col": y_col}

    if y_col and y_col in df.columns:
        num_series = pd.to_numeric(df[y_col], errors="coerce").dropna()
        stats.update(_numeric_stats(num_series))

        if chart_type in ("line", "scatter") and x_col in df.columns:
            corr = pd.to_numeric(df[x_col], errors="coerce").corr(num_series)
            stats["correlation"] = round(float(corr), 4) if not np.isnan(corr) else None
            # Trend direction
            if chart_type == "line":
                tl = fit_trendline(df, x_col, y_col)
                if tl:
                    stats["trend_direction"] = "upward" if tl["slope"] > 0 else "downward"
                    stats["trend_r2"] = tl["r_squared"]

        if chart_type in ("bar", "pie"):
            # Bug 9 fix: use DataFrame.groupby instead of Series.groupby to avoid
            # deprecation warnings and edge-case failures with external groupers.
            try:
                tmp = df[[x_col, y_col]].copy()
                tmp[y_col] = pd.to_numeric(tmp[y_col], errors="coerce")
                grp = tmp.groupby(x_col, dropna=True)[y_col].mean()
                if not grp.empty:
                    stats["top_category"] = str(grp.idxmax())
                    stats["bottom_category"] = str(grp.idxmin())
            except Exception:
                pass  # Non-fatal; category stats are supplemental

    elif x_col in df.columns:
        num_series = pd.to_numeric(df[x_col], errors="coerce").dropna()
        stats.update(_numeric_stats(num_series))

    # Bug 1 fix: only run outlier detection on numeric columns to prevent
    # crashes / misleading results when x or y is categorical / string.
    target_for_outliers = y_col or x_col
    if target_for_outliers and pd.api.types.is_numeric_dtype(
        pd.to_numeric(df[target_for_outliers], errors="coerce")
    ):
        try:
            outlier_info = detect_outliers(df, target_for_outliers)
            stats["outlier_count"] = outlier_info["count"]
        except Exception:
            stats["outlier_count"] = 0
    else:
        stats["outlier_count"] = 0

    return stats


# ── Helpers ───────────────────────────────────────────────────────────────────

def _numeric_stats(series: pd.Series) -> dict[str, Any]:
    s = pd.to_numeric(series, errors="coerce").dropna()
    if s.empty:
        return {}
    return {
        "min": _safe_scalar(s.min()),
        "max": _safe_scalar(s.max()),
        "mean": round(float(s.mean()), 4),
        "std": round(float(s.std()), 4),
        "median": _safe_scalar(s.median()),
    }


def _safe_scalar(v: Any) -> Any:
    """Convert numpy/pandas scalars to plain Python types for JSON serialisation."""
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        return float(v)
    if isinstance(v, (np.bool_,)):
        return bool(v)
    # Guard: never call pd.isna on a non-scalar (e.g. pd.Series)
    if isinstance(v, (pd.Series, pd.DataFrame, np.ndarray, list, dict)):
        return v
    try:
        if pd.isna(v):
            return None
    except (TypeError, ValueError):
        pass
    return v


def df_to_json_records(df: pd.DataFrame) -> list[dict]:
    """Convert DataFrame to JSON-serialisable list of dicts."""
    return [
        {k: _safe_scalar(v) for k, v in row.items()}
        for row in df.to_dict("records")
    ]
