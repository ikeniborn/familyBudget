"""
Test suite for period creation with period_code auto-generation and constraint validation.
Tests the fix for PostgreSQL constraint violations when creating periods.
"""

import pytest
from datetime import datetime, date
from typing import AsyncGenerator
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import status
from httpx import AsyncClient

from app.models.period import Period
from app.models.user import User
from app.db.session import async_session_maker
from app.core.security import get_password_hash
from tests.conftest import async_client, async_session


class TestPeriodCodeAutoGeneration:
    """Test period_code auto-generation functionality."""

    async def test_period_code_auto_generation_first_period(
        self, async_client: AsyncClient, test_user_headers: dict
    ):
        """Test that the first period gets code 202001."""
        # Clear existing periods for clean test
        async with async_session_maker() as session:
            await session.execute(
                "DELETE FROM t_d_period WHERE user_id = (SELECT id FROM t_d_user WHERE username = 'testuser')"
            )
            await session.commit()

        period_data = {
            "period_dt": "2025-01-01",
            "period_ru_name": "2025 Янв",
            "period_start_date": "2025-01-01",
            "period_end_date": "2025-01-31",
            "period_year": 2025,
            "period_month": 1,
            "is_active": True
        }

        response = await async_client.post(
            "/api/periods/",
            json=period_data,
            headers=test_user_headers
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert data["data"]["code"] == "202001"

    async def test_period_code_auto_generation_sequential(
        self, async_client: AsyncClient, test_user_headers: dict
    ):
        """Test that period codes are generated sequentially."""
        # Create first period
        period_data_1 = {
            "period_dt": "2025-02-01",
            "period_ru_name": "2025 Фев",
            "period_start_date": "2025-02-01",
            "period_end_date": "2025-02-28",
            "period_year": 2025,
            "period_month": 2,
            "is_active": True
        }

        response_1 = await async_client.post(
            "/api/periods/",
            json=period_data_1,
            headers=test_user_headers
        )

        assert response_1.status_code == status.HTTP_200_OK
        data_1 = response_1.json()
        first_code = data_1["data"]["code"]

        # Create second period
        period_data_2 = {
            "period_dt": "2025-03-01",
            "period_ru_name": "2025 Мар",
            "period_start_date": "2025-03-01",
            "period_end_date": "2025-03-31",
            "period_year": 2025,
            "period_month": 3,
            "is_active": True
        }

        response_2 = await async_client.post(
            "/api/periods/",
            json=period_data_2,
            headers=test_user_headers
        )

        assert response_2.status_code == status.HTTP_200_OK
        data_2 = response_2.json()
        second_code = data_2["data"]["code"]

        # Extract sequence numbers
        first_seq = int(first_code[-2:])
        second_seq = int(second_code[-2:])

        # Verify sequential generation
        assert second_seq == first_seq + 1

    async def test_period_code_auto_generation_with_gap(
        self, async_client: AsyncClient, test_user_headers: dict, async_session: AsyncSession
    ):
        """Test that period code generation handles gaps in sequence."""
        # Manually create a period with code 202010 to create a gap
        user = await async_session.execute(
            select(User).where(User.username == "testuser")
        )
        user = user.scalar_one()

        period_with_gap = Period(
            code="202010",
            period_dt=datetime(2025, 4, 1),
            period_ru_name="2025 Апр",
            period_start_date=date(2025, 4, 1),
            period_end_date=date(2025, 4, 30),
            period_year=2025,
            period_month=4,
            is_active=True,
            user_id=user.id,
            created_by=user.id,
            managed_by=user.id
        )
        async_session.add(period_with_gap)
        await async_session.commit()

        # Create new period - should get 202011 (continuing from max)
        period_data = {
            "period_dt": "2025-05-01",
            "period_ru_name": "2025 Май",
            "period_start_date": "2025-05-01",
            "period_end_date": "2025-05-31",
            "period_year": 2025,
            "period_month": 5,
            "is_active": True
        }

        response = await async_client.post(
            "/api/periods/",
            json=period_data,
            headers=test_user_headers
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["data"]["code"] == "202011"

    async def test_period_code_uniqueness_constraint(
        self, async_client: AsyncClient, test_user_headers: dict
    ):
        """Test that manually provided period_code respects uniqueness."""
        # Create period with specific code
        period_data = {
            "code": "202099",
            "period_dt": "2025-06-01",
            "period_ru_name": "2025 Июн",
            "period_start_date": "2025-06-01",
            "period_end_date": "2025-06-30",
            "period_year": 2025,
            "period_month": 6,
            "is_active": True
        }

        response = await async_client.post(
            "/api/periods/",
            json=period_data,
            headers=test_user_headers
        )

        assert response.status_code == status.HTTP_200_OK

        # Try to create another period with the same code
        period_data_duplicate = {
            "code": "202099",
            "period_dt": "2025-07-01",
            "period_ru_name": "2025 Июл",
            "period_start_date": "2025-07-01",
            "period_end_date": "2025-07-31",
            "period_year": 2025,
            "period_month": 7,
            "is_active": True
        }

        response_duplicate = await async_client.post(
            "/api/periods/",
            json=period_data_duplicate,
            headers=test_user_headers
        )

        assert response_duplicate.status_code == status.HTTP_409_CONFLICT
        data = response_duplicate.json()
        assert data["success"] is False
        assert "already exists" in data["error"].lower()


class TestPeriodConstraintValidation:
    """Test database constraint validation for periods."""

    async def test_period_code_not_null_constraint(
        self, async_client: AsyncClient, test_user_headers: dict, monkeypatch
    ):
        """Test that period_code is always populated (never NULL)."""
        # Even without providing period_code, it should be auto-generated
        period_data = {
            "period_dt": "2025-08-01",
            "period_ru_name": "2025 Авг",
            "period_start_date": "2025-08-01",
            "period_end_date": "2025-08-31",
            "period_year": 2025,
            "period_month": 8,
            "is_active": True
        }

        response = await async_client.post(
            "/api/periods/",
            json=period_data,
            headers=test_user_headers
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["data"]["code"] is not None
        assert data["data"]["code"] != ""
        assert data["data"]["code"].startswith("2020")

    async def test_duplicate_period_dt_constraint(
        self, async_client: AsyncClient, test_user_headers: dict
    ):
        """Test that duplicate period_dt for same user returns 409 conflict."""
        period_data = {
            "period_dt": "2025-09-01",
            "period_ru_name": "2025 Сен",
            "period_start_date": "2025-09-01",
            "period_end_date": "2025-09-30",
            "period_year": 2025,
            "period_month": 9,
            "is_active": True
        }

        # Create first period
        response_1 = await async_client.post(
            "/api/periods/",
            json=period_data,
            headers=test_user_headers
        )
        assert response_1.status_code == status.HTTP_200_OK

        # Try to create duplicate
        response_2 = await async_client.post(
            "/api/periods/",
            json=period_data,
            headers=test_user_headers
        )

        assert response_2.status_code == status.HTTP_409_CONFLICT
        data = response_2.json()
        assert data["success"] is False
        assert "already exists" in data["error"].lower()

    async def test_required_fields_validation(
        self, async_client: AsyncClient, test_user_headers: dict
    ):
        """Test validation of required fields."""
        # Missing required fields
        incomplete_data = {
            "period_ru_name": "2025 Окт",
            "is_active": True
        }

        response = await async_client.post(
            "/api/periods/",
            json=incomplete_data,
            headers=test_user_headers
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        data = response.json()
        assert data["success"] is False
        assert "validation" in data["error"].lower()

    async def test_period_dates_consistency(
        self, async_client: AsyncClient, test_user_headers: dict
    ):
        """Test that period dates are validated for consistency."""
        # End date before start date
        invalid_period_data = {
            "period_dt": "2025-11-01",
            "period_ru_name": "2025 Ноя",
            "period_start_date": "2025-11-30",
            "period_end_date": "2025-11-01",  # End before start
            "period_year": 2025,
            "period_month": 11,
            "is_active": True
        }

        response = await async_client.post(
            "/api/periods/",
            json=invalid_period_data,
            headers=test_user_headers
        )

        # Backend should either validate this or handle gracefully
        if response.status_code == status.HTTP_200_OK:
            # If accepted, verify dates were corrected
            data = response.json()
            start = datetime.fromisoformat(data["data"]["period_start_date"])
            end = datetime.fromisoformat(data["data"]["period_end_date"])
            assert end >= start
        else:
            # Or return validation error
            assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestPeriodUserIsolation:
    """Test that periods are properly isolated by user."""

    async def test_periods_isolated_by_user(
        self, async_client: AsyncClient, async_session: AsyncSession
    ):
        """Test that users can only see their own periods."""
        # Create two test users
        user1 = User(
            username="user1",
            email="user1@example.com",
            password_hash=get_password_hash("password1"),
            telegram_id=111111,
            is_active=True
        )
        user2 = User(
            username="user2",
            email="user2@example.com",
            password_hash=get_password_hash("password2"),
            telegram_id=222222,
            is_active=True
        )
        async_session.add_all([user1, user2])
        await async_session.commit()

        # Login as user1
        login_response_1 = await async_client.post(
            "/api/auth/login",
            json={"username": "user1", "password": "password1"}
        )
        assert login_response_1.status_code == status.HTTP_200_OK
        headers_1 = {"Cookie": login_response_1.headers.get("set-cookie")}

        # Login as user2
        login_response_2 = await async_client.post(
            "/api/auth/login",
            json={"username": "user2", "password": "password2"}
        )
        assert login_response_2.status_code == status.HTTP_200_OK
        headers_2 = {"Cookie": login_response_2.headers.get("set-cookie")}

        # User1 creates a period
        period_data_1 = {
            "period_dt": "2025-12-01",
            "period_ru_name": "2025 Дек",
            "period_start_date": "2025-12-01",
            "period_end_date": "2025-12-31",
            "period_year": 2025,
            "period_month": 12,
            "is_active": True
        }
        response_1 = await async_client.post(
            "/api/periods/",
            json=period_data_1,
            headers=headers_1
        )
        assert response_1.status_code == status.HTTP_200_OK

        # User2 creates a period with same date (should work - different user)
        period_data_2 = {
            "period_dt": "2025-12-01",
            "period_ru_name": "2025 Дек",
            "period_start_date": "2025-12-01",
            "period_end_date": "2025-12-31",
            "period_year": 2025,
            "period_month": 12,
            "is_active": True
        }
        response_2 = await async_client.post(
            "/api/periods/",
            json=period_data_2,
            headers=headers_2
        )
        assert response_2.status_code == status.HTTP_200_OK

        # User1 should only see their period
        list_response_1 = await async_client.get("/api/periods/", headers=headers_1)
        assert list_response_1.status_code == status.HTTP_200_OK
        data_1 = list_response_1.json()
        user1_periods = [p for p in data_1["data"] if p["period_month"] == 12]
        assert len(user1_periods) == 1

        # User2 should only see their period
        list_response_2 = await async_client.get("/api/periods/", headers=headers_2)
        assert list_response_2.status_code == status.HTTP_200_OK
        data_2 = list_response_2.json()
        user2_periods = [p for p in data_2["data"] if p["period_month"] == 12]
        assert len(user2_periods) == 1

    async def test_period_code_generation_per_user(
        self, async_client: AsyncClient, async_session: AsyncSession
    ):
        """Test that period_code auto-generation is independent per user."""
        # Create test user
        user3 = User(
            username="user3",
            email="user3@example.com",
            password_hash=get_password_hash("password3"),
            telegram_id=333333,
            is_active=True
        )
        async_session.add(user3)
        await async_session.commit()

        # Login as user3
        login_response = await async_client.post(
            "/api/auth/login",
            json={"username": "user3", "password": "password3"}
        )
        assert login_response.status_code == status.HTTP_200_OK
        headers = {"Cookie": login_response.headers.get("set-cookie")}

        # User3 creates their first period
        period_data = {
            "period_dt": "2026-01-01",
            "period_ru_name": "2026 Янв",
            "period_start_date": "2026-01-01",
            "period_end_date": "2026-01-31",
            "period_year": 2026,
            "period_month": 1,
            "is_active": True
        }
        response = await async_client.post(
            "/api/periods/",
            json=period_data,
            headers=headers
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        # User3's first period should start from beginning of sequence
        assert data["data"]["code"] in ["202001", "202002", "202003"]  # Depending on existing data


class TestPeriodConstraintErrorHandling:
    """Test proper error handling for constraint violations."""

    async def test_database_constraint_violation_handling(
        self, async_client: AsyncClient, test_user_headers: dict, async_session: AsyncSession
    ):
        """Test that database constraint violations are handled gracefully."""
        # Create a period directly in database
        user = await async_session.execute(
            select(User).where(User.username == "testuser")
        )
        user = user.scalar_one()

        existing_period = Period(
            code="999999",
            period_dt=datetime(2026, 2, 1),
            period_ru_name="2026 Фев",
            period_start_date=date(2026, 2, 1),
            period_end_date=date(2026, 2, 28),
            period_year=2026,
            period_month=2,
            is_active=True,
            user_id=user.id,
            created_by=user.id,
            managed_by=user.id
        )
        async_session.add(existing_period)
        await async_session.commit()

        # Try to create period with same period_dt (should trigger constraint)
        period_data = {
            "period_dt": "2026-02-01",
            "period_ru_name": "2026 Фев Duplicate",
            "period_start_date": "2026-02-01",
            "period_end_date": "2026-02-28",
            "period_year": 2026,
            "period_month": 2,
            "is_active": True
        }

        response = await async_client.post(
            "/api/periods/",
            json=period_data,
            headers=test_user_headers
        )

        assert response.status_code == status.HTTP_409_CONFLICT
        data = response.json()
        assert data["success"] is False
        assert "error" in data

    async def test_invalid_date_format_handling(
        self, async_client: AsyncClient, test_user_headers: dict
    ):
        """Test handling of invalid date formats."""
        period_data = {
            "period_dt": "invalid-date",
            "period_ru_name": "Invalid Period",
            "period_start_date": "2026-03-01",
            "period_end_date": "2026-03-31",
            "period_year": 2026,
            "period_month": 3,
            "is_active": True
        }

        response = await async_client.post(
            "/api/periods/",
            json=period_data,
            headers=test_user_headers
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        data = response.json()
        assert data["success"] is False

    async def test_missing_period_code_field_handling(
        self, async_client: AsyncClient, test_user_headers: dict
    ):
        """Test that missing period_code field is handled by auto-generation."""
        # Explicitly send request without code field
        period_data = {
            "period_dt": "2026-04-01",
            "period_ru_name": "2026 Апр",
            "period_start_date": "2026-04-01",
            "period_end_date": "2026-04-30",
            "period_year": 2026,
            "period_month": 4,
            "is_active": True
            # code field intentionally omitted
        }

        response = await async_client.post(
            "/api/periods/",
            json=period_data,
            headers=test_user_headers
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert "code" in data["data"]
        assert data["data"]["code"] is not None

    async def test_null_values_in_required_fields(
        self, async_client: AsyncClient, test_user_headers: dict
    ):
        """Test handling of null values in required fields."""
        period_data = {
            "period_dt": None,  # Null value
            "period_ru_name": "2026 Май",
            "period_start_date": "2026-05-01",
            "period_end_date": "2026-05-31",
            "period_year": 2026,
            "period_month": 5,
            "is_active": True
        }

        response = await async_client.post(
            "/api/periods/",
            json=period_data,
            headers=test_user_headers
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        data = response.json()
        assert data["success"] is False

    async def test_concurrent_period_creation(
        self, async_client: AsyncClient, test_user_headers: dict
    ):
        """Test handling of concurrent period creation attempts."""
        import asyncio

        period_data = {
            "period_dt": "2026-06-01",
            "period_ru_name": "2026 Июн",
            "period_start_date": "2026-06-01",
            "period_end_date": "2026-06-30",
            "period_year": 2026,
            "period_month": 6,
            "is_active": True
        }

        # Attempt concurrent creation
        tasks = [
            async_client.post("/api/periods/", json=period_data, headers=test_user_headers)
            for _ in range(3)
        ]

        responses = await asyncio.gather(*tasks, return_exceptions=True)

        # Count successful creations
        success_count = sum(
            1 for r in responses
            if not isinstance(r, Exception) and r.status_code == status.HTTP_200_OK
        )

        # Only one should succeed
        assert success_count == 1

        # Others should get conflict error
        conflict_count = sum(
            1 for r in responses
            if not isinstance(r, Exception) and r.status_code == status.HTTP_409_CONFLICT
        )
        assert conflict_count == 2

    async def test_api_response_format_consistency(
        self, async_client: AsyncClient, test_user_headers: dict
    ):
        """Test that all responses follow unified API format."""
        # Successful creation
        period_data = {
            "period_dt": "2026-07-01",
            "period_ru_name": "2026 Июл",
            "period_start_date": "2026-07-01",
            "period_end_date": "2026-07-31",
            "period_year": 2026,
            "period_month": 7,
            "is_active": True
        }

        success_response = await async_client.post(
            "/api/periods/",
            json=period_data,
            headers=test_user_headers
        )

        assert success_response.status_code == status.HTTP_200_OK
        success_data = success_response.json()
        assert "success" in success_data
        assert success_data["success"] is True
        assert "data" in success_data

        # Error response (duplicate)
        error_response = await async_client.post(
            "/api/periods/",
            json=period_data,
            headers=test_user_headers
        )

        assert error_response.status_code == status.HTTP_409_CONFLICT
        error_data = error_response.json()
        assert "success" in error_data
        assert error_data["success"] is False
        assert "error" in error_data

        # Validation error
        invalid_data = {"period_ru_name": "Invalid"}
        validation_response = await async_client.post(
            "/api/periods/",
            json=invalid_data,
            headers=test_user_headers
        )

        assert validation_response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        validation_data = validation_response.json()
        assert "success" in validation_data
        assert validation_data["success"] is False
        assert "error" in validation_data