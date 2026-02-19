"""
Shared test fixtures and configuration.

This module provides pytest fixtures for database setup, session management,
common test data, and HTTP client fixtures for API endpoint testing.
"""

import asyncio

# Test database URL (PostgreSQL test database)
# Uses 'postgres' hostname (Docker service name) when running in container
# Uses 'localhost' when running locally outside Docker
import os
from collections.abc import AsyncGenerator, Generator
from datetime import datetime

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from backend.app.main import app
from backend.app.models.article import Article
from backend.app.models.fact import BudgetFact
from backend.app.models.user import User
from backend.app.services.jwt import create_access_token

# Tables to clean, ordered leaf → parent (FK-safe). Used in fixtures below.
_CLEANUP_TABLES = [
    "t_scheduled_reminder",
    "t_f_budget_fact_history",
    "t_f_refresh_token",
    "t_notification",
    "t_f_budget_fact",
    "t_f_shopping_list_item",
    "t_f_shopping_list",
    "t_d_recurring_plan",
    "t_import_staging",
    "t_import_file_upload",
    "t_import_column_mapping",
    "t_d_import_template",
    "t_article_usage_stats",
    "t_d_article_hierarchy",
    "t_article_financial_center",
    "t_d_article_version_link",
    "t_d_article_history",
    "t_d_product_group_hierarchy",
    "t_d_product_group_history",
    "t_agg_financial_center_balance_monthly",
    "t_d_financial_center_history",
    "t_d_financial_center_version_link",
    "t_cost_center_financial_center",
    "t_d_cost_center_history",
    "t_d_cost_center_version_link",
    "t_d_financial_center",
    "t_d_cost_center",
    "t_d_article",
    "t_d_product_group",
    "t_d_store_history",
    "t_d_store",
    "t_user_consent",
    "t_push_subscription",
    "t_2fa_session",
    "t_f_webauthn_audit_log",
    "t_f_webauthn_challenge",
    "t_d_webauthn_credential",
    "t_d_user_history",
    "t_d_user",
]
# Single PL/pgSQL block: skips tables that don't exist (handles schema differences)
_CLEANUP_SQL = "DO $$ BEGIN\n" + "\n".join(
    f"  IF EXISTS (SELECT FROM information_schema.tables "
    f"WHERE table_schema='public' AND table_name='{t}') "
    f"THEN DELETE FROM {t}; END IF;"
    for t in _CLEANUP_TABLES
) + "\nEND $$;"

_db_host = os.getenv("POSTGRES_HOST", "localhost")
_db_port = os.getenv("POSTGRES_PORT", "5433")
_db_name = os.getenv("POSTGRES_DB", "familybudget_test")
_default_url = f"postgresql+asyncpg://familybudget:test_password_12345678901234567890@{_db_host}:{_db_port}/{_db_name}"
TEST_DATABASE_URL = os.getenv("DATABASE_URL", _default_url)


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _clean_database_before_session() -> None:
    """
    Clean database once at the very start of the test session.

    Handles dirty state from previous CI/CD runs that were killed before
    post-test cleanup could complete. Runs automatically before any test.
    Uses IF EXISTS to handle schema differences across environments.
    """
    engine = create_async_engine(TEST_DATABASE_URL, echo=False, poolclass=NullPool)
    try:
        async with engine.begin() as conn:
            await conn.execute(text(_CLEANUP_SQL))
    finally:
        await engine.dispose()


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """
    Create event loop for async tests.

    Scope: session - one event loop for entire test session.
    """
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def engine():
    """
    Create async database engine for tests.

    Scope: function - new engine for each test (isolation).
    Uses PostgreSQL test database with migrations already applied.
    Data is cleaned up after each test via session rollback.
    """
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,  # Set to True for SQL debugging
        poolclass=NullPool,  # Disable connection pooling for tests
    )

    yield engine

    # Cleanup: dispose engine
    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def session(engine) -> AsyncGenerator[AsyncSession, None]:
    """
    Create async database session for tests.

    Scope: function - new session for each test (isolation).
    Cleanup: DELETE all data after test completes.

    Note: Using DELETE instead of TRUNCATE to avoid PostgreSQL configuration
    requirements in CI/CD (max_locks_per_transaction). DELETE is slower but
    more reliable across different PostgreSQL configurations.
    """
    async with AsyncSession(engine, expire_on_commit=False) as session:
        yield session

    # Cleanup after test: DELETE all data to ensure isolation
    # Using separate connection to avoid conflicts with test session
    # Uses PL/pgSQL IF EXISTS to handle schema differences across environments
    async with engine.begin() as conn:
        await conn.execute(text(_CLEANUP_SQL))


# Cleanup is now handled by session fixture teardown (see above)
# No separate cleanup_database fixture needed


# ============================================================================
# User Fixtures
# ============================================================================


@pytest_asyncio.fixture
async def test_user(session: AsyncSession) -> User:
    """
    Create test user (current version).

    Returns:
        User with telegram_id=123456789, is_admin=False
    """
    user = User(
        telegram_id=123456789,
        username="testuser",
        first_name="Test",
        last_name="User",
        is_admin=False,
        is_active=True,
        # Note: is_current, valid_from, valid_to removed - User model uses SCD Type 1
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


@pytest_asyncio.fixture
async def test_admin(session: AsyncSession) -> User:
    """
    Create test admin user (current version).

    Returns:
        User with telegram_id=987654321, is_admin=True
    """
    admin = User(
        telegram_id=987654321,
        username="testadmin",
        first_name="Test",
        last_name="Admin",
        is_admin=True,
        is_active=True,
        # Note: is_current, valid_from, valid_to removed - User model uses SCD Type 1
    )
    session.add(admin)
    await session.commit()
    await session.refresh(admin)
    return admin


# ============================================================================
# Article Fixtures
# ============================================================================


@pytest_asyncio.fixture
async def test_article_root(session: AsyncSession, test_user: User) -> Article:
    """
    Create test root article (no parent).

    Returns:
        Article: Food category (expense, SCD Type 1)
    """
    article = Article(
        user_id=test_user.id,
        parent_id=None,
        name="Food",
        type="expense",
    )
    session.add(article)
    await session.commit()
    await session.refresh(article)
    return article


@pytest_asyncio.fixture
async def test_article_child(
    session: AsyncSession, test_user: User, test_article_root: Article
) -> Article:
    """
    Create test child article.

    Returns:
        Article: Groceries category (child of Food, SCD Type 1)
    """
    article = Article(
        user_id=test_user.id,
        parent_id=test_article_root.id,
        name="Groceries",
        type="expense",
    )
    session.add(article)
    await session.commit()
    await session.refresh(article)
    return article


@pytest_asyncio.fixture
async def test_global_article(session: AsyncSession, test_user: User) -> Article:
    """
    Create test income article.

    Returns:
        Article: Salary category (income, SCD Type 1)

    Note: Previously was "global" article, now all articles are user-specific
    """
    article = Article(
        user_id=test_user.id,
        parent_id=None,
        name="Salary",
        type="income",
    )
    session.add(article)
    await session.commit()
    await session.refresh(article)
    return article


# ============================================================================
# BudgetFact Fixtures
# ============================================================================


@pytest_asyncio.fixture
async def test_fact(
    session: AsyncSession, test_user: User, test_article_root: Article
) -> BudgetFact:
    """
    Create test budget fact (transaction).

    Returns:
        BudgetFact: Expense transaction for $50.75
    """
    from datetime import date
    from decimal import Decimal

    fact = BudgetFact(
        user_id=test_user.id,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 13),
        amount=Decimal("50.75"),
        description="Test grocery purchase",
    )
    session.add(fact)
    await session.commit()
    await session.refresh(fact)
    return fact


# ============================================================================
# HTTP Client Fixtures
# ============================================================================


@pytest_asyncio.fixture
async def client(session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """
    Create unauthenticated HTTP client for API testing.

    Uses FastAPI TestClient with async support via httpx.AsyncClient.
    Database session is overridden to use test session.

    IMPORTANT: Uses the same session as test to ensure data visibility.

    Returns:
        AsyncClient: HTTP client without authentication

    Example:
        async def test_endpoint(client: AsyncClient):
            response = await client.get("/api/v1/articles")
            assert response.status_code == 401  # Requires authentication
    """
    from backend.app.core.dependencies import get_session

    # Override get_session to use test session (same transaction)
    async def override_get_session() -> AsyncGenerator[AsyncSession, None]:
        yield session

    app.dependency_overrides[get_session] = override_get_session

    # Create HTTP client
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

    # Cleanup
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def auth_client(
    session: AsyncSession, test_user: User
) -> AsyncGenerator[AsyncClient, None]:
    """
    Create authenticated HTTP client for regular user.

    Creates JWT token for test_user and includes it in cookies.
    All requests will be authenticated as regular user (not admin).

    IMPORTANT: Uses the same session as test to ensure test_user is visible.

    Returns:
        AsyncClient: HTTP client authenticated as test_user

    Example:
        async def test_endpoint(auth_client: AsyncClient):
            response = await auth_client.get("/api/v1/facts")
            assert response.status_code == 200  # Authenticated
    """
    from backend.app.core.dependencies import get_session

    # Override get_session to use test session (same transaction)
    async def override_get_session() -> AsyncGenerator[AsyncSession, None]:
        yield session

    app.dependency_overrides[get_session] = override_get_session

    # Create JWT token for test_user
    access_token = create_access_token(user_id=test_user.id, telegram_id=test_user.telegram_id)

    # Create HTTP client with authentication cookie
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        ac.cookies.set("access_token", access_token)
        yield ac

    # Cleanup
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def admin_client(
    session: AsyncSession, test_admin: User
) -> AsyncGenerator[AsyncClient, None]:
    """
    Create authenticated HTTP client for admin user.

    Creates JWT token for test_admin and includes it in cookies.
    All requests will be authenticated as admin user.

    IMPORTANT: Uses the same session as test to ensure test_admin is visible.

    Returns:
        AsyncClient: HTTP client authenticated as test_admin

    Example:
        async def test_endpoint(admin_client: AsyncClient):
            response = await admin_client.get("/api/v1/users")
            assert response.status_code == 200  # Admin only endpoint
    """
    from backend.app.core.dependencies import get_session

    # Override get_session to use test session (same transaction)
    async def override_get_session() -> AsyncGenerator[AsyncSession, None]:
        yield session

    app.dependency_overrides[get_session] = override_get_session

    # Create JWT token for test_admin
    access_token = create_access_token(user_id=test_admin.id, telegram_id=test_admin.telegram_id)

    # Create HTTP client with authentication cookie
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        ac.cookies.set("access_token", access_token)
        yield ac

    # Cleanup
    app.dependency_overrides.clear()


# ============================================================================
# Shopping Lists Fixtures
# ============================================================================


@pytest_asyncio.fixture
async def test_store(session: AsyncSession, test_user: User):
    """
    Create test store.

    Returns:
        Store: Walmart store (shared across users, creator_id for audit)
    """
    from backend.app.models.store import Store

    store = Store(
        creator_id=test_user.id,
        name="Walmart",
        code="STORE-1",
        description="Walmart Supercenter",
        is_active=True,
        is_current=True,
        valid_from=datetime.utcnow(),
        valid_to=datetime(9999, 12, 31, 23, 59, 59),
    )
    session.add(store)
    await session.commit()
    await session.refresh(store)
    return store


@pytest_asyncio.fixture
async def test_product_group_root(session: AsyncSession, test_user: User):
    """
    Create test root product group (no parent).

    Returns:
        ProductGroup: Food category (shared, creator_id for audit)
    """
    from backend.app.models.product_group import ProductGroup

    group = ProductGroup(
        creator_id=test_user.id,
        parent_id=None,
        name="Food",
        code="PGRP-1",
        description="Food products",
        is_active=True,
        is_current=True,
        valid_from=datetime.utcnow(),
        valid_to=datetime(9999, 12, 31, 23, 59, 59),
    )
    session.add(group)
    await session.commit()
    await session.refresh(group)
    return group


@pytest_asyncio.fixture
async def test_product_group_child(
    session: AsyncSession, test_user: User, test_product_group_root
):
    """
    Create test child product group.

    Returns:
        ProductGroup: Vegetables category (child of Food)
    """
    from backend.app.models.product_group import ProductGroup

    group = ProductGroup(
        creator_id=test_user.id,
        parent_id=test_product_group_root.id,
        name="Vegetables",
        code="PGRP-2",
        description="Fresh vegetables",
        is_active=True,
        is_current=True,
        valid_from=datetime.utcnow(),
        valid_to=datetime(9999, 12, 31, 23, 59, 59),
    )
    session.add(group)
    await session.commit()
    await session.refresh(group)
    return group


@pytest_asyncio.fixture
async def test_shopping_list(session: AsyncSession, test_user: User):
    """
    Create test shopping list.

    Returns:
        ShoppingList: Weekly groceries list (shared, creator_id for audit)
    """
    from backend.app.models.shopping_list import ShoppingList

    shopping_list = ShoppingList(
        creator_id=test_user.id,
        name="Weekly Groceries",
        description="Shopping list for the week",
        is_active=True,
    )
    session.add(shopping_list)
    await session.commit()
    await session.refresh(shopping_list)
    return shopping_list


@pytest_asyncio.fixture
async def test_shopping_list_item(
    session: AsyncSession,
    test_user: User,
    test_shopping_list,
    test_store,
    test_product_group_root,
):
    """
    Create test shopping list item.

    Returns:
        ShoppingListItem: Tomatoes item (shared, creator_id for audit)
    """
    from decimal import Decimal

    from backend.app.models.shopping_list_item import ShoppingListItem

    item = ShoppingListItem(
        creator_id=test_user.id,
        shopping_list_id=test_shopping_list.id,
        store_id=test_store.id,
        product_group_id=test_product_group_root.id,
        product_name="Tomatoes",
        quantity=Decimal("2.5"),
        unit="kg",
        comment="Fresh red tomatoes",
        is_completed=False,
        sync_status="synced",
    )
    session.add(item)
    await session.commit()
    await session.refresh(item)
    return item


@pytest_asyncio.fixture
async def test_import_template(session: AsyncSession, test_user: User):
    """
    Create test import template (user-specific).

    Returns:
        ImportTemplate: CSV import template for user
    """
    from backend.app.models.import_template import ImportTemplate

    template = ImportTemplate(
        user_id=test_user.id,
        name="My CSV Template",
        config={
            "delimiter": ",",
            "column_mapping": {
                "store": "Store",
                "product_group": "Category",
                "product_name": "Product",
                "quantity": "Qty",
                "unit": "Unit",
            },
        },
    )
    session.add(template)
    await session.commit()
    await session.refresh(template)
    return template


@pytest_asyncio.fixture
async def test_financial_center(session: AsyncSession, test_user: User):
    """
    Create test financial center (account/wallet).

    Returns:
        FinancialCenter: Test account (user-specific, active)
    """
    from backend.app.models.financial_center import FinancialCenter

    fc = FinancialCenter(
        user_id=test_user.id,
        name="Test Account",
        is_active=True,
    )
    session.add(fc)
    await session.commit()
    await session.refresh(fc)
    return fc
