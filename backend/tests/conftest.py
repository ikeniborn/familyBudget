"""
Shared test fixtures and configuration.

This module provides pytest fixtures for database setup, session management,
common test data, and HTTP client fixtures for API endpoint testing.
"""

import asyncio
from datetime import datetime
from typing import AsyncGenerator, Generator

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool
from sqlmodel import SQLModel

from backend.app.main import app
from backend.app.models.article import Article
from backend.app.models.fact import BudgetFact
from backend.app.models.hierarchy import ArticleHierarchy
from backend.app.models.user import User
from backend.app.services.jwt import create_access_token

# Test database URL (SQLite in-memory for fast tests)
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


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
    Uses in-memory SQLite for fast tests.
    """
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,  # Set to True for SQL debugging
        poolclass=NullPool,  # Disable connection pooling for tests
    )

    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    yield engine

    # Cleanup: drop all tables
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)

    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def session(engine) -> AsyncGenerator[AsyncSession, None]:
    """
    Create async database session for tests.

    Scope: function - new session for each test (isolation).
    Automatically rolls back after each test.
    """
    async with AsyncSession(engine, expire_on_commit=False) as session:
        yield session
        await session.rollback()


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
        is_current=True,
        valid_from=datetime.utcnow(),
        valid_to=datetime(9999, 12, 31, 23, 59, 59),
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
        is_current=True,
        valid_from=datetime.utcnow(),
        valid_to=datetime(9999, 12, 31, 23, 59, 59),
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
        Article: Food category (expense, current version)
    """
    article = Article(
        user_id=test_user.id,
        parent_id=None,
        code="FOOD",
        name="Food",
        type="expense",
        is_global=False,
        is_current=True,
        valid_from=datetime.utcnow(),
        valid_to=datetime(9999, 12, 31, 23, 59, 59),
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
        Article: Groceries category (child of Food)
    """
    article = Article(
        user_id=test_user.id,
        parent_id=test_article_root.id,
        code="GROCERIES",
        name="Groceries",
        type="expense",
        is_global=False,
        is_current=True,
        valid_from=datetime.utcnow(),
        valid_to=datetime(9999, 12, 31, 23, 59, 59),
    )
    session.add(article)
    await session.commit()
    await session.refresh(article)
    return article


@pytest_asyncio.fixture
async def test_global_article(session: AsyncSession) -> Article:
    """
    Create test global article (shared across users).

    Returns:
        Article: Salary category (income, global, current version)
    """
    article = Article(
        user_id=None,  # NULL for global articles
        parent_id=None,
        code="SALARY",
        name="Salary",
        type="income",
        is_global=True,
        is_current=True,
        valid_from=datetime.utcnow(),
        valid_to=datetime(9999, 12, 31, 23, 59, 59),
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
async def client(engine) -> AsyncGenerator[AsyncClient, None]:
    """
    Create unauthenticated HTTP client for API testing.

    Uses FastAPI TestClient with async support via httpx.AsyncClient.
    Database session is overridden to use test database.

    Returns:
        AsyncClient: HTTP client without authentication

    Example:
        async def test_endpoint(client: AsyncClient):
            response = await client.get("/api/v1/articles")
            assert response.status_code == 401  # Requires authentication
    """
    from backend.app.core.dependencies import get_session

    # Override get_session dependency to use test database
    async def override_get_session() -> AsyncGenerator[AsyncSession, None]:
        async with AsyncSession(engine, expire_on_commit=False) as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session

    # Create HTTP client
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

    # Cleanup
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def auth_client(
    engine, test_user: User
) -> AsyncGenerator[AsyncClient, None]:
    """
    Create authenticated HTTP client for regular user.

    Creates JWT token for test_user and includes it in cookies.
    All requests will be authenticated as regular user (not admin).

    Returns:
        AsyncClient: HTTP client authenticated as test_user

    Example:
        async def test_endpoint(auth_client: AsyncClient):
            response = await auth_client.get("/api/v1/facts")
            assert response.status_code == 200  # Authenticated
    """
    from backend.app.core.dependencies import get_session

    # Override get_session dependency
    async def override_get_session() -> AsyncGenerator[AsyncSession, None]:
        async with AsyncSession(engine, expire_on_commit=False) as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session

    # Create JWT token for test_user
    access_token = create_access_token(user_id=test_user.id)

    # Create HTTP client with authentication cookie
    async with AsyncClient(app=app, base_url="http://test") as ac:
        ac.cookies.set("access_token", access_token)
        yield ac

    # Cleanup
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def admin_client(
    engine, test_admin: User
) -> AsyncGenerator[AsyncClient, None]:
    """
    Create authenticated HTTP client for admin user.

    Creates JWT token for test_admin and includes it in cookies.
    All requests will be authenticated as admin user.

    Returns:
        AsyncClient: HTTP client authenticated as test_admin

    Example:
        async def test_endpoint(admin_client: AsyncClient):
            response = await admin_client.get("/api/v1/users")
            assert response.status_code == 200  # Admin only endpoint
    """
    from backend.app.core.dependencies import get_session

    # Override get_session dependency
    async def override_get_session() -> AsyncGenerator[AsyncSession, None]:
        async with AsyncSession(engine, expire_on_commit=False) as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session

    # Create JWT token for test_admin
    access_token = create_access_token(user_id=test_admin.id)

    # Create HTTP client with authentication cookie
    async with AsyncClient(app=app, base_url="http://test") as ac:
        ac.cookies.set("access_token", access_token)
        yield ac

    # Cleanup
    app.dependency_overrides.clear()
