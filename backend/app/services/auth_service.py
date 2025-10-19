"""
Authentication service for user management with SCD Type 2 pattern.

This module handles user creation and updates using Slowly Changing Dimension
Type 2 pattern for historical tracking. When user data changes, a new version
is created while preserving the old version for audit purposes.

Pattern: SCD Type 2
    - Multiple versions of the same user (telegram_id) can exist
    - Only one version has is_current=True
    - Old versions have valid_to set to the timestamp when they became invalid
    - New versions have is_current=True and valid_to=9999-12-31
"""

from datetime import datetime
from typing import Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.config import get_settings
from backend.app.models.user import User


async def get_or_create_user(
    session: AsyncSession,
    telegram_id: int,
    first_name: Optional[str],
    last_name: Optional[str],
    username: Optional[str],
) -> User:
    """
    Get existing user or create new user with SCD Type 2 pattern.

    Implements the following logic:
    1. Check if user with telegram_id exists (is_current=True)
    2. If exists and data unchanged: Return existing user
    3. If exists and data changed: Create new version (SCD2)
       - Set old version: is_current=False, valid_to=now
       - Create new version: is_current=True, valid_from=now
    4. If not exists: Create new user

    Args:
        session: Async database session
        telegram_id: Telegram user ID (business key)
        first_name: User's first name
        last_name: User's last name (optional)
        username: Telegram username (optional)

    Returns:
        User: Current user record (new or existing)

    Example:
        >>> async with get_session() as session:
        ...     user = await get_or_create_user(
        ...         session=session,
        ...         telegram_id=123456789,
        ...         first_name="John",
        ...         last_name="Doe",
        ...         username="johndoe"
        ...     )
        ...     print(f"User ID: {user.id}, Current: {user.is_current}")

    Notes:
        - Business key: telegram_id
        - SCD2 pattern: valid_from, valid_to, is_current
        - Old versions preserved for audit
        - Changes trigger new version creation
    """
    # Step 1: Find current user version
    statement = select(User).where(
        User.telegram_id == telegram_id,
        User.is_current == True  # noqa: E712
    )
    result = await session.execute(statement)
    existing_user = result.scalar_one_or_none()

    # Step 2: If user doesn't exist, create new
    if existing_user is None:
        # Check if user is admin (compare telegram_id with ADMIN_TELEGRAM_ID from settings)
        settings = get_settings()
        is_admin = (telegram_id == settings.ADMIN_TELEGRAM_ID)

        new_user = User(
            telegram_id=telegram_id,
            username=username,
            first_name=first_name,
            last_name=last_name,
            is_admin=is_admin,  # Auto-detect admin based on ADMIN_TELEGRAM_ID
            valid_from=datetime.utcnow(),
            valid_to=datetime(9999, 12, 31, 23, 59, 59),
            is_current=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        session.add(new_user)
        await session.flush()  # Get ID without committing transaction
        return new_user

    # Step 3: Check if user data changed
    data_changed = (
        existing_user.username != username
        or existing_user.first_name != first_name
        or existing_user.last_name != last_name
    )

    # Step 4: If data unchanged, return existing user
    if not data_changed:
        # Update timestamps
        existing_user.updated_at = datetime.utcnow()
        session.add(existing_user)
        await session.flush()
        return existing_user

    # Step 5: If data changed, create new version (SCD2)
    now = datetime.utcnow()

    # Close old version
    existing_user.is_current = False
    existing_user.valid_to = now
    existing_user.updated_at = now
    session.add(existing_user)

    # Check if user is admin (in case ADMIN_TELEGRAM_ID changed in settings)
    settings = get_settings()
    is_admin = (telegram_id == settings.ADMIN_TELEGRAM_ID)

    # Create new version
    new_version = User(
        telegram_id=telegram_id,
        username=username,
        first_name=first_name,
        last_name=last_name,
        is_admin=is_admin,  # Re-check admin status against current settings
        valid_from=now,
        valid_to=datetime(9999, 12, 31, 23, 59, 59),
        is_current=True,
        created_at=now,
        updated_at=now,
    )
    session.add(new_version)
    await session.flush()  # Get ID without committing transaction

    return new_version
