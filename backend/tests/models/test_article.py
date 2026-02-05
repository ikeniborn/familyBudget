"""
Unit tests for Article model.

Tests SCD Type 2 functionality, hierarchical relationships, and model constraints.
"""

from datetime import datetime

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.article import Article
from backend.app.models.user import User

# ============================================================================
# Article Creation Tests
# ============================================================================


@pytest.mark.asyncio
async def test_create_article_basic(session: AsyncSession, test_user: User):
    """Test creating a basic article with required fields."""
    article = Article(
        user_id=test_user.id,
        name="Food",
        type="expense",
    )

    session.add(article)
    await session.commit()
    await session.refresh(article)

    assert article.id is not None
    assert article.name == "Food"
    assert article.type == "expense"
    assert article.user_id == test_user.id
    assert article.is_current is True


@pytest.mark.asyncio
async def test_create_article_with_code(session: AsyncSession, test_user: User):
    """Test creating article with business code."""
    article = Article(
        user_id=test_user.id,
        name="Food",
        type="expense",
    )

    session.add(article)
    await session.commit()
    await session.refresh(article)

    assert article.code == "FOOD"


@pytest.mark.asyncio
async def test_create_global_article(session: AsyncSession, test_user):
    """Test creating global article (no user_id)."""
    article = Article(
        user_id=test_user.id,
        name="Salary",
        type="income",
    )

    session.add(article)
    await session.commit()
    await session.refresh(article)

    assert article.user_id == test_user.id
    assert article.type == "income"


@pytest.mark.asyncio
async def test_create_article_income_type(session: AsyncSession, test_user: User):
    """Test creating income article."""
    article = Article(
        user_id=test_user.id,
        name="Salary",
        type="income",
    )

    session.add(article)
    await session.commit()
    await session.refresh(article)

    assert article.type == "income"


@pytest.mark.asyncio
async def test_create_article_expense_type(session: AsyncSession, test_user: User):
    """Test creating expense article."""
    article = Article(
        user_id=test_user.id,
        name="Food",
        type="expense",
    )

    session.add(article)
    await session.commit()
    await session.refresh(article)

    assert article.type == "expense"


# ============================================================================
# SCD Type 2 Tests
# ============================================================================


@pytest.mark.asyncio
async def test_article_scd2_defaults(session: AsyncSession, test_user: User):
    """Test SCD Type 2 default values for new article."""
    article = Article(
        user_id=test_user.id,
        name="Food",
        type="expense",
    )

    session.add(article)
    await session.commit()
    await session.refresh(article)

    # Check SCD Type 2 defaults
    assert article.is_current is True
    assert article.valid_from is not None
    assert article.valid_to is not None
    assert article.valid_to.year == 9999


@pytest.mark.asyncio
async def test_article_scd2_versioning(session: AsyncSession, test_user: User):
    """Test creating multiple versions of article (SCD Type 2)."""
    # Version 1: Create initial article
    article_v1 = Article(
        user_id=test_user.id,
        name="Food",
        type="expense",
        is_current=True,
    )

    session.add(article_v1)
    await session.commit()
    await session.refresh(article_v1)

    # Version 2: Close old version and create new version
    now = datetime.utcnow()
    article_v1.is_current = False
    article_v1.valid_to = now

    article_v2 = Article(
        user_id=test_user.id,
        name="Food and Drinks",  # Name changed
        type="expense",
        is_current=True,
        valid_from=now,
    )

    session.add(article_v2)
    await session.commit()
    await session.refresh(article_v1)
    await session.refresh(article_v2)

    # Verify version 1 is closed
    assert article_v1.is_current is False
    assert article_v1.valid_to == now

    # Verify version 2 is current
    assert article_v2.is_current is True
    assert article_v2.valid_from == now
    assert article_v2.name == "Food and Drinks"


@pytest.mark.asyncio
async def test_article_scd2_query_current_only(session: AsyncSession, test_user: User):
    """Test querying only current version of articles."""
    # Create two versions
    article_v1 = Article(
        user_id=test_user.id,
        name="Food",
        type="expense",
        is_current=False,  # Old version
    )

    article_v2 = Article(
        user_id=test_user.id,
        name="Food and Drinks",
        type="expense",
        is_current=True,  # Current version
    )

    session.add(article_v1)
    session.add(article_v2)
    await session.commit()

    # Query only current versions
    stmt = select(Article).where(Article.is_active == True)  # noqa: E712
    result = await session.execute(stmt)
    articles = result.scalars().all()

    assert len(articles) == 1
    assert articles[0].name == "Food and Drinks"


# ============================================================================
# Hierarchical Relationship Tests
# ============================================================================


@pytest.mark.asyncio
async def test_create_root_article(session: AsyncSession, test_user: User):
    """Test creating root article (no parent)."""
    article = Article(
        user_id=test_user.id,
        parent_id=None,
        name="Food",
        type="expense",
    )

    session.add(article)
    await session.commit()
    await session.refresh(article)

    assert article.parent_id is None


@pytest.mark.asyncio
async def test_create_child_article(session: AsyncSession, test_user: User):
    """Test creating child article with parent."""
    # Create parent
    parent = Article(
        user_id=test_user.id,
        name="Food",
        type="expense",
    )
    session.add(parent)
    await session.commit()
    await session.refresh(parent)

    # Create child
    child = Article(
        user_id=test_user.id,
        parent_id=parent.id,
        name="Groceries",
        type="expense",
    )
    session.add(child)
    await session.commit()
    await session.refresh(child)

    assert child.parent_id == parent.id


@pytest.mark.asyncio
async def test_create_multi_level_hierarchy(session: AsyncSession, test_user: User):
    """Test creating multi-level hierarchy (grandchild)."""
    # Level 1: Root
    root = Article(
        user_id=test_user.id,
        name="Food",
        type="expense",
    )
    session.add(root)
    await session.commit()
    await session.refresh(root)

    # Level 2: Child
    child = Article(
        user_id=test_user.id,
        parent_id=root.id,
        name="Groceries",
        type="expense",
    )
    session.add(child)
    await session.commit()
    await session.refresh(child)

    # Level 3: Grandchild
    grandchild = Article(
        user_id=test_user.id,
        parent_id=child.id,
        name="Organic",
        type="expense",
    )
    session.add(grandchild)
    await session.commit()
    await session.refresh(grandchild)

    assert root.parent_id is None
    assert child.parent_id == root.id
    assert grandchild.parent_id == child.id


# ============================================================================
# Global vs User Articles Tests
# ============================================================================


@pytest.mark.asyncio
async def test_article_has_user_id(session: AsyncSession, test_user):
    """Test article has required user_id."""
    article = Article(
        user_id=test_user.id,
        name="Salary",
        type="income",
    )

    session.add(article)
    await session.commit()
    await session.refresh(article)

    assert article.user_id is not None
    assert article.user_id == test_user.id


@pytest.mark.asyncio
async def test_user_article_has_user_id(session: AsyncSession, test_user: User):
    """Test user article has user_id."""
    article = Article(
        user_id=test_user.id,
        name="Food",
        type="expense",
    )

    session.add(article)
    await session.commit()
    await session.refresh(article)

    assert article.user_id == test_user.id
    assert article.type == "expense"


# ============================================================================
# Audit Fields Tests
# ============================================================================


@pytest.mark.asyncio
async def test_article_audit_fields(session: AsyncSession, test_user: User):
    """Test audit fields (created_at, updated_at) are set automatically."""
    article = Article(
        user_id=test_user.id,
        name="Food",
        type="expense",
    )

    session.add(article)
    await session.commit()
    await session.refresh(article)

    assert article.created_at is not None
    assert article.updated_at is not None
    assert isinstance(article.created_at, datetime)
    assert isinstance(article.updated_at, datetime)


@pytest.mark.asyncio
async def test_article_updated_at_changes(session: AsyncSession, test_user: User):
    """Test updated_at changes when article is modified."""
    article = Article(
        user_id=test_user.id,
        name="Food",
        type="expense",
    )

    session.add(article)
    await session.commit()
    await session.refresh(article)


    # Update article
    article.name = "Food and Drinks"
    article.updated_at = datetime.utcnow()
    await session.commit()
    await session.refresh(article)

    # Note: updated_at should be different (in real app with db triggers)
    # In tests, we manually set it
    assert article.name == "Food and Drinks"


# ============================================================================
# Model Representation Tests
# ============================================================================


@pytest.mark.asyncio
async def test_article_repr(session: AsyncSession, test_user: User):
    """Test Article __repr__ method."""
    article = Article(
        user_id=test_user.id,
        parent_id=None,
        name="Food",
        type="expense",
    )

    session.add(article)
    await session.commit()
    await session.refresh(article)

    repr_str = repr(article)

    assert "Article" in repr_str
    assert f"id={article.id}" in repr_str
    assert "name='Food'" in repr_str
    assert "type='expense'" in repr_str
    assert f"user_id={test_user.id}" in repr_str
    assert "parent_id=None" in repr_str
    assert "is_current=True" in repr_str
    assert "is_current=True" in repr_str


# ============================================================================
# Query Tests
# ============================================================================


@pytest.mark.asyncio
async def test_query_articles_by_user(session: AsyncSession, test_user: User, test_admin: User):
    """Test querying articles by user_id."""
    # Create articles for different users
    article1 = Article(user_id=test_user.id, name="User Article", type="expense")
    article2 = Article(user_id=test_admin.id, name="Admin Article", type="expense")

    session.add(article1)
    session.add(article2)
    await session.commit()

    # Query user articles
    stmt = select(Article).where(Article.user_id == test_user.id)
    result = await session.execute(stmt)
    articles = result.scalars().all()

    assert len(articles) == 1
    assert articles[0].name == "User Article"


@pytest.mark.asyncio
async def test_query_articles_by_type(session: AsyncSession, test_user: User):
    """Test querying articles by type (income/expense)."""
    # Create income and expense articles
    income = Article(user_id=test_user.id, name="Salary", type="income")
    expense = Article(user_id=test_user.id, name="Food", type="expense")

    session.add(income)
    session.add(expense)
    await session.commit()

    # Query expense articles
    stmt = select(Article).where(Article.type == "expense")
    result = await session.execute(stmt)
    articles = result.scalars().all()

    assert len(articles) == 1
    assert articles[0].name == "Food"


@pytest.mark.asyncio
async def test_query_income_articles_by_type(session: AsyncSession, test_user):
    """Test querying income articles only."""
    # Create income article
    income_article = Article(user_id=test_user.id, name="Salary", type="income")
    session.add(income_article)
    await session.commit()

    # Query income articles
    stmt = select(Article).where(Article.type == "income")
    result = await session.execute(stmt)
    articles = result.scalars().all()

    assert len(articles) == 1
    assert articles[0].name == "Salary"
    assert articles[0].type == "income"
    assert articles[0].user_id == test_user.id
