"""
Authentication and authorization dependencies.

This module provides FastAPI dependencies for user authentication and authorization:
- get_current_user: Extracts user_id from request.state and loads User from database
- get_current_admin: Validates that current user has admin privileges
- User isolation helpers for data access control

Dependencies:
    - TASK-013: JWT middleware sets request.state.user_id
    - TASK-010: User model with SCD Type 2 pattern
    - TASK-011: Database session management
"""

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.db.session import get_session
from backend.app.models.user import User


async def get_current_user(
    request: Request,
    session: AsyncSession = Depends(get_session)
) -> User:
    """
    Get currently authenticated user from database.

    Extracts user_id from request.state (set by JWT middleware in TASK-013)
    and loads the current version of the user from the database.

    Supports both Telegram users (with telegram_id) and email-only users (without telegram_id).

    Args:
        request: HTTP request with user_id in state (from JWT middleware)
        session: Async database session

    Returns:
        User: Current user object

    Raises:
        HTTPException: 401 if user_id not in request.state (shouldn't happen if middleware works)
        HTTPException: 404 if user not found in database (user deleted)

    Example:
        ```python
        @app.get("/api/v1/facts")
        async def get_facts(current_user: User = Depends(get_current_user)):
            # current_user is loaded from database
            print(f"User {current_user.username} is accessing facts")
            return await get_user_facts(current_user.id)
        ```

    Notes:
        - This dependency requires JWT middleware to be active (TASK-013)
        - Uses user_id (primary key) to support both Telegram and email-only users
        - User object includes all fields (id, telegram_id, email, username, is_admin, etc.)
    """
    # Extract user_id from request state (set by JWT middleware)
    # user_id is always present for both Telegram and email-only users
    user_id = getattr(request.state, "user_id", None)

    if user_id is None:
        # This should never happen if JWT middleware is working correctly
        # But we check defensively
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required - User ID not found in request state"
        )

    # Load user from database using user_id (primary key)
    # This works for both Telegram users and email-only users
    statement = select(User).where(User.id == user_id)
    result = await session.execute(statement)
    user = result.scalar_one_or_none()

    if user is None:
        # User exists in JWT but not in database (deleted or invalid)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found - Account may have been deleted"
        )

    # Check if user is active (PRD FR-030 compliance)
    # Deactivated users should not be able to access protected endpoints
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Your account has been deactivated. "
                "Please contact admin to regain access."
            ),
        )

    return user


async def get_current_admin(
    current_user: Annotated[User, Depends(get_current_user)]
) -> User:
    """
    Get currently authenticated admin user.

    Validates that the current user has admin privileges (is_admin=True).
    Uses get_current_user dependency to load user, then checks admin flag.

    Args:
        current_user: Current authenticated user (from get_current_user dependency)

    Returns:
        User: Current admin user object

    Raises:
        HTTPException: 403 if user is not an admin

    Example:
        ```python
        @app.get("/api/v1/users")
        async def list_all_users(admin: User = Depends(get_current_admin)):
            # Only admins can list all users
            print(f"Admin {admin.username} is listing all users")
            return await get_all_users()
        ```

    Notes:
        - Automatically includes get_current_user validation
        - Returns 403 Forbidden (not 401) for non-admin users
        - Admin flag is stored in User.is_admin field
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required - Insufficient permissions"
        )

    return current_user


async def get_current_user_optional(
    request: Request,
    session: AsyncSession = Depends(get_session)
) -> User | None:
    """
    Get currently authenticated user if available, None otherwise.

    This is a non-blocking version of get_current_user for public pages that
    can optionally show user-specific content if authenticated.

    Supports both Telegram users and email-only users.

    Args:
        request: HTTP request with optional user_id in state
        session: Async database session

    Returns:
        Optional[User]: Current user if authenticated, None otherwise

    Example:
        ```python
        @app.get("/")
        async def home(user: Optional[User] = Depends(get_current_user_optional)):
            if user:
                return {"message": f"Welcome back, {user.username}"}
            return {"message": "Welcome, please log in"}
        ```
    """
    # Extract user_id from request state (set by JWT middleware)
    # user_id is present for both Telegram and email-only users
    user_id = getattr(request.state, "user_id", None)

    if user_id is None:
        # No authentication - return None for public access
        return None

    # Load user from database using user_id (primary key)
    # This works for both Telegram users and email-only users
    statement = select(User).where(User.id == user_id)
    result = await session.execute(statement)
    user = result.scalar_one_or_none()

    return user  # May be None if user was deleted


# Type aliases for cleaner endpoint signatures
CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentAdmin = Annotated[User, Depends(get_current_admin)]
CurrentUserOptional = Annotated[User | None, Depends(get_current_user_optional)]
