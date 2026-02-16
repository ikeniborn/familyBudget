"""
Integration tests for Admin Stats endpoints.

Tests the system-wide statistics endpoint following Shared Family Budget Model.
"""

from datetime import date, datetime

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.article import Article
from backend.app.models.fact import BudgetFact as Fact
from backend.app.models.user import User


@pytest.mark.integration
@pytest.mark.backend
class TestAdminSystemStats:
    """Test GET /api/v1/admin/users/stats/system endpoint."""

    @pytest.fixture
    async def admin_user(self, db_session: AsyncSession):
        """Create admin user for testing (SCD Type 1)."""
        admin = User(
            telegram_id=999999999,
            username="testadmin",
            first_name="Test",
            last_name="Admin",
            is_admin=True,
        )
        db_session.add(admin)
        await db_session.commit()
        await db_session.refresh(admin)
        return admin

    @pytest.fixture
    async def regular_user(self, db_session: AsyncSession):
        """Create regular user for testing (SCD Type 1)."""
        user = User(
            telegram_id=888888888,
            username="testuser",
            first_name="Test",
            last_name="User",
            is_admin=False,
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        return user

    @pytest.fixture
    async def test_articles(self, db_session: AsyncSession, admin_user: User):
        """Create test articles (SCD Type 1)."""
        articles = [
            Article(
                name="Продукты",
                type="expense",
                parent_id=None,
                user_id=admin_user.id,
            ),
            Article(
                name="Зарплата",
                type="income",
                parent_id=None,
                user_id=admin_user.id,
            ),
        ]
        for article in articles:
            db_session.add(article)
        await db_session.commit()
        for article in articles:
            await db_session.refresh(article)
        return articles

    @pytest.fixture
    async def test_facts(
        self,
        db_session: AsyncSession,
        admin_user: User,
        regular_user: User,
        test_articles: list[Article]
    ):
        """Create test facts from different users (Shared Family Budget)."""
        facts = [
            # Admin's transactions
            Fact(
                amount=1000.00,
                fact_date=date(2025, 11, 1),
                article_id=test_articles[0].id,
                user_id=admin_user.id,
                description="Admin expense"
            ),
            Fact(
                amount=2000.00,
                fact_date=date(2025, 11, 2),
                article_id=test_articles[1].id,
                user_id=admin_user.id,
                description="Admin income"
            ),
            # Regular user's transactions
            Fact(
                amount=500.00,
                fact_date=date(2025, 11, 3),
                article_id=test_articles[0].id,
                user_id=regular_user.id,
                description="User expense"
            ),
        ]
        for fact in facts:
            db_session.add(fact)
        await db_session.commit()
        return facts

    async def test_get_system_stats_success(
        self,
        admin_client: AsyncClient,
        admin_user: User,
        regular_user: User,
        test_articles: list[Article],
        test_facts: list[Fact]
    ):
        """Test getting system-wide statistics (Shared Family Budget)."""
        response = await admin_client.get("/api/v1/admin/users/stats/system")

        assert response.status_code == 200
        data = response.json()

        # Verify response schema
        assert "total_users" in data
        assert "total_active_users" in data
        assert "total_facts" in data
        assert "total_articles" in data
        assert "last_fact_date" in data

        # Verify global metrics (Shared Family Budget)
        assert data["total_users"] == 2  # admin + regular user
        assert data["total_active_users"] == 2  # both created transactions
        assert data["total_facts"] == 3  # ALL transactions (not filtered by user_id)
        assert data["total_articles"] == 2  # ALL active categories
        assert data["last_fact_date"] == "2025-11-03"  # Most recent transaction

    async def test_system_stats_no_user_id_filtering(
        self,
        admin_client: AsyncClient,
        admin_user: User,
        regular_user: User,
        test_articles: list[Article],
        test_facts: list[Fact]
    ):
        """Test that stats are NOT filtered by user_id (Shared Family Budget)."""
        response = await admin_client.get("/api/v1/admin/users/stats/system")

        assert response.status_code == 200
        data = response.json()

        # Critical: total_facts should include ALL transactions
        # NOT just transactions from admin or regular user
        assert data["total_facts"] == 3  # admin (2) + regular_user (1)

        # Critical: total_articles should include ALL categories
        # NOT just categories created by admin
        assert data["total_articles"] == 2

    async def test_system_stats_empty_database(
        self,
        admin_client: AsyncClient,
        admin_user: User
    ):
        """Test system stats with no facts or articles."""
        response = await admin_client.get("/api/v1/admin/users/stats/system")

        assert response.status_code == 200
        data = response.json()

        assert data["total_users"] >= 1  # At least admin user
        assert data["total_active_users"] == 0  # No transactions created
        assert data["total_facts"] == 0
        assert data["total_articles"] == 0
        assert data["last_fact_date"] is None

    async def test_system_stats_requires_admin(
        self,
        client: AsyncClient,
        regular_user: User
    ):
        """Test that regular users cannot access system stats."""
        # This test requires authentication as regular user
        # For now, just verify endpoint exists
        response = await client.get("/api/v1/admin/users/stats/system")

        # Expect 401 (unauthorized) or 403 (forbidden)
        assert response.status_code in [401, 403]

    async def test_system_stats_multiple_users_no_facts(
        self,
        admin_client: AsyncClient,
        admin_user: User,
        regular_user: User,
        test_articles: list[Article]
    ):
        """Test stats with multiple users but no transactions."""
        response = await admin_client.get("/api/v1/admin/users/stats/system")

        assert response.status_code == 200
        data = response.json()

        assert data["total_users"] == 2  # admin + regular user
        assert data["total_active_users"] == 0  # No one created transactions
        assert data["total_facts"] == 0
        assert data["total_articles"] == 2  # Categories exist
        assert data["last_fact_date"] is None
