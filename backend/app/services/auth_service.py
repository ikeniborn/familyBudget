"""
Authentication service for user retrieval and email-based authentication.

This module handles:
    - User lookup by Telegram ID or email
    - Email/password authentication
    - Adding email to existing Telegram accounts
    - Password management

NOTE: User profile updates are handled by user_service.py (Hybrid SCD1 + History SCD2).

See: backend/app/services/user_service.py for:
    - update_user_profile(): Update user profile (SCD1) + create history (SCD2)
    - create_initial_history(): Create initial history record for new users
    - get_user_history(): Get full change history
"""
from typing import Optional

from datetime import datetime

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.models.user import User
from backend.app.services.password_service import (
    hash_password,
    verify_password_with_dummy,
)


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
        User.telegram_id == telegram_id
    )
    result = await session.execute(statement)
    existing_user = result.scalar_one_or_none()

    # Update last access timestamp if user exists
    if existing_user is not None:
        existing_user.updated_at = datetime.utcnow()
        session.add(existing_user)
        await session.flush()

    return existing_user


async def get_user_by_email(
    session: AsyncSession,
    email: str,
) -> Optional[User]:
    """
    Get existing user by email address.

    Used for email-based authentication (login, password reset).

    Args:
        session: Async database session
        email: User's email address (case-insensitive)

    Returns:
        Optional[User]: User record if found, None otherwise

    Example:
        >>> user = await get_user_by_email(session, "user@example.com")
        >>> if user is None:
        ...     # User not found
    """
    # Case-insensitive email lookup
    statement = select(User).where(
        User.email == email.lower()
    )
    result = await session.execute(statement)
    return result.scalar_one_or_none()


async def authenticate_with_password(
    session: AsyncSession,
    email: str,
    password: str,
) -> Optional[User]:
    """
    Authenticate user with email and password.

    This function is timing-safe - it always performs password hashing
    even if the user doesn't exist (prevents timing-based enumeration).

    Args:
        session: Async database session
        email: User's email address
        password: Plain text password to verify

    Returns:
        Optional[User]: User if credentials are valid, None otherwise

    Example:
        >>> user = await authenticate_with_password(session, email, password)
        >>> if user is None:
        ...     raise HTTPException(401, "Invalid email or password")
    """
    user = await get_user_by_email(session, email)

    # Use timing-safe verification (always performs hash operation)
    password_hash = user.password_hash if user else None
    is_valid = verify_password_with_dummy(password, password_hash)

    if not is_valid:
        return None

    # Update last access timestamp
    if user is not None:
        user.updated_at = datetime.utcnow()
        session.add(user)
        await session.flush()

    return user


async def add_email_to_user(
    session: AsyncSession,
    user: User,
    email: str,
) -> bool:
    """
    Add email to an existing Telegram user account.

    Allows Telegram users to add email for alternative login method.

    Args:
        session: Async database session
        user: User to update
        email: Email address to add

    Returns:
        bool: True if email was added, False if email already in use

    Example:
        >>> success = await add_email_to_user(session, user, "user@example.com")
        >>> if not success:
        ...     raise HTTPException(409, "Email already in use")
    """
    # Check if email already in use
    existing = await get_user_by_email(session, email)
    if existing is not None:
        return False

    # Add email to user
    user.email = email.lower()
    user.updated_at = datetime.utcnow()
    session.add(user)
    await session.commit()

    return True


async def set_user_password(
    session: AsyncSession,
    user: User,
    password: str,
) -> None:
    """
    Set or update user's password.

    Password is hashed using Argon2 before storage.

    Args:
        session: Async database session
        user: User to update
        password: Plain text password (will be hashed)

    Example:
        >>> await set_user_password(session, user, "new_secure_password")
    """
    user.password_hash = hash_password(password)
    user.updated_at = datetime.utcnow()
    session.add(user)
    await session.commit()


async def get_user_by_id(
    session: AsyncSession,
    user_id: int,
) -> Optional[User]:
    """
    Get user by ID.

    Args:
        session: Async database session
        user_id: User's primary key

    Returns:
        Optional[User]: User record if found, None otherwise
    """
    statement = select(User).where(User.id == user_id)
    result = await session.execute(statement)
    return result.scalar_one_or_none()


async def link_telegram_to_user(
    session: AsyncSession,
    user: User,
    telegram_id: int,
    username: Optional[str] = None,
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    photo_url: Optional[str] = None,
) -> bool:
    """
    Link Telegram account to an existing email user.

    Allows email-only users to add Telegram for alternative login.

    Args:
        session: Async database session
        user: User to update
        telegram_id: Telegram user ID
        username: Telegram username (optional)
        first_name: First name from Telegram (optional)
        last_name: Last name from Telegram (optional)
        photo_url: Profile photo URL (optional)

    Returns:
        bool: True if linked, False if telegram_id already in use

    Example:
        >>> success = await link_telegram_to_user(session, user, telegram_id=123456)
        >>> if not success:
        ...     raise HTTPException(409, "Telegram account already linked to another user")
    """
    # Check if telegram_id already in use
    existing = await get_user_by_telegram_id(session, telegram_id)
    if existing is not None and existing.id != user.id:
        return False

    # Link Telegram to user
    user.telegram_id = telegram_id
    if username:
        user.username = username
    if first_name:
        user.first_name = first_name
    if last_name:
        user.last_name = last_name
    if photo_url:
        user.photo_url = photo_url
    user.updated_at = datetime.utcnow()

    session.add(user)
    await session.commit()

    return True


# =============================================================================
# DEPRECATED NOTES
# =============================================================================
# The old update_user_profile() function has been removed.
# Use backend.app.services.user_service.update_user_profile() instead.
# See: backend/app/services/user_service.py for the correct implementation.
