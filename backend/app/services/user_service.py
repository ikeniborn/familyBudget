"""
User Service Layer (Hybrid: SCD Type 1 + History SCD Type 2).

This module manages User table updates with hybrid approach:
- Main table (t_d_user): SCD Type 1 (in-place updates, NO versioning)
- History table (t_d_user_history): SCD Type 2 (full change tracking)

This differs from generic scd2_service.py:
- User updates are in-place (no new id generated)
- History is stored in separate UserHistory table
- FK in fact tables remain stable (no updates needed)

Key Functions:
    - update_user_profile(): Update User (SCD1) + create UserHistory snapshot (SCD2)
    - get_user_history(): Get full change history from UserHistory table
    - get_user_version_at_date(): Time-travel query to UserHistory
"""

from datetime import date, datetime, timezone
from typing import Any

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.models.user import User
from backend.app.models.user_history import UserHistory

# Far future datetime constant for SCD Type 2 valid_to field
# Uses timezone-aware UTC to prevent asyncpg year overflow issues
FAR_FUTURE_DATETIME = datetime(9999, 12, 31, 23, 59, 59, tzinfo=timezone.utc)


async def update_user_profile(
    session: AsyncSession,
    user: User,
    updates: dict[str, Any],
    changed_by_user_id: int | None = None,
    change_type: str = "UPDATE",
) -> User:
    """
    Update User profile with SCD Type 1 + create UserHistory snapshot (SCD Type 2).

    This function implements hybrid approach:
    1. Close old UserHistory version (is_current=False, set valid_to)
    2. Update User table in-place (SCD1 - no new version, stable id)
    3. Create new UserHistory version (is_current=True, snapshot all fields)

    Args:
        session: AsyncSession for database operations
        user: Current User instance to update
        updates: Dictionary of field updates (e.g., {"username": "new_name", "is_admin": True})
        changed_by_user_id: Optional user ID who made the change (for audit)
        change_type: Type of change (UPDATE/ROLE_CHANGE/LOGIN/etc.)

    Returns:
        Updated User instance (same id, refreshed from DB)

    Example:
        >>> user = await session.get(User, 1)
        >>> updated_user = await update_user_profile(
        ...     session=session,
        ...     user=user,
        ...     updates={"username": "john_updated", "is_admin": True},
        ...     changed_by_user_id=2,
        ...     change_type="ROLE_CHANGE"
        ... )

    Notes:
        - User.id NEVER changes (stable FK for fact tables)
        - UserHistory stores FULL snapshots with all fields
        - changed_fields automatically detected by comparing old vs new values
        - Use change_type to categorize changes (UPDATE/ROLE_CHANGE/LOGIN)
    """
    now = datetime.utcnow()

    # Step 1: Detect changed fields (for audit trail)
    changed_fields = []
    for key, new_value in updates.items():
        old_value = getattr(user, key, None)
        if old_value != new_value:
            changed_fields.append(key)

    # Optimization: if no fields changed, return existing user (no history record)
    if not changed_fields:
        return user

    # Step 2: Close old UserHistory version (set is_current=False, valid_to=now)
    # Find current history version (should exist from previous update or CREATE)
    statement = select(UserHistory).where(
        UserHistory.user_id == user.id,
        UserHistory.is_current == True  # noqa: E712
    )
    result = await session.execute(statement)
    old_history = result.scalar_one_or_none()

    if old_history:
        # Close old version
        old_history.is_current = False
        old_history.valid_to = now
        session.add(old_history)

    # Step 3: Update User table in-place (SCD1 - no new version)
    for key, value in updates.items():
        setattr(user, key, value)

    user.updated_at = now
    session.add(user)

    # Step 4: Create new UserHistory snapshot (SCD2 - all fields)
    new_history = UserHistory(
        user_id=user.id,  # FK to stable User.id
        telegram_id=user.telegram_id,
        email=user.email,  # Include email for email-only users
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        photo_url=user.photo_url,
        is_admin=user.is_admin,
        is_active=user.is_active,
        two_factor_enabled=user.two_factor_enabled,  # Include 2FA status
        last_login_at=user.last_login_at,
        google_sheets_url=user.google_sheets_url,  # Include Google Sheets URL
        valid_from=now,
        valid_to=FAR_FUTURE_DATETIME,
        is_current=True,
        change_type=change_type,
        changed_fields=changed_fields,
        changed_by_user_id=changed_by_user_id,
    )
    session.add(new_history)

    # Step 5: Commit atomically
    await session.commit()
    await session.refresh(user)

    return user


async def get_user_history(
    session: AsyncSession,
    user_id: int,
) -> list[UserHistory]:
    """
    Get full change history for a user from UserHistory table.

    Returns all UserHistory versions (is_current=True and False) ordered by
    valid_from DESC (newest first).

    Args:
        session: AsyncSession for database operations
        user_id: User.id to get history for

    Returns:
        List of UserHistory versions ordered by valid_from DESC (newest first)

    Example:
        >>> history = await get_user_history(session=session, user_id=1)
        >>> for version in history:
        ...     print(f"{version.valid_from}: {version.username}, is_admin={version.is_admin}")
        ...     print(f"  Changed: {version.changed_fields}, by user_id={version.changed_by_user_id}")

    Notes:
        - Includes both current (is_current=True) and closed versions
        - Ordered newest first (valid_from DESC)
        - Each version is a full snapshot of user data at that time
        - Use for audit trail and GET /users/{id}/history endpoint
    """
    statement = (
        select(UserHistory)
        .where(UserHistory.user_id == user_id)
        .order_by(UserHistory.valid_from.desc())
    )

    result = await session.execute(statement)
    return list(result.scalars().all())


async def get_user_version_at_date(
    session: AsyncSession,
    user_id: int,
    target_date: date,
) -> UserHistory | None:
    """
    Get User version that was active at a specific date (time-travel query).

    Queries UserHistory for version where:
    - user_id matches
    - valid_from <= target_date
    - valid_to > target_date

    Args:
        session: AsyncSession for database operations
        user_id: User.id to query
        target_date: Date to query (as of date)

    Returns:
        UserHistory version active at target_date or None if not found

    Example:
        >>> # Get user's role as of January 1, 2025
        >>> version = await get_user_version_at_date(
        ...     session=session,
        ...     user_id=1,
        ...     target_date=date(2025, 1, 1)
        ... )
        >>> if version:
        ...     print(f"On {target_date}, user was admin={version.is_admin}")

    Notes:
        - Uses valid_from and valid_to for time-travel query
        - Useful for historical reporting (e.g., "who was admin on specific date?")
        - Returns None if user didn't exist at target_date
        - Target_date converted to datetime for comparison
    """
    # Convert date to datetime for comparison (timezone-aware UTC, end of day)
    # Use max.time() to include all records created during target_date
    target_datetime = datetime.combine(target_date, datetime.max.time(), tzinfo=timezone.utc)

    statement = select(UserHistory).where(
        UserHistory.user_id == user_id,
        UserHistory.valid_from <= target_datetime,
        UserHistory.valid_to > target_datetime,
    )

    result = await session.execute(statement)
    return result.scalar_one_or_none()


async def create_initial_history(
    session: AsyncSession,
    user: User,
    change_type: str = "CREATE",
) -> UserHistory:
    """
    Create initial UserHistory record when user is first created.

    This should be called immediately after creating new User (e.g., first login).

    Args:
        session: AsyncSession for database operations
        user: Newly created User instance
        change_type: Type of change (typically "CREATE")

    Returns:
        Created UserHistory instance

    Example:
        >>> # After creating new user
        >>> user = User(telegram_id=123456789, username="john_doe", ...)
        >>> session.add(user)
        >>> await session.commit()
        >>> await session.refresh(user)
        >>> history = await create_initial_history(session=session, user=user)

    Notes:
        - Creates first history snapshot with is_current=True
        - changed_fields is None for initial creation (no previous version)
        - changed_by_user_id is None (automatic creation)
    """
    now = datetime.utcnow()

    history = UserHistory(
        user_id=user.id,
        telegram_id=user.telegram_id,
        email=user.email,  # Include email for email-only users
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        photo_url=user.photo_url,
        is_admin=user.is_admin,
        is_active=user.is_active,
        two_factor_enabled=user.two_factor_enabled,  # Include 2FA status
        last_login_at=user.last_login_at,
        google_sheets_url=user.google_sheets_url,  # Include Google Sheets URL
        valid_from=now,
        valid_to=FAR_FUTURE_DATETIME,
        is_current=True,
        change_type=change_type,
        changed_fields=None,  # Initial creation - no previous version
        changed_by_user_id=None,  # Automatic creation
    )
    session.add(history)
    await session.commit()
    await session.refresh(history)

    return history
