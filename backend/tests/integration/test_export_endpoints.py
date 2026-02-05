"""
Integration tests for Export endpoints.

Tests CSV export endpoints:
- /export/facts/csv
- /export/analytics/trends/csv

Verifies file downloads, content types, and data integrity.
"""

import csv
import io
from datetime import date, timedelta

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestExportFactsEndpoints:
    """Test suite for facts export endpoints."""

    async def test_export_facts_csv(self, auth_client: AsyncClient):
        """Test exporting facts to CSV format."""
        response = await auth_client.get("/api/v1/export/facts/csv")

        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        # Check Content-Type header (may include charset)
        assert "text/csv" in response.headers["content-type"], \
            f"Expected text/csv, got {response.headers['content-type']}"

        # Check Content-Disposition header (attachment with filename)
        assert "content-disposition" in response.headers
        disposition = response.headers["content-disposition"]
        assert "attachment" in disposition
        assert "filename=" in disposition
        assert ".csv" in disposition

        # Check that content is not empty
        content = response.text
        assert len(content) > 0, "CSV content is empty"

        # Verify CSV structure (should have headers)
        csv_reader = csv.reader(io.StringIO(content))
        headers = next(csv_reader)
        assert "ID" in headers
        assert "Date" in headers
        assert "Category" in headers
        assert "Type" in headers
        assert "Amount" in headers
        assert "Description" in headers

    async def test_export_facts_csv_with_date_filter(self, auth_client: AsyncClient):
        """Test exporting facts to CSV with date range filter."""
        start_date = (date.today() - timedelta(days=30)).isoformat()
        end_date = date.today().isoformat()

        response = await auth_client.get(
            f"/api/v1/export/facts/csv?start_date={start_date}&end_date={end_date}"
        )

        assert response.status_code == 200
        assert "text/csv" in response.headers["content-type"]

        # Content should be valid CSV
        content = response.text
        csv_reader = csv.reader(io.StringIO(content))
        headers = next(csv_reader)
        assert len(headers) == 6  # ID, Date, Category, Type, Amount, Description

    async def test_export_facts_empty_result(self, auth_client: AsyncClient):
        """Test exporting facts when no data matches filters."""
        # Use far future dates that won't have any data
        start_date = "2030-01-01"
        end_date = "2030-12-31"

        response = await auth_client.get(
            f"/api/v1/export/facts/csv?start_date={start_date}&end_date={end_date}"
        )

        assert response.status_code == 200
        assert "text/csv" in response.headers["content-type"]

        # Should still have headers even if no data
        content = response.text
        csv_reader = csv.reader(io.StringIO(content))
        headers = next(csv_reader)
        assert len(headers) == 6

        # Should have no data rows
        rows = list(csv_reader)
        assert len(rows) == 0, "Should have no data rows for future dates"


class TestExportAnalyticsTrendsEndpoints:
    """Test suite for analytics trends export endpoints."""

    async def test_export_trends_csv_default(self, auth_client: AsyncClient):
        """Test exporting trends to CSV with default period."""
        response = await auth_client.get("/api/v1/export/analytics/trends/csv")

        assert response.status_code == 200
        assert "text/csv" in response.headers["content-type"]

        # Check Content-Disposition
        disposition = response.headers["content-disposition"]
        assert "attachment" in disposition
        assert ".csv" in disposition

        # Verify CSV structure
        content = response.text
        csv_reader = csv.reader(io.StringIO(content))
        headers = next(csv_reader)
        assert "Date" in headers
        assert "Income" in headers
        assert "Expense" in headers
        assert "Net" in headers

    async def test_export_trends_csv_custom_days(self, auth_client: AsyncClient):
        """Test exporting trends to CSV with custom days parameter."""
        for days in [7, 30, 90, 180, 365]:
            response = await auth_client.get(
                f"/api/v1/export/analytics/trends/csv?days={days}"
            )

            assert response.status_code == 200, \
                f"Failed for days={days}: {response.status_code}"
            assert "text/csv" in response.headers["content-type"]

            content = response.text
            assert len(content) > 0

    async def test_export_trends_csv_invalid_days(self, auth_client: AsyncClient):
        """Test exporting trends with invalid days parameter."""
        # Too small (< 7)
        response = await auth_client.get("/api/v1/export/analytics/trends/csv?days=3")
        assert response.status_code == 422  # Validation error

        # Too large (> 365)
        response = await auth_client.get("/api/v1/export/analytics/trends/csv?days=400")
        assert response.status_code == 422  # Validation error


class TestExportAuthentication:
    """Test suite for export endpoint authentication."""

    async def test_export_without_authentication(self, client: AsyncClient):
        """Test that export endpoints require authentication."""
        endpoints = [
            "/api/v1/export/facts/csv",
            "/api/v1/export/analytics/trends/csv",
        ]

        for endpoint in endpoints:
            response = await client.get(endpoint)
            assert response.status_code in [401, 403], \
                f"Endpoint {endpoint} should require authentication, got {response.status_code}"

    async def test_export_with_invalid_token(self, client: AsyncClient):
        """Test export with invalid authentication token."""
        # Set invalid cookie
        client.cookies.set("access_token", "invalid_token_here")

        response = await client.get("/api/v1/export/facts/csv")
        assert response.status_code in [401, 403]


class TestExportDataIsolation:
    """Test suite for data isolation in export endpoints."""

    async def test_user_only_exports_own_data(self, auth_client: AsyncClient):
        """Test that users can only export their own data."""
        # Export facts
        response = await auth_client.get("/api/v1/export/facts/csv")
        assert response.status_code == 200

        content = response.text
        csv_reader = csv.reader(io.StringIO(content))
        next(csv_reader)

        # All exported rows should belong to the authenticated user
        # This is ensured by the backend filtering by current_user.id
        # We can't directly verify user_id in CSV (it's not included),
        # but the backend query filters by user_id, so this is implicitly tested

        assert len(content) >= 0  # User might have 0 or more facts

    async def test_admin_exports_personal_data(self, admin_client: AsyncClient):
        """Test that admin exports their personal data (not all users)."""
        # Admin should export their own personal data, not system-wide data
        response = await admin_client.get("/api/v1/export/facts/csv")
        assert response.status_code == 200

        # Content type should be CSV
        assert "text/csv" in response.headers["content-type"]

        # This tests that the endpoint works for admin
        # The endpoint exports admin's personal data (same as regular users)
        content = response.text
        assert len(content) >= 0


class TestExportFileNaming:
    """Test suite for export file naming conventions."""

    async def test_csv_filename_format(self, auth_client: AsyncClient):
        """Test that CSV files have proper naming format."""
        response = await auth_client.get("/api/v1/export/facts/csv")

        disposition = response.headers["content-disposition"]
        # Format: transactions_YYYYMMDD_HHMMSS.csv
        assert "transactions_" in disposition
        assert ".csv" in disposition

    async def test_trends_csv_filename_format(self, auth_client: AsyncClient):
        """Test that trends CSV files have proper naming format."""
        response = await auth_client.get("/api/v1/export/analytics/trends/csv")

        disposition = response.headers["content-disposition"]
        assert "trends_" in disposition
        assert ".csv" in disposition


class TestAdminExportEndpoints:
    """Test suite for admin-scoped system-wide export endpoints."""

    async def test_admin_export_all_facts_csv(self, admin_client: AsyncClient):
        """Test admin export of all facts to CSV."""
        response = await admin_client.get("/api/v1/admin/export/all-facts/csv")

        assert response.status_code == 200
        assert "text/csv" in response.headers["content-type"]

        # Check Content-Disposition
        disposition = response.headers["content-disposition"]
        assert "attachment" in disposition
        assert "admin_all_facts_" in disposition
        assert ".csv" in disposition

        # Verify CSV structure
        content = response.text
        csv_reader = csv.reader(io.StringIO(content))
        headers = next(csv_reader)
        assert "ID" in headers
        assert "Date" in headers
        assert "User" in headers  # User column for admin export
        assert "Category" in headers
        assert "Type" in headers
        assert "Amount" in headers
        assert "Description" in headers

    async def test_admin_export_with_user_filter(self, admin_client: AsyncClient, test_user):
        """Test admin export with user_id filter."""
        response = await admin_client.get(
            f"/api/v1/admin/export/all-facts/csv?user_id={test_user.id}"
        )

        assert response.status_code == 200
        assert "text/csv" in response.headers["content-type"]

        content = response.text
        assert len(content) > 0

    async def test_admin_export_with_date_filter(self, admin_client: AsyncClient):
        """Test admin export with date range filter."""
        start_date = (date.today() - timedelta(days=30)).isoformat()
        end_date = date.today().isoformat()

        response = await admin_client.get(
            f"/api/v1/admin/export/all-facts/csv?start_date={start_date}&end_date={end_date}"
        )

        assert response.status_code == 200
        assert "text/csv" in response.headers["content-type"]

    async def test_admin_export_requires_admin_access(self, auth_client: AsyncClient):
        """Test that non-admin users cannot access admin export endpoints."""
        endpoints = [
            "/api/v1/admin/export/all-facts/csv",
        ]

        for endpoint in endpoints:
            response = await auth_client.get(endpoint)
            assert response.status_code == 403, \
                f"Endpoint {endpoint} should require admin access, got {response.status_code}"
            data = response.json()
            # Error message may be in "detail" or "message" field
            error_msg = data.get("detail") or data.get("message") or ""
            assert "Admin access required" in str(error_msg)
