"""
Notifications API endpoints.

This module implements notification management endpoints for budget alerts.
Supports broadcast notifications (user_id=NULL) for shared budget scenarios.

Features:
    - Create notification (internal bot use)
    - Check duplicate broadcast notification
    - List all notifications (no user isolation - broadcast model)
"""

from datetime import date, datetime
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.dependencies import CurrentUser, InternalAPIKey, get_session
from backend.app.models.article import Article
from backend.app.models.notification import Notification
from backend.app.schemas import get_common_responses
from backend.app.schemas.notification import (
    NotificationCreate,
    NotificationList,
    NotificationRead,
)

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.post(
    "",
    response_model=NotificationRead,
    status_code=status.HTTP_201_CREATED,
    responses=get_common_responses(),
)
async def create_notification(
    notification_data: NotificationCreate,
    session: AsyncSession = Depends(get_session),
    _: InternalAPIKey = None,
) -> NotificationRead:
    """
    Create notification record (internal bot use).

    **Purpose:**
    Used by Telegram bot when budget threshold is exceeded.
    Supports both user-specific and broadcast notifications.

    **Broadcast Notifications:**
    - user_id=NULL creates broadcast notification (sent to all users)
    - Unique constraint prevents duplicate broadcasts for same article/period
    - Use for shared family budget alerts

    **Returns:**
    - 201 Created: Notification created successfully
    - 400 Bad Request: Validation error or duplicate broadcast
    - 500 Internal Server Error: Database error

    **Note:**
    This endpoint requires X-Api-Key header for internal authentication.
    Used by Telegram bot and backend scheduler jobs.
    """
    # Create notification model from schema
    notification = Notification(**notification_data.model_dump())

    # Add to session and commit
    session.add(notification)
    await session.commit()
    await session.refresh(notification)

    return notification


@router.get(
    "/check-duplicate",
    response_model=bool,
    responses=get_common_responses(),
)
async def check_duplicate_notification(
    article_id: Annotated[int, Query(gt=0, description="Budget category/article ID")],
    notification_type: Annotated[str, Query(max_length=50, description="Notification type")],
    period_start: Annotated[date, Query(description="Period start date (YYYY-MM-DD)")],
    period_end: Annotated[date, Query(description="Period end date (YYYY-MM-DD)")],
    session: AsyncSession = Depends(get_session),
    _: InternalAPIKey = None,
) -> bool:
    """
    Check if broadcast notification already exists for this period.

    **Purpose:**
    Used by bot to prevent duplicate notifications.
    Only checks for broadcast notifications (user_id IS NULL).

    **Query Parameters:**
    - article_id: Budget category ID
    - notification_type: Type of notification (budget_threshold, budget_exceeded, etc.)
    - period_start: Start of monitored period
    - period_end: End of monitored period

    **Returns:**
    - True: Broadcast notification exists for this period (do not send again)
    - False: No broadcast notification found (safe to send)

    **Example:**
    ```
    GET /api/v1/notifications/check-duplicate?article_id=5&notification_type=budget_threshold&period_start=2025-10-01&period_end=2025-10-31
    Response: false
    ```
    """
    # Query for broadcast notification (user_id IS NULL)
    statement = select(Notification).where(
        Notification.user_id.is_(None),  # Broadcast only
        Notification.article_id == article_id,
        Notification.notification_type == notification_type,
        Notification.period_start == period_start,
        Notification.period_end == period_end,
    )

    result = await session.execute(statement)
    existing = result.scalar_one_or_none()

    return existing is not None


@router.get(
    "",
    response_model=NotificationList,
    responses=get_common_responses(),
)
async def list_notifications(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    notification_type: Annotated[Optional[str], Query(max_length=50)] = None,
    date_from: Annotated[Optional[date], Query(description="Filter notifications created from this date (inclusive)")] = None,
    date_to: Annotated[Optional[date], Query(description="Filter notifications created until this date (inclusive)")] = None,
) -> NotificationList:
    """
    List ALL notifications (no user filtering - broadcast model).

    **Important:**
    This endpoint returns ALL notifications without user isolation.
    All authenticated users see the same notification history.
    This is intentional for shared family budget scenarios.

    **Pagination:**
    - skip: Number of notifications to skip (default: 0)
    - limit: Maximum number of notifications (1-200, default: 50)

    **Filtering:**
    - notification_type: Optional filter by type (budget_threshold, budget_exceeded, weekly_report)
    - date_from: Optional filter by creation date from (inclusive, YYYY-MM-DD)
    - date_to: Optional filter by creation date to (inclusive, YYYY-MM-DD)

    **Ordering:**
    - Notifications are returned in reverse chronological order (newest first)

    **Returns:**
    - 200 OK: Notification list with pagination info
    - 400 Bad Request: Invalid query parameters

    **Example:**
    ```
    GET /api/v1/notifications?skip=0&limit=50&notification_type=budget_threshold&date_from=2025-10-01&date_to=2025-10-31
    ```
    """
    # Base query for items with LEFT JOIN to Article for article_name
    statement = (
        select(Notification, Article.name.label("article_name"))
        .outerjoin(Article, Notification.article_id == Article.id)
    )

    # Base query for count (will apply same filters)
    count_stmt = select(func.count(Notification.id))

    # Apply optional filters to BOTH statements
    if notification_type:
        statement = statement.where(Notification.notification_type == notification_type)
        count_stmt = count_stmt.where(Notification.notification_type == notification_type)

    if date_from:
        # Filter by created_at >= date_from (start of day)
        date_from_dt = datetime.combine(date_from, datetime.min.time())
        statement = statement.where(Notification.created_at >= date_from_dt)
        count_stmt = count_stmt.where(Notification.created_at >= date_from_dt)

    if date_to:
        # Filter by created_at <= date_to (end of day)
        date_to_dt = datetime.combine(date_to, datetime.max.time())
        statement = statement.where(Notification.created_at <= date_to_dt)
        count_stmt = count_stmt.where(Notification.created_at <= date_to_dt)

    # Execute count query
    total_result = await session.execute(count_stmt)
    total = total_result.scalar_one()

    # Apply ordering (newest first) and pagination
    statement = statement.order_by(Notification.created_at.desc())
    statement = statement.limit(limit).offset(skip)

    # Execute query
    result = await session.execute(statement)
    rows = result.all()

    # Convert to NotificationRead with article_name
    items = []
    for row in rows:
        notification = row[0]  # Notification object
        article_name = row[1]  # Article.name from JOIN
        # Create dict from notification and add article_name
        notification_dict = {
            "id": notification.id,
            "user_id": notification.user_id,
            "article_id": notification.article_id,
            "article_name": article_name,
            "notification_type": notification.notification_type,
            "threshold_percent": notification.threshold_percent,
            "plan_amount": notification.plan_amount,
            "actual_amount": notification.actual_amount,
            "period_start": notification.period_start,
            "period_end": notification.period_end,
            "created_at": notification.created_at,
        }
        items.append(NotificationRead(**notification_dict))

    return NotificationList(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
    )
