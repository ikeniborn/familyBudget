"""
Integration tests for SCD Type 2 versioning workflows.

Tests complete versioning scenarios across all entities:
1. User versioning (username, name changes)
2. Article versioning (code, name, type changes)
3. Fact versioning (amount, date, description changes)
4. Historical queries (point-in-time data access)
5. Version chains (valid_from/valid_to correctness)
6. Cross-model versioning (related entities)

These tests verify SCD Type 2 implementation works correctly end-to-end.
"""

from datetime import datetime, timezone
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.models.article import Article
from backend.app.models.article_history import ArticleHistory
from backend.app.models.fact import BudgetFact
from backend.app.models.user import User

# ============================================================================
# User Versioning Tests
# ============================================================================


@pytest.mark.asyncio
async def test_user_versioning_username_change(client: AsyncClient, session: AsyncSession):
    """
    Test user versioning when username changes (via Telegram re-auth).

    Workflow:
    1. User authenticates (username="alice")
    2. User changes username in Telegram to "alice_updated"
    3. User re-authenticates
    4. Verify two versions exist: old (is_current=False) and new (is_current=True)
    """
    import hashlib
    import hmac
    import time

    from backend.app.core.config import get_settings

    settings = get_settings()

    # Step 1: First authentication (username="alice")
    telegram_id = 111222333
    auth_date = int(time.time())

    auth_data_v1 = {
        "id": str(telegram_id),
        "first_name": "Alice",
        "username": "alice",
        "auth_date": str(auth_date),
    }

    # Compute valid hash
    data_check_string = "\n".join(
        [f"{key}={value}" for key, value in sorted(auth_data_v1.items())]
    )
    secret_key = hashlib.sha256(settings.TELEGRAM_BOT_TOKEN.encode()).digest()
    computed_hash = hmac.new(
        key=secret_key, msg=data_check_string.encode(), digestmod=hashlib.sha256
    ).hexdigest()
    auth_data_v1["hash"] = computed_hash

    login1_response = await client.post("/api/v1/auth/telegram", json=auth_data_v1)
    assert login1_response.status_code == 200

    # Step 2: Second authentication (username changed to "alice_updated")
    auth_date2 = int(time.time()) + 1

    auth_data_v2 = {
        "id": str(telegram_id),
        "first_name": "Alice",
        "username": "alice_updated",  # Changed
        "auth_date": str(auth_date2),
    }

    data_check_string2 = "\n".join(
        [f"{key}={value}" for key, value in sorted(auth_data_v2.items())]
    )
    computed_hash2 = hmac.new(
        key=secret_key, msg=data_check_string2.encode(), digestmod=hashlib.sha256
    ).hexdigest()
    auth_data_v2["hash"] = computed_hash2

    login2_response = await client.post("/api/v1/auth/telegram", json=auth_data_v2)
    assert login2_response.status_code == 200

    # Step 3: Verify two versions exist
    stmt = select(User).where(User.telegram_id == telegram_id)
    result = await session.execute(stmt)
    users = result.scalars().all()

    assert len(users) == 2

    # Old version: username="alice", is_current=False
    old_version = [u for u in users if not u.is_current][0]
    assert old_version.username == "alice"
    assert old_version.is_current is False
    assert old_version.valid_to < datetime(9999, 1, 1)

    # New version: username="alice_updated", is_current=True
    new_version = [u for u in users if u.is_current][0]
    assert new_version.username == "alice_updated"
    assert new_version.is_current is True
    assert new_version.valid_to.year == 9999


@pytest.mark.asyncio
async def test_user_versioning_name_change(client: AsyncClient, session: AsyncSession):
    """
    Test user versioning when first_name or last_name changes.

    Workflow:
    1. User authenticates (first_name="Bob")
    2. User changes name in Telegram to "Robert"
    3. User re-authenticates
    4. Verify new version created
    """
    import hashlib
    import hmac
    import time

    from backend.app.core.config import get_settings

    settings = get_settings()
    telegram_id = 222333444

    # First login
    auth_date = int(time.time())
    auth_data_v1 = {
        "id": str(telegram_id),
        "first_name": "Bob",
        "username": "bob",
        "auth_date": str(auth_date),
    }

    data_check_string = "\n".join(
        [f"{key}={value}" for key, value in sorted(auth_data_v1.items())]
    )
    secret_key = hashlib.sha256(settings.TELEGRAM_BOT_TOKEN.encode()).digest()
    computed_hash = hmac.new(
        key=secret_key, msg=data_check_string.encode(), digestmod=hashlib.sha256
    ).hexdigest()
    auth_data_v1["hash"] = computed_hash

    await client.post("/api/v1/auth/telegram", json=auth_data_v1)

    # Second login with changed name
    auth_date2 = int(time.time()) + 1
    auth_data_v2 = {
        "id": str(telegram_id),
        "first_name": "Robert",  # Changed
        "username": "bob",
        "auth_date": str(auth_date2),
    }

    data_check_string2 = "\n".join(
        [f"{key}={value}" for key, value in sorted(auth_data_v2.items())]
    )
    computed_hash2 = hmac.new(
        key=secret_key, msg=data_check_string2.encode(), digestmod=hashlib.sha256
    ).hexdigest()
    auth_data_v2["hash"] = computed_hash2

    await client.post("/api/v1/auth/telegram", json=auth_data_v2)

    # Verify two versions
    stmt = select(User).where(User.telegram_id == telegram_id)
    result = await session.execute(stmt)
    users = result.scalars().all()

    assert len(users) == 2

    old_version = [u for u in users if u.first_name == "Bob"][0]
    new_version = [u for u in users if u.first_name == "Robert"][0]

    assert old_version.is_current is False
    assert new_version.is_current is True


# ============================================================================
# Article Versioning Tests
# ============================================================================


@pytest.mark.asyncio
async def test_article_versioning_name_change(auth_client: AsyncClient, admin_client: AsyncClient, session: AsyncSession):
    """
    Test article versioning when name changes.

    Workflow:
    1. Create article (name="Food")
    2. Update article (name="Food & Dining")
    3. Verify two versions exist
    4. Verify version timestamps correct
    """
    # Create article
    create_response = await auth_client.post(
        "/api/v1/articles",
        json={"name": "Food", "type": "expense", "parent_id": None},
    )
    article_id = create_response.json()["id"]

    # Update article name (admin-only operation)
    update_response = await admin_client.put(
        f"/api/v1/articles/{article_id}",
        json={"name": "Food & Dining"},
    )

    assert update_response.status_code == 200

    # Verify two versions exist in ArticleHistory (SCD Type 2)
    stmt = select(ArticleHistory).where(ArticleHistory.article_id == article_id)
    result = await session.execute(stmt)
    articles = result.scalars().all()

    assert len(articles) == 2

    # Old version (CREATE record, closed by UPDATE)
    old_version = [a for a in articles if a.name == "Food"][0]
    assert old_version.is_current is False
    assert old_version.valid_to < datetime(9999, 1, 1, tzinfo=timezone.utc)

    # New version (UPDATE record, currently active)
    new_version = [a for a in articles if a.name == "Food & Dining"][0]
    assert new_version.is_current is True
    assert new_version.valid_to.year == 9999

    # Verify timestamps: old.valid_to ~= new.valid_from
    time_diff = abs((new_version.valid_from - old_version.valid_to).total_seconds())
    assert time_diff < 5  # Within 5 seconds


@pytest.mark.asyncio
async def test_article_versioning_code_change(auth_client: AsyncClient, admin_client: AsyncClient, session: AsyncSession):
    """
    Test article versioning when name changes.

    Workflow:
    1. Create article (name="Transport")
    2. Update article (name="Transportation")
    3. Verify new version created in ArticleHistory
    """
    # Create article
    create_response = await auth_client.post(
        "/api/v1/articles",
        json={"name": "Transport", "type": "expense", "parent_id": None},
    )
    article_id = create_response.json()["id"]

    # Update name (admin-only operation)
    update_response = await admin_client.put(
        f"/api/v1/articles/{article_id}",
        json={"name": "Transportation"},
    )

    assert update_response.status_code == 200

    # Verify two versions exist in ArticleHistory (SCD Type 2)
    stmt = select(ArticleHistory).where(ArticleHistory.article_id == article_id)
    result = await session.execute(stmt)
    articles = result.scalars().all()

    assert len(articles) == 2

    names = {a.name for a in articles}
    assert "Transport" in names
    assert "Transportation" in names


@pytest.mark.asyncio
async def test_article_versioning_multiple_updates(
    auth_client: AsyncClient, admin_client: AsyncClient, session: AsyncSession
):
    """
    Test article versioning with multiple sequential updates.

    Workflow:
    1. Create article (name="V1")
    2. Update to "V2"
    3. Update to "V3"
    4. Verify three versions exist
    5. Verify only latest has is_current=True
    """
    # Create article
    create_response = await auth_client.post(
        "/api/v1/articles",
        json={"name": "V1", "type": "expense", "parent_id": None},
    )
    article_id = create_response.json()["id"]

    # Update to V2 (admin-only operation)
    await admin_client.put(f"/api/v1/articles/{article_id}", json={"name": "V2"})

    # Update to V3
    await admin_client.put(f"/api/v1/articles/{article_id}", json={"name": "V3"})

    # Verify three versions in ArticleHistory (SCD Type 2)
    stmt = select(ArticleHistory).where(ArticleHistory.article_id == article_id)
    result = await session.execute(stmt)
    articles = result.scalars().all()

    assert len(articles) == 3

    # Only latest version should have is_current=True
    current_versions = [a for a in articles if a.is_current]
    assert len(current_versions) == 1
    assert current_versions[0].name == "V3"

    # Historical versions should have is_current=False
    historical = [a for a in articles if not a.is_current]
    assert len(historical) == 2
    names = {a.name for a in historical}
    assert "V1" in names
    assert "V2" in names


# ============================================================================
# Fact Versioning Tests
# ============================================================================


@pytest.mark.asyncio
async def test_fact_versioning_amount_change(auth_client: AsyncClient, session: AsyncSession):
    """
    Test fact versioning when amount changes.

    Workflow:
    1. Create fact (amount=100.00)
    2. Update fact (amount=150.00)
    3. Verify two versions exist
    4. Verify timestamps correct
    """
    # Create article
    article_response = await auth_client.post(
        "/api/v1/articles",
        json={"code": "GROCERIES", "name": "Groceries", "type": "expense", "parent_id": None},
    )
    article_id = article_response.json()["id"]

    # Create fact
    create_response = await auth_client.post(
        "/api/v1/facts",
        json={
            "article_id": article_id,
            "fact_date": "2025-10-13",
            "amount": "100.00",
        },
    )
    fact_id = create_response.json()["id"]

    # Update amount
    update_response = await auth_client.put(
        f"/api/v1/facts/{fact_id}",
        json={"amount": "150.00"},
    )

    assert update_response.status_code == 200

    # Verify two versions
    stmt = select(BudgetFact).where(BudgetFact.id == fact_id)
    result = await session.execute(stmt)
    facts = result.scalars().all()

    assert len(facts) == 2

    # Old version
    old_version = [f for f in facts if f.amount == Decimal("100.00")][0]
    assert old_version.is_current is False

    # New version
    new_version = [f for f in facts if f.amount == Decimal("150.00")][0]
    assert new_version.is_current is True


@pytest.mark.asyncio
async def test_fact_versioning_description_change(
    auth_client: AsyncClient, session: AsyncSession
):
    """
    Test fact versioning when description changes.

    Workflow:
    1. Create fact (description="Original")
    2. Update fact (description="Updated")
    3. Verify new version created
    """
    # Create article
    article_response = await auth_client.post(
        "/api/v1/articles",
        json={"code": "SHOPPING", "name": "Shopping", "type": "expense", "parent_id": None},
    )
    article_id = article_response.json()["id"]

    # Create fact
    create_response = await auth_client.post(
        "/api/v1/facts",
        json={
            "article_id": article_id,
            "fact_date": "2025-10-13",
            "amount": "200.00",
            "description": "Original description",
        },
    )
    fact_id = create_response.json()["id"]

    # Update description
    await auth_client.put(
        f"/api/v1/facts/{fact_id}",
        json={"description": "Updated description"},
    )

    # Verify two versions
    stmt = select(BudgetFact).where(BudgetFact.id == fact_id)
    result = await session.execute(stmt)
    facts = result.scalars().all()

    assert len(facts) == 2

    descriptions = {f.description for f in facts}
    assert "Original description" in descriptions
    assert "Updated description" in descriptions


@pytest.mark.asyncio
async def test_fact_versioning_date_change(auth_client: AsyncClient, session: AsyncSession):
    """
    Test fact versioning when fact_date changes.

    Workflow:
    1. Create fact (date=2025-10-13)
    2. Update fact (date=2025-10-15)
    3. Verify new version created
    """
    # Create article
    article_response = await auth_client.post(
        "/api/v1/articles",
        json={"code": "DINING", "name": "Dining", "type": "expense", "parent_id": None},
    )
    article_id = article_response.json()["id"]

    # Create fact
    create_response = await auth_client.post(
        "/api/v1/facts",
        json={
            "article_id": article_id,
            "fact_date": "2025-10-13",
            "amount": "75.00",
        },
    )
    fact_id = create_response.json()["id"]

    # Update date
    await auth_client.put(
        f"/api/v1/facts/{fact_id}",
        json={"fact_date": "2025-10-15"},
    )

    # Verify two versions
    stmt = select(BudgetFact).where(BudgetFact.id == fact_id)
    result = await session.execute(stmt)
    facts = result.scalars().all()

    assert len(facts) == 2

    dates = {f.fact_date for f in facts}
    from datetime import date

    assert date(2025, 10, 13) in dates
    assert date(2025, 10, 15) in dates


# ============================================================================
# Historical Query Tests
# ============================================================================


@pytest.mark.asyncio
async def test_historical_query_article_at_point_in_time(
    auth_client: AsyncClient, admin_client: AsyncClient, session: AsyncSession
):
    """
    Test querying article data as it existed at a specific point in time.

    Workflow:
    1. Create article (name="V1") at T1
    2. Update to "V2" at T2
    3. Query for article as it existed at T1
    4. Verify "V1" data returned
    """
    # Create article (V1)
    create_response = await auth_client.post(
        "/api/v1/articles",
        json={"name": "V1", "type": "expense", "parent_id": None},
    )
    article_id = create_response.json()["id"]

    # Capture T1 from CREATE history record (timezone-aware valid_from)
    stmt_create = select(ArticleHistory).where(
        ArticleHistory.article_id == article_id,
        ArticleHistory.change_type == "CREATE",
    )
    result_create = await session.execute(stmt_create)
    create_record = result_create.scalar_one()
    t1 = create_record.valid_from  # timezone-aware UTC datetime

    # Update to V2 (admin-only operation)
    await admin_client.put(f"/api/v1/articles/{article_id}", json={"name": "V2"})

    # Query ArticleHistory at T1 (should return V1 version)
    stmt_historical = (
        select(ArticleHistory)
        .where(ArticleHistory.article_id == article_id)
        .where(ArticleHistory.valid_from <= t1)
        .where(ArticleHistory.valid_to > t1)
    )
    result_historical = await session.execute(stmt_historical)
    historical_article = result_historical.scalar_one()

    assert historical_article.name == "V1"


@pytest.mark.asyncio
async def test_current_query_always_returns_latest_version(
    auth_client: AsyncClient, admin_client: AsyncClient, session: AsyncSession
):
    """
    Test that queries with is_current=True always return latest version.

    Workflow:
    1. Create article
    2. Update multiple times
    3. Query with is_current=True
    4. Verify only latest version returned
    """
    # Create and update article multiple times
    create_response = await auth_client.post(
        "/api/v1/articles",
        json={"name": "V1", "type": "expense", "parent_id": None},
    )
    article_id = create_response.json()["id"]

    await admin_client.put(f"/api/v1/articles/{article_id}", json={"name": "V2"})
    await admin_client.put(f"/api/v1/articles/{article_id}", json={"name": "V3"})
    await admin_client.put(f"/api/v1/articles/{article_id}", json={"name": "V4"})

    # Query current version
    stmt = select(Article).where(Article.id == article_id, Article.is_active)
    result = await session.execute(stmt)
    current_article = result.scalar_one()

    # Should be V4 (latest)
    assert current_article.name == "V4"


# ============================================================================
# Deletion and Versioning Tests
# ============================================================================


@pytest.mark.asyncio
async def test_soft_delete_creates_final_version(
    auth_client: AsyncClient, admin_client: AsyncClient, session: AsyncSession
):
    """
    Test that soft delete (admin only) archives article and creates ARCHIVE history record.

    Soft delete is a SCD Type 1 operation: sets Article.is_active=False.
    archive_recursive() also creates an ArticleHistory record with change_type='ARCHIVE'.

    Workflow:
    1. Create article → CREATE history record (is_current=True)
    2. Soft delete (admin) → Article.is_active=False + ARCHIVE history record (is_current=False)
    3. Verify Article is archived
    4. Verify ARCHIVE history record exists
    """
    # Create article
    create_response = await auth_client.post(
        "/api/v1/articles",
        json={"name": "To Delete", "type": "expense", "parent_id": None},
    )
    article_id = create_response.json()["id"]

    # Soft delete (admin-only operation)
    delete_response = await admin_client.delete(f"/api/v1/articles/{article_id}")
    assert delete_response.status_code == 204

    # Verify article is archived (SCD Type 1: in-place update)
    stmt = select(Article).where(Article.id == article_id)
    result = await session.execute(stmt)
    article = result.scalar_one()
    assert article.is_active is False

    # Verify ArticleHistory: CREATE record + ARCHIVE record
    stmt_history = (
        select(ArticleHistory)
        .where(ArticleHistory.article_id == article_id)
        .order_by(ArticleHistory.valid_from)
    )
    result_history = await session.execute(stmt_history)
    histories = result_history.scalars().all()

    assert len(histories) == 2  # CREATE + ARCHIVE
    change_types = {h.change_type for h in histories}
    assert "CREATE" in change_types
    assert "ARCHIVE" in change_types

    # ARCHIVE record has is_current=False (audit trail, not a live version)
    archive_record = next(h for h in histories if h.change_type == "ARCHIVE")
    assert archive_record.is_current is False
    assert "is_active" in (archive_record.changed_fields or [])


# ============================================================================
# Version Chain Integrity Tests
# ============================================================================


@pytest.mark.asyncio
async def test_version_chain_no_gaps(auth_client: AsyncClient, admin_client: AsyncClient, session: AsyncSession):
    """
    Test that version chains have no gaps (valid_to of V1 = valid_from of V2).

    Workflow:
    1. Create article
    2. Update multiple times
    3. Verify version chain has no time gaps
    """
    # Create article
    create_response = await auth_client.post(
        "/api/v1/articles",
        json={"name": "V1", "type": "expense", "parent_id": None},
    )
    article_id = create_response.json()["id"]

    # Multiple updates (admin-only operation)
    await admin_client.put(f"/api/v1/articles/{article_id}", json={"name": "V2"})
    await admin_client.put(f"/api/v1/articles/{article_id}", json={"name": "V3"})

    # Get all versions from ArticleHistory sorted by valid_from
    stmt = (
        select(ArticleHistory)
        .where(ArticleHistory.article_id == article_id)
        .order_by(ArticleHistory.valid_from)
    )
    result = await session.execute(stmt)
    versions = result.scalars().all()

    # Check version chain continuity (CREATE → V2 → V3)
    for i in range(len(versions) - 1):
        current_version = versions[i]
        next_version = versions[i + 1]

        # valid_to of closed version should equal valid_from of next (within tolerance)
        time_diff = abs((next_version.valid_from - current_version.valid_to).total_seconds())
        assert time_diff < 5  # Within 5 seconds tolerance


@pytest.mark.asyncio
async def test_version_chain_ordered_by_time(auth_client: AsyncClient, admin_client: AsyncClient, session: AsyncSession):
    """
    Test that versions are correctly ordered chronologically.

    Workflow:
    1. Create article
    2. Update multiple times
    3. Verify versions ordered by valid_from ascending
    """
    # Create article
    create_response = await auth_client.post(
        "/api/v1/articles",
        json={"name": "V1", "type": "expense", "parent_id": None},
    )
    article_id = create_response.json()["id"]

    # Multiple updates (admin-only operation)
    await admin_client.put(f"/api/v1/articles/{article_id}", json={"name": "V2"})
    await admin_client.put(f"/api/v1/articles/{article_id}", json={"name": "V3"})

    # Get all versions from ArticleHistory ordered by valid_from
    stmt = (
        select(ArticleHistory)
        .where(ArticleHistory.article_id == article_id)
        .order_by(ArticleHistory.valid_from)
    )
    result = await session.execute(stmt)
    versions = result.scalars().all()

    # Verify chronological order (CREATE → V2 → V3)
    names = [v.name for v in versions]
    assert names == ["V1", "V2", "V3"]

    # Verify timestamps are ascending
    for i in range(len(versions) - 1):
        assert versions[i].valid_from < versions[i + 1].valid_from


# ============================================================================
# Cross-Model Versioning Tests
# ============================================================================


@pytest.mark.asyncio
async def test_fact_references_current_article_version(
    auth_client: AsyncClient, admin_client: AsyncClient, session: AsyncSession
):
    """
    Test that facts reference articles correctly even when article is versioned.

    Workflow:
    1. Create article (V1)
    2. Create fact linked to article
    3. Update article (V2)
    4. Verify fact still accessible
    5. Verify fact references correct article ID (not version-specific)
    """
    # Create article
    article_response = await auth_client.post(
        "/api/v1/articles",
        json={"code": "CROSS", "name": "V1", "type": "expense", "parent_id": None},
    )
    article_id = article_response.json()["id"]

    # Create fact
    fact_response = await auth_client.post(
        "/api/v1/facts",
        json={
            "article_id": article_id,
            "fact_date": "2025-10-13",
            "amount": "100.00",
        },
    )
    fact_id = fact_response.json()["id"]

    # Update article (admin-only operation)
    await admin_client.put(f"/api/v1/articles/{article_id}", json={"name": "V2"})

    # Verify fact still accessible
    fact_get_response = await auth_client.get(f"/api/v1/facts/{fact_id}")
    assert fact_get_response.status_code == 200

    # Verify fact still references same article_id
    fact_data = fact_get_response.json()
    assert fact_data["article_id"] == article_id


@pytest.mark.asyncio
async def test_aggregation_uses_current_versions_only(
    auth_client: AsyncClient, session: AsyncSession
):
    """
    Test that aggregations only include current versions of facts.

    Workflow:
    1. Create fact (amount=100)
    2. Update fact (amount=200)
    3. Get summary
    4. Verify summary uses updated amount (200) not old (100)
    """
    # Create article
    article_response = await auth_client.post(
        "/api/v1/articles",
        json={"code": "INCOME", "name": "Income", "type": "income", "parent_id": None},
    )
    article_id = article_response.json()["id"]

    # Create fact
    fact_response = await auth_client.post(
        "/api/v1/facts",
        json={
            "article_id": article_id,
            "fact_date": "2025-10-13",
            "amount": "100.00",
        },
    )
    fact_id = fact_response.json()["id"]

    # Update fact
    await auth_client.put(
        f"/api/v1/facts/{fact_id}",
        json={"amount": "200.00"},
    )

    # Get summary
    summary_response = await auth_client.get("/api/v1/facts/summary")
    summary_data = summary_response.json()

    # Total should reflect updated amount (200), not sum of both (300)
    total_income = Decimal(summary_data["total_income"])
    assert total_income == Decimal("200.00")
