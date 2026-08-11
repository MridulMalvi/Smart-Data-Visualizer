"""
pytest configuration for Smart Data Visualizer backend tests.

Sets PYTHONPATH so `app` module resolves correctly when running:
    pytest tests/ -v
from the backend/ directory.
"""
import sys
import os

# Add the backend/ directory to sys.path so `from app.xxx import ...` works
sys.path.insert(0, os.path.dirname(__file__))
