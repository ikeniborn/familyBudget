"""
Integration tests for Admin DELETE endpoint.

Tests the idempotent DELETE behavior for facts.
"""

from datetime import date

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from backend.app.models.article import Article
from backend.app.models.cost_center import CostCenter
from backend.app.models.fact import BudgetFact as Fact
from backend.app.models.financial_center import FinancialCenter
from backend.app.models.user import User


@pytest.mark.integration
@pytest.mark.backend
@pytest.mark.destructive
class TestAdminDeleteEndpoint:
    """Test DELETE /api/v1/admin/facts/{fact_id} endpoint."""

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
    async def test_article(self, db_session: AsyncSession, admin_user: User):
        """Create test article for facts (SCD Type 1)."""
        article = Article(
            name="Test Category",
            type="expense",
            parent_id=None,
            user_id=admin_user.id,
        )
        db_session.add(article)
        await db_session.commit()
        await db_session.refresh(article)
        return article

    @pytest.fixture
    async def test_financial_center(self, db_session: AsyncSession, admin_user: User):
        """Create test financial center (SCD Type 1)."""
        fc = FinancialCenter(
            name="Test ЦФО",
            description="Test Financial Center",
            user_id=admin_user.id,
        )
        db_session.add(fc)
        await db_session.commit()
        await db_session.refresh(fc)
        return fc

    @pytest.fixture
    async def test_fact(
        self,
        db_session: AsyncSession,
        admin_user: User,
        test_article: Article,
        test_financial_center: FinancialCenter
    ):
        """Create test fact for deletion."""
        fact = Fact(
            amount=100.50,
            fact_date=date.today(),
            article_id=test_article.id,
            financial_center_id=test_financial_center.id,
            user_id=admin_user.id,
            record_type="fact",
            description="Test transaction"
        )
        db_session.add(fact)
        await db_session.commit()
        await db_session.refresh(fact)
        return fact

    @pytest.fixture
    def mock_admin_dependency(self, admin_user: User, monkeypatch):
        """Mock CurrentAdmin dependency."""
        from backend.app.core.dependencies import get_current_admin
        from backend.app.main import app

        async def override_get_current_admin():
            return admin_user

        app.dependency_overrides[get_current_admin] = override_get_current_admin
        yield
        app.dependency_overrides.clear()

    async def test_delete_existing_fact_returns_success(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_fact: Fact,
        mock_admin_dependency
    ):
        """Test DELETE existing fact returns 200 OK with status='deleted'."""
        fact_id = test_fact.id

        # DELETE existing fact
        response = await client.delete(f"/api/v1/admin/facts/{fact_id}")

        # Assert response
        assert response.status_code == 200

        json_data = response.json()
        assert json_data["message"] == "Fact deleted successfully"
        assert json_data["fact_id"] == fact_id
        assert json_data["status"] == "deleted"

        # Verify fact is deleted from database
        query = select(Fact).where(Fact.id == fact_id)
        result = await db_session.execute(query)
        deleted_fact = result.scalar_one_or_none()

        assert deleted_fact is None, "Fact should be deleted from database"

    async def test_delete_nonexistent_fact_returns_already_deleted(
        self,
        client: AsyncClient,
        mock_admin_dependency
    ):
        """Test DELETE non-existent fact returns 200 OK with status='already_deleted'."""
        nonexistent_fact_id = 999999

        # DELETE non-existent fact
        response = await client.delete(f"/api/v1/admin/facts/{nonexistent_fact_id}")

        # Assert response (idempotent DELETE - no 404!)
        assert response.status_code == 200

        json_data = response.json()
        assert json_data["message"] == "Fact already deleted or never existed"
        assert json_data["fact_id"] == nonexistent_fact_id
        assert json_data["status"] == "already_deleted"

    async def test_delete_same_fact_twice_is_idempotent(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_fact: Fact,
        mock_admin_dependency
    ):
        """Test DELETE same fact twice - first succeeds, second returns already_deleted."""
        fact_id = test_fact.id

        # First DELETE - should succeed
        response1 = await client.delete(f"/api/v1/admin/facts/{fact_id}")

        assert response1.status_code == 200
        assert response1.json()["status"] == "deleted"

        # Second DELETE - should return already_deleted
        response2 = await client.delete(f"/api/v1/admin/facts/{fact_id}")

        assert response2.status_code == 200
        assert response2.json()["status"] == "already_deleted"
        assert response2.json()["message"] == "Fact already deleted or never existed"

    async def test_delete_without_admin_privilege_returns_401(
        self,
        client: AsyncClient,
        test_fact: Fact
    ):
        """Test DELETE without admin authentication returns 401."""
        # No mock_admin_dependency - should fail authentication

        fact_id = test_fact.id

        # DELETE without auth
        response = await client.delete(f"/api/v1/admin/facts/{fact_id}")

        # Assert 401 Unauthorized (no admin privilege)
        assert response.status_code in [401, 403]

    async def test_delete_logs_warning_for_nonexistent_fact(
        self,
        client: AsyncClient,
        mock_admin_dependency,
        caplog
    ):
        """Test DELETE non-existent fact logs WARNING message."""
        import logging
        caplog.set_level(logging.WARNING)

        nonexistent_fact_id = 888888

        # DELETE non-existent fact
        await client.delete(f"/api/v1/admin/facts/{nonexistent_fact_id}")

        # Assert WARNING log was recorded
        assert any(
            "DELETE attempt on non-existent fact_id" in record.message
            for record in caplog.records
            if record.levelname == "WARNING"
        ), "Expected WARNING log for non-existent fact DELETE"
