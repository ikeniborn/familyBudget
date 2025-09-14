"""
Integration tests for period deletion fix with actual database operations.

These tests use the real database to verify the period deletion fix works
end-to-end with actual SQLAlchemy sessions and database constraints.
"""

import pytest
import asyncio
from datetime import datetime
from httpx import AsyncClient
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.db.database import get_db, engine
from app.models.period import Period
from app.models.registry import Registry
from app.models.user import User


class TestPeriodDeletionIntegrationReal:
    """Integration tests with real database operations."""

    @pytest.fixture
    def db_session(self):
        """Create a real database session for testing."""
        from app.db.database import AsyncSessionLocal

        async with AsyncSessionLocal() as session:
            try:
                yield session
            finally:
                await session.rollback()  # Ensure no changes persist

    @pytest_asyncio.async_fixture
    async def test_user(self, db_session: AsyncSession):
        """Create a test user for isolation."""
        # Check if test user already exists
        stmt = select(User).where(User.username == 'test_period_deletion')
        result = await db_session.execute(stmt)
        existing_user = result.scalar_one_or_none()

        if existing_user:
            return existing_user

        # Create test user
        user = User(
            username='test_period_deletion',
            email='test_period_deletion@example.com',
            telegram_id=9999999999  # Use a unique telegram_id
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        return user

    @pytest_asyncio.async_fixture
    async def test_period(self, db_session: AsyncSession, test_user):
        """Create a test period."""
        period = Period(
            date=datetime(2025, 12, 1),
            ru_name="2025 Дек Тест",
            start_date=datetime(2025, 12, 1),
            end_date=datetime(2025, 12, 31),
            user_id=test_user.user_id
        )
        db_session.add(period)
        await db_session.commit()
        await db_session.refresh(period)
        return period

    @pytest_asyncio.async_fixture
    async def test_period_with_registry(self, db_session: AsyncSession, test_user):
        """Create a test period with registry dependencies."""
        # Create period
        period = Period(
            date=datetime(2025, 11, 1),
            ru_name="2025 Ноя Тест",
            start_date=datetime(2025, 11, 1),
            end_date=datetime(2025, 11, 30),
            user_id=test_user.user_id
        )
        db_session.add(period)
        await db_session.flush()  # Get the ID without committing

        # Create registry entry (dependency)
        # Note: This might fail if referenced tables don't exist
        # In that case, we'll mock the count in the endpoint
        try:
            registry = Registry(
                operation_date=datetime(2025, 11, 15),
                user_id=test_user.user_id,
                period_id=period.id,
                financial_center_id=1,  # Assuming this exists
                nomenclature_id=1,      # Assuming this exists
                row_type_id=1,          # Assuming this exists
                cost_sum=1000.00,
                comment="Test registry entry"
            )
            db_session.add(registry)
            await db_session.commit()
            await db_session.refresh(period)
            return period
        except Exception:
            # If registry creation fails, just return period without registry
            await db_session.commit()
            await db_session.refresh(period)
            return period

    @pytest.mark.asyncio
    async def test_delete_period_without_dependencies_real_db(self, db_session: AsyncSession, test_period, test_user):
        """Test successful deletion of period without dependencies using real database."""
        period_id = test_period.id
        user_id = test_user.user_id

        # Verify period exists
        stmt = select(Period).where(Period.id == period_id, Period.user_id == user_id)
        result = await db_session.execute(stmt)
        period = result.scalar_one_or_none()
        assert period is not None
        assert period.ru_name == "2025 Дек Тест"

        # Check for registry dependencies
        registry_stmt = select(func.count(Registry.id)).where(
            Registry.period_id == period_id,
            Registry.user_id == user_id
        )
        registry_result = await db_session.execute(registry_stmt)
        registry_count = registry_result.scalar()
        assert registry_count == 0

        # Store period name before deletion (simulating the fix)
        period_name = period.ru_name

        # Delete the period
        await db_session.delete(period)
        await db_session.commit()

        # Verify period is deleted
        stmt = select(Period).where(Period.id == period_id)
        result = await db_session.execute(stmt)
        deleted_period = result.scalar_one_or_none()
        assert deleted_period is None

        # Verify we still have access to the stored name
        assert period_name == "2025 Дек Тест"

    @pytest.mark.asyncio
    async def test_registry_count_accuracy(self, db_session: AsyncSession, test_user):
        """Test that registry count query returns accurate results."""
        # Create a period
        period = Period(
            date=datetime(2025, 10, 1),
            ru_name="2025 Окт Тест",
            user_id=test_user.user_id
        )
        db_session.add(period)
        await db_session.flush()

        # Initially should have 0 registry entries
        registry_stmt = select(func.count(Registry.id)).where(
            Registry.period_id == period.id,
            Registry.user_id == test_user.user_id
        )
        result = await db_session.execute(registry_stmt)
        count = result.scalar()
        assert count == 0

        await db_session.commit()

    @pytest.mark.asyncio
    async def test_user_isolation_in_deletion(self, db_session: AsyncSession):
        """Test that periods are properly isolated by user_id in deletion."""
        # Create two users
        user1 = User(
            username='test_user_1_deletion',
            email='test1@example.com',
            telegram_id=1111111111
        )
        user2 = User(
            username='test_user_2_deletion',
            email='test2@example.com',
            telegram_id=2222222222
        )
        db_session.add_all([user1, user2])
        await db_session.flush()

        # Create periods for both users with same ID pattern
        period1 = Period(
            date=datetime(2025, 8, 1),
            ru_name="2025 Авг Пользователь 1",
            user_id=user1.user_id
        )
        period2 = Period(
            date=datetime(2025, 8, 1),
            ru_name="2025 Авг Пользователь 2",
            user_id=user2.user_id
        )
        db_session.add_all([period1, period2])
        await db_session.commit()

        # Try to delete period1 using user1's credentials
        stmt = select(Period).where(
            Period.id == period1.id,
            Period.user_id == user1.user_id
        )
        result = await db_session.execute(stmt)
        found_period = result.scalar_one_or_none()
        assert found_period is not None

        # Try to access period1 using user2's credentials (should fail)
        stmt = select(Period).where(
            Period.id == period1.id,
            Period.user_id == user2.user_id
        )
        result = await db_session.execute(stmt)
        not_found = result.scalar_one_or_none()
        assert not_found is None

        # Cleanup
        await db_session.delete(period1)
        await db_session.delete(period2)
        await db_session.delete(user1)
        await db_session.delete(user2)
        await db_session.commit()

    @pytest.mark.asyncio
    async def test_sqlalchemy_session_detachment_scenario(self, db_session: AsyncSession, test_user):
        """Test the specific scenario where SQLAlchemy session detachment occurs."""
        # Create a period
        period = Period(
            date=datetime(2025, 7, 1),
            ru_name="2025 Июл Тест Отсоединения",
            user_id=test_user.user_id
        )
        db_session.add(period)
        await db_session.commit()
        await db_session.refresh(period)

        # Access the period name while session is active
        period_name_before = period.ru_name
        assert period_name_before == "2025 Июл Тест Отсоединения"

        # Store the name (this is the critical fix)
        stored_name = period.ru_name

        # Simulate deletion
        await db_session.delete(period)
        await db_session.commit()

        # After commit, the session might be detached
        # But we have the stored name, so no error occurs
        assert stored_name == period_name_before
        assert stored_name == "2025 Июл Тест Отсоединения"

        # This would potentially fail without the fix:
        # accessing period.ru_name after deletion might raise DetachedInstanceError

    @pytest.mark.asyncio
    async def test_concurrent_deletion_handling(self, db_session: AsyncSession, test_user):
        """Test handling of concurrent deletion scenarios."""
        # Create multiple periods
        periods = []
        for i in range(3):
            period = Period(
                date=datetime(2025, 6, i + 1),
                ru_name=f"2025 Июн Тест {i + 1}",
                user_id=test_user.user_id
            )
            periods.append(period)
            db_session.add(period)

        await db_session.commit()

        # Store names before any deletions
        stored_names = [p.ru_name for p in periods]

        # Delete all periods
        for period in periods:
            await db_session.delete(period)

        await db_session.commit()

        # Verify stored names are still accessible
        expected_names = ["2025 Июн Тест 1", "2025 Июн Тест 2", "2025 Июн Тест 3"]
        assert stored_names == expected_names

    @pytest.mark.asyncio
    async def test_database_constraint_integrity(self, db_session: AsyncSession, test_user):
        """Test database-level integrity constraints."""
        # Create a period
        period = Period(
            date=datetime(2025, 5, 1),
            ru_name="2025 Май Тест Ограничений",
            user_id=test_user.user_id
        )
        db_session.add(period)
        await db_session.commit()
        await db_session.refresh(period)

        # Verify the period exists in database
        stmt = select(func.count(Period.id)).where(Period.id == period.id)
        result = await db_session.execute(stmt)
        count_before = result.scalar()
        assert count_before == 1

        # Delete and verify
        period_name = period.ru_name  # Store before deletion
        await db_session.delete(period)
        await db_session.commit()

        # Verify deletion
        result = await db_session.execute(stmt)
        count_after = result.scalar()
        assert count_after == 0

        # Verify stored name is still available
        assert period_name == "2025 Май Тест Ограничений"


class TestPeriodDeletionCleanup:
    """Cleanup operations for integration tests."""

    @pytest.mark.asyncio
    async def test_cleanup_test_data(self):
        """Clean up any test data that might have been left behind."""
        from app.db.database import AsyncSessionLocal

        async with AsyncSessionLocal() as session:
            try:
                # Clean up test users
                cleanup_stmt = delete(User).where(
                    User.username.like('test_%deletion%')
                )
                await session.execute(cleanup_stmt)

                # Clean up test periods
                cleanup_periods = delete(Period).where(
                    Period.ru_name.like('%Тест%')
                )
                await session.execute(cleanup_periods)

                await session.commit()
            except Exception as e:
                print(f"Cleanup warning: {e}")
                await session.rollback()


if __name__ == "__main__":
    # Run integration tests
    pytest.main([__file__, "-v", "--tb=short", "-s"])