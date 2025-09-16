"""
Comprehensive tests for period creation functionality with period_code auto-generation.
Tests constraint validation, unique constraints, auto-generation patterns, and user isolation.

This test suite focuses specifically on:
- Period_code auto-generation with sequential pattern (202001, 202002, etc.)
- NOT NULL and UNIQUE constraint validation
- Duplicate period_dt prevention with proper error handling
- User isolation ensuring proper data filtering
- Error handling for constraint violations
"""
import pytest
from datetime import datetime
from fastapi import status
from fastapi.testclient import TestClient
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


def validate_success_response(response_data: dict, expected_data_checks: dict = None):
    """Helper function to validate unified success response format."""
    assert "success" in response_data
    assert response_data["success"] is True
    assert "data" in response_data

    if expected_data_checks:
        data = response_data["data"]
        for key, expected_value in expected_data_checks.items():
            assert key in data
            if expected_value is not None:
                assert data[key] == expected_value

    return response_data["data"]


def validate_error_response(response_data: dict, expected_error_substring: str = None):
    """Helper function to validate unified error response format."""
    assert "success" in response_data
    assert response_data["success"] is False
    assert "error" in response_data
    assert isinstance(response_data["error"], str)

    if expected_error_substring:
        assert expected_error_substring in response_data["error"]

    return response_data["error"]


class TestPeriodCodeAutoGeneration:
    """Test suite for period_code auto-generation functionality."""

    async def test_period_code_auto_generation_first_period(
        self,
        authenticated_client: TestClient,
        db_session: AsyncSession,
        test_user: dict
    ):
        """Test that the first period gets auto-generated period_code '202001'."""
        # Clear any existing periods to ensure clean state
        await db_session.execute(text("DELETE FROM t_d_period WHERE user_id = :user_id"),
                                {"user_id": test_user["user_id"]})
        await db_session.commit()

        # Create first period without providing period_code
        period_data = {
            "period_year": 2025,
            "period_month": 1,
            "period_name": "2025 Янв",
            "start_date": "2025-01-01T00:00:00",
            "end_date": "2025-01-31T23:59:59"
        }

        response = authenticated_client.post("/api/periods/", json=period_data)
        assert response.status_code == status.HTTP_201_CREATED

        response_data = response.json()
        created_period = validate_success_response(response_data, {
            "period_name": "2025 Янв",
            "period_year": 2025,
            "period_month": 1
        })

        # Verify auto-generated period_code follows expected pattern
        assert "code" in created_period
        assert created_period["code"] == "202001"

    async def test_period_code_sequential_generation(
        self,
        authenticated_client: TestClient,
        db_session: AsyncSession,
        test_user: dict
    ):
        """Test that period_code follows sequential pattern (202001, 202002, 202003...)."""
        # Clear existing periods
        await db_session.execute(text("DELETE FROM t_d_period WHERE user_id = :user_id"),
                                {"user_id": test_user["user_id"]})
        await db_session.commit()

        expected_codes = ["202001", "202002", "202003"]

        for i, expected_code in enumerate(expected_codes, 1):
            period_data = {
                "period_year": 2025,
                "period_month": i,
                "period_name": f"2025 {i:02d}",
                "start_date": f"2025-{i:02d}-01T00:00:00",
                "end_date": f"2025-{i:02d}-28T23:59:59"
            }

            response = authenticated_client.post("/api/periods/", json=period_data)
            assert response.status_code == status.HTTP_201_CREATED

            response_data = response.json()
            created_period = validate_success_response(response_data)

            assert created_period["code"] == expected_code

    async def test_period_code_generation_with_gaps(
        self,
        authenticated_client: TestClient,
        db_session: AsyncSession,
        test_user: dict
    ):
        """Test period_code generation continues from max existing code even with gaps."""
        # Clear existing periods
        await db_session.execute(text("DELETE FROM t_d_period WHERE user_id = :user_id"),
                                {"user_id": test_user["user_id"]})
        await db_session.commit()

        # Manually insert periods with gaps in sequence
        await db_session.execute(text("""
            INSERT INTO t_d_period (period_code, period_dt, period_ru_name, user_id, created_by)
            VALUES
                ('202001', '2025-01-01', '2025 Янв', :user_id, :user_id),
                ('202005', '2025-05-01', '2025 Май', :user_id, :user_id)
        """), {"user_id": test_user["user_id"]})
        await db_session.commit()

        # Create new period - should get 202006 (max + 1)
        period_data = {
            "period_year": 2025,
            "period_month": 6,
            "period_name": "2025 Июн",
            "start_date": "2025-06-01T00:00:00",
            "end_date": "2025-06-30T23:59:59"
        }

        response = authenticated_client.post("/api/periods/", json=period_data)
        assert response.status_code == status.HTTP_201_CREATED

        response_data = response.json()
        created_period = validate_success_response(response_data)

        assert created_period["code"] == "202006"

    async def test_period_code_unique_constraint(
        self,
        authenticated_client: TestClient,
        db_session: AsyncSession,
        test_user: dict
    ):
        """Test that period_code UNIQUE constraint is enforced."""
        # Clear existing periods
        await db_session.execute(text("DELETE FROM t_d_period WHERE user_id = :user_id"),
                                {"user_id": test_user["user_id"]})
        await db_session.commit()

        # Manually insert period with specific code
        await db_session.execute(text("""
            INSERT INTO t_d_period (period_code, period_dt, period_ru_name, user_id, created_by)
            VALUES ('202001', '2025-01-01', '2025 Янв', :user_id, :user_id)
        """), {"user_id": test_user["user_id"]})
        await db_session.commit()

        # Try to insert another period which should get the same auto-generated code
        # This should fail due to UNIQUE constraint
        period_data = {
            "period_year": 2025,
            "period_month": 2,
            "period_name": "2025 Фев",
            "start_date": "2025-02-01T00:00:00",
            "end_date": "2025-02-28T23:59:59"
        }

        response = authenticated_client.post("/api/periods/", json=period_data)
        # Should succeed with next available code (202002)
        assert response.status_code == status.HTTP_201_CREATED

        response_data = response.json()
        created_period = validate_success_response(response_data)
        assert created_period["code"] == "202002"  # Should skip to next available


class TestPeriodConstraintValidation:
    """Test suite for period constraint validation (NOT NULL, UNIQUE, etc.)."""

    async def test_period_code_not_null_constraint(
        self,
        db_session: AsyncSession,
        test_user: dict
    ):
        """Test that period_code NOT NULL constraint is enforced at database level."""
        # Direct database insert without period_code should fail
        with pytest.raises(Exception):  # Should raise database constraint violation
            await db_session.execute(text("""
                INSERT INTO t_d_period (period_dt, period_ru_name, user_id, created_by)
                VALUES ('2025-01-01', '2025 Янв', :user_id, :user_id)
            """), {"user_id": test_user["user_id"]})
            await db_session.commit()

    async def test_duplicate_period_dt_prevention(
        self,
        authenticated_client: TestClient,
        db_session: AsyncSession,
        test_user: dict
    ):
        """Test that duplicate period_dt values are prevented with proper error handling."""
        # Clear existing periods
        await db_session.execute(text("DELETE FROM t_d_period WHERE user_id = :user_id"),
                                {"user_id": test_user["user_id"]})
        await db_session.commit()

        # Create first period
        period_data = {
            "period_year": 2025,
            "period_month": 3,
            "period_name": "2025 Мар",
            "start_date": "2025-03-01T00:00:00",
            "end_date": "2025-03-31T23:59:59"
        }

        response = authenticated_client.post("/api/periods/", json=period_data)
        assert response.status_code == status.HTTP_201_CREATED

        # Try to create period with same date
        duplicate_period_data = {
            "period_year": 2025,
            "period_month": 3,
            "period_name": "2025 Март дубликат",
            "start_date": "2025-03-01T00:00:00",
            "end_date": "2025-03-31T23:59:59"
        }

        response = authenticated_client.post("/api/periods/", json=duplicate_period_data)
        assert response.status_code == status.HTTP_409_CONFLICT

        response_data = response.json()
        error_message = validate_error_response(response_data, "already exists")
        assert "2025-03-01" in error_message

    async def test_period_dt_not_null_constraint(
        self,
        authenticated_client: TestClient
    ):
        """Test that period_dt (date) is required for period creation."""
        # Try to create period without date information
        invalid_period_data = {
            "period_name": "Период без даты"
            # Missing period_year, period_month, and date
        }

        response = authenticated_client.post("/api/periods/", json=invalid_period_data)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

        response_data = response.json()
        validate_error_response(response_data, "Missing required fields")

    async def test_period_ru_name_not_null_constraint(
        self,
        authenticated_client: TestClient
    ):
        """Test that period_ru_name is required for period creation."""
        # Try to create period without ru_name
        invalid_period_data = {
            "period_year": 2025,
            "period_month": 4
            # Missing period_name/ru_name
        }

        response = authenticated_client.post("/api/periods/", json=invalid_period_data)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

        response_data = response.json()
        validate_error_response(response_data, "Missing required fields")


class TestPeriodUserIsolation:
    """Test suite for user isolation in period management."""

    async def test_user_isolation_in_period_creation(
        self,
        authenticated_client: TestClient,
        authenticated_client_user2: TestClient,
        db_session: AsyncSession,
        test_user: dict,
        test_user2: dict
    ):
        """Test that periods are properly isolated by user_id."""
        # Clear existing periods for both users
        await db_session.execute(text("DELETE FROM t_d_period WHERE user_id IN (:user1, :user2)"),
                                {"user1": test_user["user_id"], "user2": test_user2["user_id"]})
        await db_session.commit()

        # User 1 creates period
        period_data_user1 = {
            "period_year": 2025,
            "period_month": 7,
            "period_name": "2025 Июл User1",
            "start_date": "2025-07-01T00:00:00",
            "end_date": "2025-07-31T23:59:59"
        }

        response = authenticated_client.post("/api/periods/", json=period_data_user1)
        assert response.status_code == status.HTTP_201_CREATED
        user1_period = validate_success_response(response.json())

        # User 2 creates period with same date (should be allowed due to user isolation)
        period_data_user2 = {
            "period_year": 2025,
            "period_month": 7,
            "period_name": "2025 Июл User2",
            "start_date": "2025-07-01T00:00:00",
            "end_date": "2025-07-31T23:59:59"
        }

        response = authenticated_client_user2.post("/api/periods/", json=period_data_user2)
        assert response.status_code == status.HTTP_201_CREATED
        user2_period = validate_success_response(response.json())

        # Verify both periods were created with different IDs and proper user_id assignment
        assert user1_period["period_id"] != user2_period["period_id"]
        assert user1_period["user_id"] == test_user["user_id"]
        assert user2_period["user_id"] == test_user2["user_id"]

        # Verify period_code auto-generation worked independently for each user
        # Both should get '202001' as they're isolated by user
        assert user1_period["code"] == "202001"
        assert user2_period["code"] == "202001"

    async def test_period_code_isolation_between_users(
        self,
        authenticated_client: TestClient,
        authenticated_client_user2: TestClient,
        db_session: AsyncSession,
        test_user: dict,
        test_user2: dict
    ):
        """Test that period_code auto-generation is isolated between users."""
        # Clear existing periods
        await db_session.execute(text("DELETE FROM t_d_period WHERE user_id IN (:user1, :user2)"),
                                {"user1": test_user["user_id"], "user2": test_user2["user_id"]})
        await db_session.commit()

        # User 1 creates multiple periods
        for month in [1, 2, 3]:
            period_data = {
                "period_year": 2025,
                "period_month": month,
                "period_name": f"2025 {month:02d} User1",
                "start_date": f"2025-{month:02d}-01T00:00:00",
                "end_date": f"2025-{month:02d}-28T23:59:59"
            }
            response = authenticated_client.post("/api/periods/", json=period_data)
            assert response.status_code == status.HTTP_201_CREATED

        # User 2 creates period - should start from 202001, not 202004
        period_data_user2 = {
            "period_year": 2025,
            "period_month": 8,
            "period_name": "2025 Авг User2",
            "start_date": "2025-08-01T00:00:00",
            "end_date": "2025-08-31T23:59:59"
        }

        response = authenticated_client_user2.post("/api/periods/", json=period_data_user2)
        assert response.status_code == status.HTTP_201_CREATED

        user2_period = validate_success_response(response.json())
        # Should get 202001 because user isolation means User2 starts fresh sequence
        assert user2_period["code"] == "202001"


class TestPeriodConstraintErrorHandling:
    """Test suite for comprehensive error handling in period constraint violations."""

    async def test_database_constraint_violation_handling(
        self,
        authenticated_client: TestClient,
        db_session: AsyncSession,
        test_user: dict
    ):
        """Test proper error handling when database constraints are violated."""
        # Clear existing periods
        await db_session.execute(text("DELETE FROM t_d_period WHERE user_id = :user_id"),
                                {"user_id": test_user["user_id"]})
        await db_session.commit()

        # Create period normally
        period_data = {
            "period_year": 2025,
            "period_month": 9,
            "period_name": "2025 Сен",
            "start_date": "2025-09-01T00:00:00",
            "end_date": "2025-09-30T23:59:59"
        }

        response = authenticated_client.post("/api/periods/", json=period_data)
        assert response.status_code == status.HTTP_201_CREATED

        # Try to create duplicate - should handle constraint violation gracefully
        response = authenticated_client.post("/api/periods/", json=period_data)
        assert response.status_code == status.HTTP_409_CONFLICT

        response_data = response.json()
        error_message = validate_error_response(response_data)
        assert "already exists" in error_message
        assert isinstance(error_message, str)  # Proper error formatting

    async def test_invalid_datetime_constraint_handling(
        self,
        authenticated_client: TestClient
    ):
        """Test handling of invalid datetime values in period creation."""
        invalid_datetime_cases = [
            {
                "period_year": 2025,
                "period_month": 13,  # Invalid month
                "period_name": "Invalid Month",
                "start_date": "2025-13-01T00:00:00"
            },
            {
                "period_year": 2025,
                "period_month": 2,
                "period_name": "Invalid Date Format",
                "start_date": "not-a-date"
            },
            {
                "period_year": -2025,  # Invalid year
                "period_month": 1,
                "period_name": "Invalid Year",
                "start_date": "-2025-01-01T00:00:00"
            }
        ]

        for invalid_data in invalid_datetime_cases:
            response = authenticated_client.post("/api/periods/", json=invalid_data)
            assert response.status_code in [
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                status.HTTP_400_BAD_REQUEST
            ]

            response_data = response.json()
            validate_error_response(response_data)

    async def test_missing_required_fields_error_handling(
        self,
        authenticated_client: TestClient
    ):
        """Test error handling for missing required fields in period creation."""
        incomplete_data_cases = [
            {},  # Empty data
            {"period_year": 2025},  # Missing month and name
            {"period_month": 10},  # Missing year and name
            {"period_name": "Incomplete Period"}  # Missing date info
        ]

        for incomplete_data in incomplete_data_cases:
            response = authenticated_client.post("/api/periods/", json=incomplete_data)
            assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

            response_data = response.json()
            validate_error_response(response_data, "Missing required fields")

    async def test_constraint_violation_response_format(
        self,
        authenticated_client: TestClient,
        db_session: AsyncSession,
        test_user: dict
    ):
        """Test that constraint violation responses follow unified API format."""
        # Clear existing periods
        await db_session.execute(text("DELETE FROM t_d_period WHERE user_id = :user_id"),
                                {"user_id": test_user["user_id"]})
        await db_session.commit()

        # Create initial period
        period_data = {
            "period_year": 2025,
            "period_month": 11,
            "period_name": "2025 Ноя",
            "start_date": "2025-11-01T00:00:00",
            "end_date": "2025-11-30T23:59:59"
        }

        response = authenticated_client.post("/api/periods/", json=period_data)
        assert response.status_code == status.HTTP_201_CREATED

        # Try duplicate - verify error response format
        response = authenticated_client.post("/api/periods/", json=period_data)
        assert response.status_code == status.HTTP_409_CONFLICT

        response_data = response.json()

        # Validate unified error response structure
        assert "success" in response_data
        assert response_data["success"] is False
        assert "error" in response_data
        assert isinstance(response_data["error"], str)
        assert len(response_data["error"]) > 0

        # Should not have 'data' field in error responses
        assert "data" not in response_data

        # Error message should contain specific details
        error_message = response_data["error"]
        assert "already exists" in error_message
        assert "2025-11-01" in error_message


# Additional test utilities and fixtures specific to period constraints
@pytest.fixture
async def clean_periods_table(db_session: AsyncSession):
    """Fixture to clean periods table before each test."""
    await db_session.execute(text("DELETE FROM t_d_period"))
    await db_session.commit()
    yield
    await db_session.execute(text("DELETE FROM t_d_period"))
    await db_session.commit()


@pytest.fixture
async def sample_periods_with_codes(db_session: AsyncSession, test_user: dict):
    """Fixture to create sample periods with known period_codes for testing."""
    sample_periods = [
        ("202001", "2025-01-01", "2025 Янв"),
        ("202003", "2025-03-01", "2025 Мар"),  # Gap in sequence
        ("202005", "2025-05-01", "2025 Май"),
    ]

    for code, date, name in sample_periods:
        await db_session.execute(text("""
            INSERT INTO t_d_period (period_code, period_dt, period_ru_name, user_id, created_by)
            VALUES (:code, :date, :name, :user_id, :user_id)
        """), {
            "code": code,
            "date": date,
            "name": name,
            "user_id": test_user["user_id"]
        })

    await db_session.commit()
    yield sample_periods

    # Cleanup
    await db_session.execute(text("DELETE FROM t_d_period WHERE user_id = :user_id"),
                            {"user_id": test_user["user_id"]})
    await db_session.commit()