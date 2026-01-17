"""
E2E Test Configuration.

Automatically marks all tests in this directory with @pytest.mark.e2e
so they can be skipped with `-m "not e2e"` in CI.
"""

import pytest


def pytest_collection_modifyitems(items):
    """Add e2e marker to all tests in this package."""
    for item in items:
        # Check if test is in the e2e directory
        if "/tests/e2e/" in str(item.fspath):
            item.add_marker(pytest.mark.e2e)
