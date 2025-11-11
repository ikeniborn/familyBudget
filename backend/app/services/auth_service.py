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


async def get_user_by_telegram_id(
    session: AsyncSession,
    telegram_id: int,
) -> Optional[User]:
    """
    Get existing user by Telegram ID.

    ⚠️ SECURITY CRITICAL FUNCTION ⚠️

    This function only retrieves existing users from the database.
    It does NOT create new users automatically.

    New users must be created by administrators through the admin panel.
    This prevents unauthorized access to the system.

    Args:
        session: Async database session
        telegram_id: Telegram user ID (business key)

    Returns:
        Optional[User]: Current user record if found, None otherwise

    Example:
        >>> async with get_session() as session:
        ...     user = await get_user_by_telegram_id(
        ...         session=session,
        ...         telegram_id=123456789
        ...     )
        ...     if user is None:
        ...         raise HTTPException(403, "Access denied - user not registered")

    Notes:
        - Business key: telegram_id
        - Only returns is_current=True users
        - Returns None if user not found (no auto-creation)
        - Admin must create users through admin panel
    """
    # Find current user version (only registered users)
    statement = select(User).where(
        User.telegram_id == telegram_id,
        User.is_current == True  # noqa: E712
    )
    result = await session.execute(statement)
    existing_user = result.scalar_one_or_none()

    # Update last access timestamp if user exists
    if existing_user is not None:
        existing_user.updated_at = datetime.utcnow()
        session.add(existing_user)
        await session.flush()

    return existing_user


async def update_user_profile(
    session: AsyncSession,
    telegram_id: int,
    first_name: Optional[str],
    last_name: Optional[str],
    username: Optional[str],
) -> Optional[User]:
    """
    Update user profile data with SCD Type 2 pattern.

    ⚠️ IMPORTANT: This function creates a new version when user data changes.
    Use this ONLY when Telegram user profile is updated (rare event).

    Args:
        session: Async database session
        telegram_id: Telegram user ID (business key)
        first_name: User's first name
        last_name: User's last name (optional)
        username: Telegram username (optional)

    Returns:
        Optional[User]: New version of user if updated, existing user if unchanged, None if not found

    Notes:
        - SCD Type 2 pattern: Creates new version when data changes
        - Old versions preserved for audit
        - Only updates profile data, not permissions
    """
    # Get existing user
    existing_user = await get_user_by_telegram_id(session, telegram_id)

    if existing_user is None:
        return None

    # Check if user data changed
    # Use getattr() for nullable fields to prevent AttributeError
    data_changed = (
        getattr(existing_user, 'username', None) != username
        or existing_user.first_name != first_name
        or getattr(existing_user, 'last_name', None) != last_name
    )

    # If data unchanged, return existing user
    if not data_changed:
        return existing_user

    # If data changed, create new version (SCD2)
    now = datetime.utcnow()

    # CRITICAL FIX: Revoke all active refresh tokens for the old user version
    # This prevents "zombie tokens" that reference an inactive user (is_current=FALSE)
    # Forces re-authentication on all devices when user profile data changes
    # Fixes: 500 error on repeated login with changed profile data
    from backend.app.models.refresh_token import RefreshToken

    old_tokens_stmt = (
        select(RefreshToken)
        .where(RefreshToken.user_id == existing_user.id)
        .where(RefreshToken.is_revoked == False)  # noqa: E712
    )
    old_tokens_result = await session.exec(old_tokens_stmt)
    old_tokens = old_tokens_result.all()

    for token in old_tokens:
        token.revoke()  # Sets is_revoked=True, revoked_at=now()
        session.add(token)

    # Close old version
    existing_user.is_current = False
    existing_user.valid_to = now
    existing_user.updated_at = now
    session.add(existing_user)

    # Create new version (preserve is_admin status)
    new_version = User(
        telegram_id=telegram_id,
        username=username,
        first_name=first_name,
        last_name=last_name,
        is_admin=existing_user.is_admin,  # Preserve admin status
        valid_from=now,
        valid_to=datetime(9999, 12, 31, 23, 59, 59),
        is_current=True,
        created_at=now,
        updated_at=now,
    )
    session.add(new_version)
    await session.flush()  # Get ID without committing transaction

    return new_version
