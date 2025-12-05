"""
Users CRUD endpoints.

This module implements user management endpoints.
Most endpoints require admin privileges.

Features:
    - Admin-only list all users
    - Get current user (anyone)
    - Get user by ID (admin or self)
    - Update user role with SCD Type 2 (admin only)
"""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.dependencies import (
    CurrentAdmin,
    CurrentUser,
    get_session,
)
from backend.app.models.user import User
from backend.app.schemas import get_common_responses
from backend.app.schemas.auth import UserResponse
from backend.app.schemas.user import (
    UserCreate,
    UserDetailResponse,
    UserListResponse,
    UserUpdate,
)
from backend.app.services import create_new_version, has_changes

router = APIRouter(prefix="/users", tags=["Users"])


@router.get(
    "",
    response_model=UserListResponse,
    responses=get_common_responses(),
)
async def list_users(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    limit: Annotated[int, Query(ge=1, le=1000)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> UserListResponse:
    """
    List all users (Shared Family Budget).

    **Shared Family Budget:** All authenticated users can view all family members.
    This is necessary for audit trail (viewing who created each transaction).

    **Pagination:**
    - limit: Maximum number of results (1-1000, default: 100)
    - offset: Number of results to skip (default: 0)

    **Returns:**
    - 200 OK: List of users with pagination info
    """
    # Base query: only current versions
    statement = select(User).where()  # noqa: E712

    # Count total (before pagination)
    count_stmt = select(func.count()).select_from(statement.subquery())
    total_result = await session.execute(count_stmt)
    total = total_result.scalar_one()

    # Apply pagination and ordering (newest first)
    statement = statement.order_by(User.created_at.desc())
    statement = statement.limit(limit).offset(offset)

    # Execute query
    result = await session.execute(statement)
    users = result.scalars().all()

    return UserListResponse(
        users=users,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/me",
    response_model=UserResponse,
    responses=get_common_responses(),
)
async def get_current_user_info(
    current_user: CurrentUser,
) -> User:
    """
    Get current user information.

    **Public:** Any authenticated user can access their own profile.

    **Returns:**
    - 200 OK: Current user data
    - 401 Unauthorized: Not authenticated
    """
    # current_user is already loaded by get_current_user dependency
    return current_user


@router.get(
    "/{user_id}",
    response_model=UserDetailResponse,
    responses=get_common_responses(include_403=True, include_404=True),
)
async def get_user(
    user_id: int,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> User:
    """
    Get user by ID.

    **Access Control:**
    - Admin users can view any user
    - Regular users can only view their own profile

    **Returns:**
    - 200 OK: User data
    - 403 Forbidden: Regular user trying to view other user
    - 404 Not Found: User not found
    """
    # Load user (current version only)
    statement = select(User).where(
        User.id == user_id
    )
    result = await session.execute(statement)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id={user_id} not found"
        )

    # Check access: admin OR viewing own profile
    if not current_user.is_admin and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied - Can only view own profile"
        )

    return user


@router.post(
    "",
    response_model=UserDetailResponse,
    status_code=status.HTTP_201_CREATED,
    responses=get_common_responses(include_403=True, include_409=True),
)
async def create_user(
    user_data: UserCreate,
    admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session),
) -> User:
    """
    Create a new user (admin only).

    **Admin Only:** Only admin users can manually create users.

    **SCD Type 2 Behavior:**
    - Creates initial version with is_current=True
    - valid_from=now(), valid_to=9999-12-31

    **Use Cases:**
    - Pre-register users before Telegram OAuth
    - Testing and development
    - Manual user creation

    **Returns:**
    - 201 Created: User successfully created
    - 403 Forbidden: User is not admin
    - 409 Conflict: User with this telegram_id already exists
    """
    # Check if user with this telegram_id already exists
    statement = select(User).where(
        User.telegram_id == user_data.telegram_id
    )
    result = await session.execute(statement)
    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"User with telegram_id={user_data.telegram_id} "
                "already exists"
            )
        )

    # Create new user (initial SCD Type 2 version)
    now = datetime.utcnow()
    new_user = User(
        telegram_id=user_data.telegram_id,
        username=user_data.username,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        is_admin=user_data.is_admin,
        valid_from=now,
        valid_to=datetime(9999, 12, 31, 23, 59, 59),
        is_current=True,
        created_at=now,
        updated_at=now,
    )

    session.add(new_user)
    await session.commit()
    await session.refresh(new_user)

    return new_user


@router.put(
    "/{user_id}",
    response_model=UserDetailResponse,
    responses=get_common_responses(include_403=True, include_404=True),
)
async def update_user_role(
    user_id: int,
    user_data: UserUpdate,
    admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session),
) -> User:
    """
    Update user role (admin only, SCD Type 2).

    **Admin Only:** Only admin users can update user roles.

    **SCD Type 2 Behavior:**
    - Creates NEW version with is_current=True
    - Old version: is_current=False, valid_to=now()
    - New version: is_current=True, valid_from=now(), valid_to=9999-12-31

    **Use Cases:**
    - Promote user to admin: is_admin=True
    - Demote admin to regular user: is_admin=False

    **Returns:**
    - 200 OK: User role updated (new version created)
    - 403 Forbidden: User is not admin
    - 404 Not Found: User not found
    """
    # Load current version
    statement = select(User).where(
        User.id == user_id
    )
    result = await session.execute(statement)
    old_user = result.scalar_one_or_none()

    if not old_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id={user_id} not found"
        )

    # Prepare update data
    update_data = user_data.model_dump()

    # Check if is_admin actually changed
    changed, changed_fields = has_changes(old_user, update_data)
    if not changed:
        # No change, return existing user
        return old_user

    # Create new version using SCD2 service
    new_user = await create_new_version(
        session=session,
        old_instance=old_user,
        updates=update_data,
        changed_fields=changed_fields,
    )

    return new_user


@router.get(
    "/telegram-ids",
    response_model=list[dict[str, int]],
    responses=get_common_responses(),
)
async def get_all_telegram_ids(
    session: AsyncSession = Depends(get_session),
) -> list[dict[str, int]]:
    """
    Get telegram_id for all active users (for broadcast notifications).

    **Internal Use:** This endpoint is designed for bot internal use
    to get list of telegram_ids for sending broadcast notifications.

    **Security Note:**
    ⚠️ WARNING: This endpoint currently has NO authentication.
    In production, this should be protected with:
    - Internal API key authentication
    - IP whitelist (only bot server)
    - Rate limiting

    **Returns:**
    List of dicts with telegram_id for each active user.

    **Example Response:**
    ```json
    [
        {"telegram_id": 123456789},
        {"telegram_id": 987654321}
    ]
    ```
    """
    # Query only current user versions
    statement = select(User.telegram_id).where()  # noqa: E712
    result = await session.execute(statement)
    telegram_ids = result.scalars().all()

    return [{"telegram_id": tid} for tid in telegram_ids]


@router.get(
    "/timezones",
    response_model=list[dict],
    responses=get_common_responses(),
)
async def list_timezones(
    current_user: CurrentUser,
) -> list[dict]:
    """
    Get list of common timezones for UI selector.

    **Public:** Any authenticated user can access this endpoint.

    **Returns:**
    List of timezone objects with:
    - name: IANA timezone name (e.g., "Europe/Moscow")
    - offset: UTC offset (e.g., "UTC+03:00")
    - display: Human-readable display string

    **Example Response:**
    ```json
    [
        {"name": "UTC", "offset": "UTC+00:00", "display": "(UTC+00:00) UTC"},
        {"name": "Europe/Moscow", "offset": "UTC+03:00", "display": "(UTC+03:00) Europe/Moscow"}
    ]
    ```
    """
    from backend.app.utils.timezone import get_common_timezones
    return get_common_timezones()


@router.put(
    "/me/timezone",
    response_model=UserResponse,
    responses=get_common_responses(),
)
async def update_my_timezone(
    timezone: str,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> User:
    """
    Update current user's timezone.

    **Public:** Any authenticated user can update their own timezone.

    **Args:**
    - timezone: IANA timezone name (e.g., "Europe/Moscow", "UTC")

    **Validation:**
    - Must be a valid IANA timezone name
    - Invalid timezone will return 400 Bad Request

    **Returns:**
    - 200 OK: Updated user data
    - 400 Bad Request: Invalid timezone
    - 401 Unauthorized: Not authenticated
    """
    from backend.app.utils.timezone import is_valid_timezone

    # Validate timezone
    if not is_valid_timezone(timezone):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid timezone: {timezone}. Use IANA format (e.g., Europe/Moscow, UTC)"
        )

    # Update user timezone (SCD1 - in-place update)
    current_user.timezone = timezone
    current_user.updated_at = datetime.utcnow()

    session.add(current_user)
    await session.commit()
    await session.refresh(current_user)

    return current_user
