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

    Args:
        request: HTTP request with user_id in state (from JWT middleware)
        session: Async database session

    Returns:
        User: Current user object (with is_current=True)

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
        - Only loads current version (WHERE is_current=True)
        - User object includes all fields (id, telegram_id, username, is_admin, etc.)
    """
    # Extract user_id from request state (set by JWT middleware)
    user_id = getattr(request.state, "user_id", None)

    if user_id is None:
        # This should never happen if JWT middleware is working correctly
        # But we check defensively
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required - User ID not found in request state"
        )

    # Load user from database (current version only)
    statement = select(User).where(
        User.id == user_id,
        User.is_current == True  # noqa: E712 (SQLModel requires == True, not 'is True')
    )
    result = await session.execute(statement)
    user = result.scalar_one_or_none()

    if user is None:
        # User exists in JWT but not in database (deleted or invalid)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found - Account may have been deleted"
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


# Type aliases for cleaner endpoint signatures
CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentAdmin = Annotated[User, Depends(get_current_admin)]
