"""
User data isolation helpers.

This module provides helper functions for implementing user-level data isolation
in multi-tenant scenarios. Each user should only access their own data unless
they have admin privileges.

Key Principle: WHERE user_id = current_user.id
"""

from typing import TypeVar

from sqlalchemy import Select
from sqlmodel import SQLModel

from backend.app.models.user import User

T = TypeVar("T", bound=SQLModel)


def apply_user_filter(statement: Select[tuple[T]], user: User, user_id_column: str = "user_id") -> Select[tuple[T]]:
    """
    Apply user isolation filter to SQLAlchemy statement.

    Adds WHERE clause to filter results by user_id, unless user is admin.
    Admin users can see all data without filtering.

    Args:
        statement: SQLAlchemy SELECT statement to filter
        user: Current authenticated user
        user_id_column: Name of the user_id column (default: "user_id")

    Returns:
        Select: Filtered statement with WHERE user_id = current_user.id (if not admin)

    Example:
        ```python
        from backend.app.models import Fact

        # Create base query
        statement = select(Fact).where(Fact.date >= start_date)

        # Apply user isolation
        statement = apply_user_filter(statement, current_user)

        # Execute query - user sees only their facts
        result = await session.execute(statement)
        facts = result.scalars().all()
        ```

    Notes:
        - Admins bypass filtering (can see all data)
        - Uses SQLModel column attribute lookup
        - Type-safe with generics
    """
    # Admins can see all data
    if user.is_admin:
        return statement

    # Regular users see only their own data
    # Get the model class from the statement
    model_class = statement.column_descriptions[0]["type"]

    # Add WHERE user_id = current_user.id
    user_id_attr = getattr(model_class, user_id_column)
    return statement.where(user_id_attr == user.id)


def can_access_resource(resource_user_id: int, current_user: User) -> bool:
    """
    Check if current user can access a resource owned by another user.

    Returns True if:
    - Resource belongs to current user (resource_user_id == current_user.id)
    - Current user is admin (can access all resources)

    Args:
        resource_user_id: User ID that owns the resource
        current_user: Current authenticated user

    Returns:
        bool: True if access is allowed, False otherwise

    Example:
        ```python
        # In endpoint
        fact = await get_fact_by_id(fact_id)

        if not can_access_resource(fact.user_id, current_user):
            raise HTTPException(status_code=403, detail="Access denied")

        return fact
        ```

    Notes:
        - Use this for individual resource access checks
        - For bulk queries, use apply_user_filter() instead
    """
    return current_user.is_admin or resource_user_id == current_user.id


def ensure_user_owns_resource(resource_user_id: int, current_user: User) -> None:
    """
    Ensure current user owns the resource, raise 403 if not.

    Convenience wrapper around can_access_resource() that raises HTTPException
    if access is denied.

    Args:
        resource_user_id: User ID that owns the resource
        current_user: Current authenticated user

    Raises:
        HTTPException: 403 Forbidden if user cannot access resource

    Example:
        ```python
        from fastapi import HTTPException, status

        # In endpoint
        fact = await get_fact_by_id(fact_id)

        # Raises 403 automatically if access denied
        ensure_user_owns_resource(fact.user_id, current_user)

        # Continue with update/delete
        await update_fact(fact_id, new_data)
        ```

    Notes:
        - Simplifies endpoint code (no manual if checks)
        - Consistent error message across application
        - Admin users bypass the check
    """
    from fastapi import HTTPException, status

    if not can_access_resource(resource_user_id, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied - You do not have permission to access this resource"
        )


def get_user_id_for_create(current_user: User) -> int:
    """
    Get user_id to assign when creating a new resource.

    Always returns current_user.id. This helper exists for consistency
    and to make intent explicit in endpoint code.

    Args:
        current_user: Current authenticated user

    Returns:
        int: User ID to assign to new resource

    Example:
        ```python
        @app.post("/api/v1/facts")
        async def create_fact(
            fact_data: FactCreate,
            current_user: User = Depends(get_current_user)
        ):
            # Assign current user as owner
            fact = Fact(
                **fact_data.dict(),
                user_id=get_user_id_for_create(current_user)
            )
            session.add(fact)
            await session.commit()
            return fact
        ```

    Notes:
        - Even admins create resources under their own user_id
        - For "create as different user", implement separate endpoint
    """
    return current_user.id
