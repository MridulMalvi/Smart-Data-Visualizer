"""
pytest suite for Smart Data Visualizer API.

Covers: upload, preview, summary, filter, chart, NLQ, insight, export.

Run with:
    cd backend
    pytest tests/ -v
"""
import io
import json
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

# ── Shared fixture: minimal CSV payload ───────────────────────────────────────

SAMPLE_CSV = b"""name,sales,month,category
Alice,120,2024-01,A
Bob,340,2024-02,B
Charlie,90,2024-03,A
Diana,500,2024-04,C
Eve,210,2024-05,B
Frank,80,2024-06,A
"""


def _upload_csv(csv_bytes: bytes = SAMPLE_CSV) -> str:
    """Helper: upload a CSV and return session_id."""
    resp = client.post(
        "/api/upload/",
        files={"file": ("test.csv", io.BytesIO(csv_bytes), "text/csv")},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["session_id"]


# ── Upload ────────────────────────────────────────────────────────────────────

class TestUpload:
    def test_upload_valid_csv(self):
        resp = client.post(
            "/api/upload/",
            files={"file": ("data.csv", io.BytesIO(SAMPLE_CSV), "text/csv")},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "session_id" in data
        assert data["rows"] == 6
        assert "sales" in data["columns"]

    def test_upload_empty_file(self):
        resp = client.post(
            "/api/upload/",
            files={"file": ("empty.csv", io.BytesIO(b""), "text/csv")},
        )
        assert resp.status_code == 400

    def test_upload_no_data_rows(self):
        resp = client.post(
            "/api/upload/",
            files={"file": ("header_only.csv", io.BytesIO(b"col1,col2\n"), "text/csv")},
        )
        assert resp.status_code == 422

    def test_suggested_charts_returned(self):
        resp = client.post(
            "/api/upload/",
            files={"file": ("data.csv", io.BytesIO(SAMPLE_CSV), "text/csv")},
        )
        assert resp.status_code == 200
        assert isinstance(resp.json()["suggested_charts"], list)


# ── Preview ───────────────────────────────────────────────────────────────────

class TestPreview:
    def test_preview_default(self):
        sid = _upload_csv()
        resp = client.get(f"/api/preview/{sid}")
        assert resp.status_code == 200
        data = resp.json()
        assert "rows" in data
        assert len(data["rows"]) <= 10

    def test_preview_invalid_session(self):
        resp = client.get("/api/preview/nonexistent-session-id")
        assert resp.status_code == 404

    def test_preview_row_limit(self):
        sid = _upload_csv()
        resp = client.get(f"/api/preview/{sid}?rows=3")
        assert len(resp.json()["rows"]) <= 3


# ── Summary ───────────────────────────────────────────────────────────────────

class TestSummary:
    def test_summary_structure(self):
        sid = _upload_csv()
        resp = client.get(f"/api/summary/{sid}")
        assert resp.status_code == 200
        data = resp.json()
        assert "column_meta" in data
        assert "missing_counts" in data
        assert "describe_stats" in data
        assert data["row_count"] == 6

    def test_summary_missing_counts(self):
        csv_with_missing = b"a,b\n1,\n2,3\n,4\n"
        sid = _upload_csv(csv_with_missing)
        resp = client.get(f"/api/summary/{sid}")
        data = resp.json()
        assert "a" in data["missing_counts"] or "b" in data["missing_counts"]


# ── Filter ────────────────────────────────────────────────────────────────────

class TestFilter:
    def test_filter_numeric_gt(self):
        sid = _upload_csv()
        resp = client.post(
            "/api/filter/apply",
            json={
                "session_id": sid,
                "rules": [{"column": "sales", "operator": ">", "value": 200}],
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["rows_after"] < data["rows_before"]

    def test_filter_string_contains(self):
        sid = _upload_csv()
        resp = client.post(
            "/api/filter/apply",
            json={
                "session_id": sid,
                "rules": [{"column": "name", "operator": "contains", "value": "ali"}],
            },
        )
        assert resp.status_code == 200
        assert resp.json()["rows_after"] >= 1

    def test_filter_reset(self):
        sid = _upload_csv()
        # Apply a very restrictive filter
        client.post(
            "/api/filter/apply",
            json={
                "session_id": sid,
                "rules": [{"column": "sales", "operator": ">", "value": 9999}],
            },
        )
        # Reset
        resp = client.post("/api/filter/reset", json={"session_id": sid})
        assert resp.status_code == 200
        assert resp.json()["rows_after"] == 6

    def test_filter_empty_rules_resets(self):
        sid = _upload_csv()
        resp = client.post(
            "/api/filter/apply",
            json={"session_id": sid, "rules": []},
        )
        assert resp.status_code == 200
        assert resp.json()["rows_after"] == 6


# ── Chart ─────────────────────────────────────────────────────────────────────

class TestChart:
    def test_bar_chart(self):
        sid = _upload_csv()
        resp = client.post(
            "/api/chart/data",
            json={
                "session_id": sid,
                "chart_type": "bar",
                "x_column": "category",
                "y_column": "sales",
                "use_filtered": False,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["chart_type"] == "bar"
        assert isinstance(data["data"], list)

    def test_histogram_chart(self):
        sid = _upload_csv()
        resp = client.post(
            "/api/chart/data",
            json={
                "session_id": sid,
                "chart_type": "histogram",
                "x_column": "sales",
                "bins": 5,
                "use_filtered": False,
            },
        )
        assert resp.status_code == 200
        assert len(resp.json()["data"]) <= 5

    def test_pie_chart(self):
        sid = _upload_csv()
        resp = client.post(
            "/api/chart/data",
            json={
                "session_id": sid,
                "chart_type": "pie",
                "x_column": "category",
                "y_column": "sales",
                "use_filtered": False,
            },
        )
        assert resp.status_code == 200
        recs = resp.json()["data"]
        assert all("name" in r and "value" in r for r in recs)

    def test_scatter_with_trendline(self):
        sid = _upload_csv()
        resp = client.post(
            "/api/chart/data",
            json={
                "session_id": sid,
                "chart_type": "scatter",
                "x_column": "sales",
                "y_column": "sales",
                "use_filtered": False,
            },
        )
        assert resp.status_code == 200

    def test_invalid_column(self):
        sid = _upload_csv()
        resp = client.post(
            "/api/chart/data",
            json={
                "session_id": sid,
                "chart_type": "bar",
                "x_column": "nonexistent_column",
                "use_filtered": False,
            },
        )
        assert resp.status_code == 422

    def test_outlier_info_present(self):
        sid = _upload_csv()
        resp = client.post(
            "/api/chart/data",
            json={
                "session_id": sid,
                "chart_type": "bar",
                "x_column": "category",
                "y_column": "sales",
                "use_filtered": False,
            },
        )
        assert resp.status_code == 200
        # Outlier info should be present (even if count=0)
        assert resp.json()["outliers"] is not None


# ── NLQ ───────────────────────────────────────────────────────────────────────

class TestNLQ:
    def test_nlq_bar_chart_resolution(self):
        sid = _upload_csv()
        resp = client.post(
            "/api/nlq/parse",
            json={"session_id": sid, "query": "show sales by category as a bar chart"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["chart_type"] == "bar"
        assert data["x_column"] is not None

    def test_nlq_trend_resolves_line(self):
        sid = _upload_csv()
        resp = client.post(
            "/api/nlq/parse",
            json={"session_id": sid, "query": "show sales trend over month"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["chart_type"] == "line"

    def test_nlq_distribution_resolves_histogram(self):
        sid = _upload_csv()
        resp = client.post(
            "/api/nlq/parse",
            json={"session_id": sid, "query": "distribution of sales"},
        )
        assert resp.status_code == 200
        assert resp.json()["chart_type"] == "histogram"

    def test_nlq_unresolvable_returns_suggestion(self):
        sid = _upload_csv()
        resp = client.post(
            "/api/nlq/parse",
            json={"session_id": sid, "query": "xyz abc 123 qwerty"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["resolved"] is False
        assert data["suggestion"] is not None

    def test_nlq_fuzzy_column_match(self):
        """rapidfuzz should match 'Sale' → 'sales' column."""
        sid = _upload_csv()
        resp = client.post(
            "/api/nlq/parse",
            json={"session_id": sid, "query": "show Sale by categori as bar"},
        )
        assert resp.status_code == 200
        data = resp.json()
        # Should resolve sales and category via fuzzy match
        assert "sales" in (data.get("x_column", "") or "") or "sales" in (data.get("y_column", "") or "")


# ── Insight ───────────────────────────────────────────────────────────────────

class TestInsight:
    def test_insight_returns_string(self):
        sid = _upload_csv()
        resp = client.post(
            "/api/insight/generate",
            json={
                "session_id": sid,
                "chart_type": "bar",
                "x_column": "category",
                "y_column": "sales",
                "stats": {"mean": 223.3, "min": 80, "max": 500, "outlier_count": 0},
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data["insight"], str)
        assert len(data["insight"]) > 10

    def test_insight_caching(self):
        sid = _upload_csv()
        payload = {
            "session_id": sid,
            "chart_type": "bar",
            "x_column": "category",
            "y_column": "sales",
            "stats": {"mean": 223.3, "min": 80, "max": 500, "outlier_count": 0},
        }
        resp1 = client.post("/api/insight/generate", json=payload)
        resp2 = client.post("/api/insight/generate", json=payload)
        assert resp1.status_code == 200
        assert resp2.status_code == 200
        assert resp2.json()["cached"] is True


# ── Export ────────────────────────────────────────────────────────────────────

class TestExport:
    def test_export_csv(self):
        sid = _upload_csv()
        resp = client.get(f"/api/export/csv/{sid}?use_filtered=false")
        assert resp.status_code == 200
        assert "text/csv" in resp.headers["content-type"]
        lines = resp.text.strip().split("\n")
        assert len(lines) == 7  # header + 6 data rows

    def test_export_filtered_csv(self):
        sid = _upload_csv()
        # Filter first
        client.post(
            "/api/filter/apply",
            json={
                "session_id": sid,
                "rules": [{"column": "sales", "operator": ">", "value": 200}],
            },
        )
        resp = client.get(f"/api/export/csv/{sid}?use_filtered=true")
        assert resp.status_code == 200
        lines = resp.text.strip().split("\n")
        assert len(lines) < 7  # fewer rows than full dataset
