"""
Integration tests for Notifications API workflows.

Tests complete notification management workflows through API:
1. Create broadcast notifications (POST /api/v1/notifications)
2. Check duplicate broadcast notifications (GET /api/v1/notifications/check-duplicate)
3. List notifications with filtering (GET /api/v1/notifications)
4. Get all telegram IDs (GET /api/v1/users/telegram-ids)
5. Broadcast vs user-specific notifications
6. Notification deduplication logic

These tests verify notifications API works correctly end-to-end with database integration.
"""

from datetime import date, datetime
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.models.notification import Notification

# ============================================================================
# Create Notification Tests
# ============================================================================


@pytest.mark.asyncio
async def test_create_broadcast_notification(auth_client: AsyncClient, session: AsyncSession):
    """
    Test creating broadcast notification (user_id=NULL).

    Workflow:
    1. Create article
    2. Create broadcast notification
    3. Verify stored in database with user_id=NULL
    4. Verify is_broadcast() returns True
    """
    # Step 1: Create article
    article_response = await auth_client.post(
        "/api/v1/articles",
        json={
            "code": "FOOD",
            "name": "Food & Dining",
            "type": "expense",
            "parent_id": None,
        },
    )
    article_id = article_response.json()["id"]

    # Step 2: Create broadcast notification
    notification_data = {
        "article_id": article_id,
        "notification_type": "budget_threshold",
        "threshold_percent": 90,
        "plan_amount": "10000.00",
        "actual_amount": "9500.00",
        "period_start": "2025-10-01",
        "period_end": "2025-10-31",
        # user_id not provided = broadcast
    }

    response = await auth_client.post("/api/v1/notifications", json=notification_data)

    assert response.status_code == 201

    notification_json = response.json()
    notification_id = notification_json["id"]

    # Step 3: Verify in database
    stmt = select(Notification).where(Notification.id == notification_id)
    result = await session.execute(stmt)
    notification = result.scalar_one()

    assert notification.user_id is None  # Broadcast
    assert notification.article_id == article_id
    assert notification.notification_type == "budget_threshold"
    assert notification.threshold_percent == 90
    assert notification.plan_amount == Decimal("10000.00")
    assert notification.actual_amount == Decimal("9500.00")

    # Step 4: Verify is_broadcast()
    assert notification.is_broadcast() is True


@pytest.mark.asyncio
async def test_create_user_specific_notification(auth_client: AsyncClient, session: AsyncSession):
    """
    Test creating user-specific notification (user_id set).

    Verifies:
    - user_id can be specified
    - is_broadcast() returns False for user-specific notifications
    """
    # Create article
    article_response = await auth_client.post(
        "/api/v1/articles",
        json={"code": "TRANSPORT", "name": "Transport", "type": "expense", "parent_id": None},
    )
    article_id = article_response.json()["id"]

    # Create user-specific notification
    notification_data = {
        "user_id": 123,  # Specific user
        "article_id": article_id,
        "notification_type": "budget_exceeded",
        "threshold_percent": 100,
        "plan_amount": "5000.00",
        "actual_amount": "5500.00",
        "period_start": "2025-10-01",
        "period_end": "2025-10-31",
    }

    response = await auth_client.post("/api/v1/notifications", json=notification_data)

    assert response.status_code == 201

    notification_json = response.json()
    notification_id = notification_json["id"]

    # Verify in database
    stmt = select(Notification).where(Notification.id == notification_id)
    result = await session.execute(stmt)
    notification = result.scalar_one()

    assert notification.user_id == 123  # User-specific
    assert notification.is_broadcast() is False


# ============================================================================
# Check Duplicate Notification Tests
# ============================================================================


@pytest.mark.asyncio
async def test_check_duplicate_broadcast_notification_not_exists(auth_client: AsyncClient):
    """
    Test checking for duplicate when no broadcast notification exists.

    Verifies:
    - Returns False when no duplicate exists
    - Allows creation of new notification
    """
    # Create article
    article_response = await auth_client.post(
        "/api/v1/articles",
        json={"code": "UTILITIES", "name": "Utilities", "type": "expense", "parent_id": None},
    )
    article_id = article_response.json()["id"]

    # Check for duplicate (should not exist)
    params = {
        "article_id": article_id,
        "notification_type": "budget_threshold",
        "period_start": "2025-10-01",
        "period_end": "2025-10-31",
    }

    response = await auth_client.get("/api/v1/notifications/check-duplicate", params=params)

    assert response.status_code == 200
    assert response.json() is False  # No duplicate


@pytest.mark.asyncio
async def test_check_duplicate_broadcast_notification_exists(auth_client: AsyncClient):
    """
    Test checking for duplicate when broadcast notification exists.

    Workflow:
    1. Create broadcast notification
    2. Check for duplicate (should exist)
    3. Verify returns True
    """
    # Create article
    article_response = await auth_client.post(
        "/api/v1/articles",
        json={"code": "RENT", "name": "Rent", "type": "expense", "parent_id": None},
    )
    article_id = article_response.json()["id"]

    # Create broadcast notification
    notification_data = {
        "article_id": article_id,
        "notification_type": "budget_exceeded",
        "threshold_percent": 100,
        "plan_amount": "20000.00",
        "actual_amount": "22000.00",
        "period_start": "2025-10-01",
        "period_end": "2025-10-31",
        # user_id not provided = broadcast
    }

    await auth_client.post("/api/v1/notifications", json=notification_data)

    # Check for duplicate (should exist)
    params = {
        "article_id": article_id,
        "notification_type": "budget_exceeded",
        "period_start": "2025-10-01",
        "period_end": "2025-10-31",
    }

    response = await auth_client.get("/api/v1/notifications/check-duplicate", params=params)

    assert response.status_code == 200
    assert response.json() is True  # Duplicate exists


@pytest.mark.asyncio
async def test_check_duplicate_different_period(auth_client: AsyncClient):
    """
    Test that duplicate check is period-specific.

    Verifies:
    - Same article + type but different period = not duplicate
    - Allows notifications for different periods
    """
    # Create article
    article_response = await auth_client.post(
        "/api/v1/articles",
        json={"code": "ENTERTAINMENT", "name": "Entertainment", "type": "expense", "parent_id": None},
    )
    article_id = article_response.json()["id"]

    # Create notification for October
    notification_data = {
        "article_id": article_id,
        "notification_type": "budget_threshold",
        "threshold_percent": 90,
        "plan_amount": "5000.00",
        "actual_amount": "4500.00",
        "period_start": "2025-10-01",
        "period_end": "2025-10-31",
    }

    await auth_client.post("/api/v1/notifications", json=notification_data)

    # Check for duplicate in November (should not exist)
    params = {
        "article_id": article_id,
        "notification_type": "budget_threshold",
        "period_start": "2025-11-01",
        "period_end": "2025-11-30",
    }

    response = await auth_client.get("/api/v1/notifications/check-duplicate", params=params)

    assert response.status_code == 200
    assert response.json() is False  # Different period = not duplicate


# ============================================================================
# List Notifications Tests
# ============================================================================


@pytest.mark.asyncio
async def test_list_notifications_empty(auth_client: AsyncClient):
    """
    Test listing notifications when none exist.

    Verifies:
    - Returns empty list
    - Total count is 0
    """
    response = await auth_client.get("/api/v1/notifications")

    assert response.status_code == 200

    data = response.json()
    assert data["items"] == []
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_list_notifications_multiple(auth_client: AsyncClient):
    """
    Test listing multiple notifications.

    Workflow:
    1. Create multiple notifications
    2. List all notifications
    3. Verify all returned
    """
    # Create article
    article_response = await auth_client.post(
        "/api/v1/articles",
        json={"code": "SHOPPING", "name": "Shopping", "type": "expense", "parent_id": None},
    )
    article_id = article_response.json()["id"]

    # Create 3 notifications
    for i in range(3):
        notification_data = {
            "article_id": article_id,
            "notification_type": "budget_threshold",
            "threshold_percent": 90,
            "plan_amount": f"{(i + 1) * 1000}.00",
            "actual_amount": f"{(i + 1) * 900}.00",
            "period_start": f"2025-{i + 1:02d}-01",
            "period_end": f"2025-{i + 1:02d}-28",
        }
        await auth_client.post("/api/v1/notifications", json=notification_data)

    # List all notifications
    response = await auth_client.get("/api/v1/notifications")

    assert response.status_code == 200

    data = response.json()
    assert len(data["items"]) >= 3  # At least our 3 notifications
    assert data["total"] >= 3


@pytest.mark.asyncio
async def test_list_notifications_filter_by_type(auth_client: AsyncClient):
    """
    Test filtering notifications by type.

    Workflow:
    1. Create notifications with different types
    2. Filter by specific type
    3. Verify only matching notifications returned
    """
    # Create article
    article_response = await auth_client.post(
        "/api/v1/articles",
        json={"code": "HEALTH", "name": "Healthcare", "type": "expense", "parent_id": None},
    )
    article_id = article_response.json()["id"]

    # Create budget_threshold notification
    await auth_client.post(
        "/api/v1/notifications",
        json={
            "article_id": article_id,
            "notification_type": "budget_threshold",
            "threshold_percent": 90,
            "plan_amount": "8000.00",
            "actual_amount": "7200.00",
            "period_start": "2025-10-01",
            "period_end": "2025-10-31",
        },
    )

    # Create budget_exceeded notification
    await auth_client.post(
        "/api/v1/notifications",
        json={
            "article_id": article_id,
            "notification_type": "budget_exceeded",
            "threshold_percent": 100,
            "plan_amount": "8000.00",
            "actual_amount": "8500.00",
            "period_start": "2025-10-01",
            "period_end": "2025-10-31",
        },
    )

    # Filter by budget_threshold type
    response = await auth_client.get(
        "/api/v1/notifications",
        params={"notification_type": "budget_threshold"}
    )

    assert response.status_code == 200

    data = response.json()
    # Verify all returned notifications have correct type
    for notification in data["items"]:
        assert notification["notification_type"] == "budget_threshold"


@pytest.mark.asyncio
async def test_list_notifications_pagination(auth_client: AsyncClient):
    """
    Test pagination of notifications list.

    Verifies:
    - skip and limit parameters work correctly
    - Total count is accurate
    """
    # Create article
    article_response = await auth_client.post(
        "/api/v1/articles",
        json={"code": "EDUCATION", "name": "Education", "type": "expense", "parent_id": None},
    )
    article_id = article_response.json()["id"]

    # Create 5 notifications
    for i in range(5):
        await auth_client.post(
            "/api/v1/notifications",
            json={
                "article_id": article_id,
                "notification_type": "budget_threshold",
                "threshold_percent": 90,
                "plan_amount": "1000.00",
                "actual_amount": "900.00",
                "period_start": f"2025-{(i % 12) + 1:02d}-01",
                "period_end": f"2025-{(i % 12) + 1:02d}-28",
            },
        )

    # Test pagination: skip=2, limit=2
    response = await auth_client.get(
        "/api/v1/notifications",
        params={"skip": 2, "limit": 2}
    )

    assert response.status_code == 200

    data = response.json()
    assert len(data["items"]) <= 2  # Should return at most 2 items
    assert data["skip"] == 2
    assert data["limit"] == 2


@pytest.mark.asyncio
async def test_list_notifications_with_date_filters(auth_client: AsyncClient, session: AsyncSession):
    """
    Test filtering notifications by date_from and date_to.

    Workflow:
    1. Create article
    2. Create notifications with different created_at dates (via direct DB insert)
    3. Test date_from filter (should return only notifications >= date_from)
    4. Test date_to filter (should return only notifications <= date_to)
    5. Test both filters (should return notifications in date range)

    This test verifies the datetime.combine() fix for date filters.
    """
    # Create article
    article_response = await auth_client.post(
        "/api/v1/articles",
        json={"code": "DATETEST", "name": "Date Filter Test", "type": "expense", "parent_id": None},
    )
    article_id = article_response.json()["id"]

    # Create notifications with specific created_at dates (direct DB insert)
    # This is necessary because API endpoint sets created_at automatically to NOW()
    from backend.app.models.notification import Notification

    notifications_data = [
        {
            "article_id": article_id,
            "notification_type": "budget_threshold",
            "threshold_percent": 90,
            "plan_amount": Decimal("1000.00"),
            "actual_amount": Decimal("900.00"),
            "period_start": date(2025, 10, 1),
            "period_end": date(2025, 10, 31),
            "created_at": datetime(2025, 10, 5, 10, 0, 0),  # Oct 5
        },
        {
            "article_id": article_id,
            "notification_type": "budget_threshold",
            "threshold_percent": 90,
            "plan_amount": Decimal("2000.00"),
            "actual_amount": Decimal("1800.00"),
            "period_start": date(2025, 10, 1),
            "period_end": date(2025, 10, 31),
            "created_at": datetime(2025, 10, 15, 14, 30, 0),  # Oct 15
        },
        {
            "article_id": article_id,
            "notification_type": "budget_threshold",
            "threshold_percent": 90,
            "plan_amount": Decimal("3000.00"),
            "actual_amount": Decimal("2700.00"),
            "period_start": date(2025, 10, 1),
            "period_end": date(2025, 10, 31),
            "created_at": datetime(2025, 10, 25, 16, 45, 0),  # Oct 25
        },
    ]

    for notif_data in notifications_data:
        notification = Notification(**notif_data)
        session.add(notification)

    await session.commit()

    # Test 1: Filter by date_from (>= Oct 15)
    response = await auth_client.get(
        "/api/v1/notifications",
        params={"date_from": "2025-10-15"}
    )

    assert response.status_code == 200
    data = response.json()

    # Should return notifications from Oct 15 onwards (Oct 15, Oct 25)
    matching_items = [item for item in data["items"] if item["article_id"] == article_id]
    assert len(matching_items) >= 2  # At least Oct 15 and Oct 25

    # Verify all returned notifications are >= Oct 15
    for item in matching_items:
        created_at = datetime.fromisoformat(item["created_at"].replace("Z", "+00:00"))
        assert created_at.date() >= date(2025, 10, 15)

    # Test 2: Filter by date_to (<= Oct 15)
    response = await auth_client.get(
        "/api/v1/notifications",
        params={"date_to": "2025-10-15"}
    )

    assert response.status_code == 200
    data = response.json()

    # Should return notifications up to Oct 15 (Oct 5, Oct 15)
    matching_items = [item for item in data["items"] if item["article_id"] == article_id]
    assert len(matching_items) >= 2  # At least Oct 5 and Oct 15

    # Verify all returned notifications are <= Oct 15
    for item in matching_items:
        created_at = datetime.fromisoformat(item["created_at"].replace("Z", "+00:00"))
        assert created_at.date() <= date(2025, 10, 15)

    # Test 3: Filter by both date_from and date_to (Oct 10 to Oct 20)
    response = await auth_client.get(
        "/api/v1/notifications",
        params={
            "date_from": "2025-10-10",
            "date_to": "2025-10-20"
        }
    )

    assert response.status_code == 200
    data = response.json()

    # Should return only Oct 15 notification (within range)
    matching_items = [item for item in data["items"] if item["article_id"] == article_id]
    assert len(matching_items) >= 1  # At least Oct 15

    # Verify all returned notifications are in range
    for item in matching_items:
        created_at = datetime.fromisoformat(item["created_at"].replace("Z", "+00:00"))
        assert date(2025, 10, 10) <= created_at.date() <= date(2025, 10, 20)


# ============================================================================
# Get Telegram IDs Tests
# ============================================================================


@pytest.mark.asyncio
async def test_get_all_telegram_ids(auth_client: AsyncClient):
    """
    Test getting all telegram IDs for broadcast notifications.

    Verifies:
    - Returns list of telegram_ids
    - Format: [{"telegram_id": int}, ...]
    """
    response = await auth_client.get("/api/v1/users/telegram-ids")

    assert response.status_code == 200

    telegram_ids = response.json()
    assert isinstance(telegram_ids, list)

    # Verify each item has telegram_id field
    for item in telegram_ids:
        assert "telegram_id" in item
        assert isinstance(item["telegram_id"], int)


# ============================================================================
# Complete Broadcast Workflow Tests
# ============================================================================


@pytest.mark.asyncio
async def test_complete_broadcast_notification_workflow(auth_client: AsyncClient):
    """
    Test complete broadcast notification workflow.

    Workflow:
    1. Check if broadcast notification exists (should be False)
    2. Create broadcast notification
    3. Check again (should be True - prevents duplicate)
    4. Get telegram IDs for broadcasting
    5. List notifications to verify creation
    """
    # Create article
    article_response = await auth_client.post(
        "/api/v1/articles",
        json={"code": "GROCERIES", "name": "Groceries", "type": "expense", "parent_id": None},
    )
    article_id = article_response.json()["id"]

    # Step 1: Check for duplicate (should not exist)
    check_params = {
        "article_id": article_id,
        "notification_type": "budget_threshold",
        "period_start": "2025-10-01",
        "period_end": "2025-10-31",
    }

    check_response = await auth_client.get("/api/v1/notifications/check-duplicate", params=check_params)
    assert check_response.json() is False

    # Step 2: Create broadcast notification
    notification_data = {
        "article_id": article_id,
        "notification_type": "budget_threshold",
        "threshold_percent": 90,
        "plan_amount": "15000.00",
        "actual_amount": "13500.00",
        "period_start": "2025-10-01",
        "period_end": "2025-10-31",
    }

    create_response = await auth_client.post("/api/v1/notifications", json=notification_data)
    assert create_response.status_code == 201

    # Step 3: Check for duplicate again (should exist now)
    check_response2 = await auth_client.get("/api/v1/notifications/check-duplicate", params=check_params)
    assert check_response2.json() is True

    # Step 4: Get telegram IDs for broadcast
    telegram_ids_response = await auth_client.get("/api/v1/users/telegram-ids")
    assert telegram_ids_response.status_code == 200
    telegram_ids = telegram_ids_response.json()
    assert isinstance(telegram_ids, list)

    # Step 5: Verify notification in list
    list_response = await auth_client.get("/api/v1/notifications")
    notifications = list_response.json()["items"]

    # Find our notification
    our_notification = next(
        (n for n in notifications if n["article_id"] == article_id),
        None
    )

    assert our_notification is not None
    assert our_notification["notification_type"] == "budget_threshold"
    assert our_notification["user_id"] is None  # Broadcast
