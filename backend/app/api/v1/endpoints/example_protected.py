"""
Example protected endpoints demonstrating TASK-014 usage.

This file shows how to use authentication dependencies and user isolation
helpers from TASK-014. DELETE or modify when implementing TASK-015-017.
"""

from fastapi import APIRouter, Depends
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.dependencies import (
    CurrentAdmin,
    CurrentUser,
    apply_user_filter,
    get_session,
)
from backend.app.models.fact import Fact

router = APIRouter(prefix="/example", tags=["Examples"])


@router.get("/user-info")
async def get_user_info(current_user: CurrentUser):
    """
    Example: Get current user information.

    Demonstrates:
    - Using CurrentUser type alias (Annotated[User, Depends(get_current_user)])
    - Automatic user loading from database
    - No manual JWT decoding required
    """
    return {
        "user_id": current_user.id,
        "telegram_id": current_user.telegram_id,
        "username": current_user.username,
        "first_name": current_user.first_name,
        "is_admin": current_user.is_admin,
    }


@router.get("/my-facts")
async def get_my_facts(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session)
):
    """
    Example: Get user's facts with automatic user isolation.

    Demonstrates:
    - Using apply_user_filter() for automatic WHERE user_id filtering
    - Admin users see all facts
    - Regular users see only their own facts
    """
    # Base query
    statement = select(Fact)

    # Apply user isolation (admins see all, users see only theirs)
    statement = apply_user_filter(statement, current_user)

    # Execute query
    result = await session.execute(statement)
    facts = result.scalars().all()

    return {
        "count": len(facts),
        "facts": facts,
        "note": "Admins see all facts, regular users see only their own"
    }


@router.get("/admin-only")
async def admin_only_endpoint(admin: CurrentAdmin):
    """
    Example: Admin-only endpoint.

    Demonstrates:
    - Using CurrentAdmin type alias (Annotated[User, Depends(get_current_admin)])
    - Automatic 403 Forbidden for non-admin users
    - No manual is_admin checking required
    """
    return {
        "message": "This endpoint is only accessible to admins",
        "admin_username": admin.username,
        "note": "Non-admin users receive 403 Forbidden automatically"
    }


# Example responses for documentation:
"""
GET /api/v1/example/user-info

Response (200 OK):
{
  "user_id": 1,
  "telegram_id": 123456789,
  "username": "john_doe",
  "first_name": "John",
  "is_admin": false
}

---

GET /api/v1/example/my-facts

Response (200 OK):
{
  "count": 5,
  "facts": [...],
  "note": "Admins see all facts, regular users see only their own"
}

---

GET /api/v1/example/admin-only

Response for admin (200 OK):
{
  "message": "This endpoint is only accessible to admins",
  "admin_username": "admin_user",
  "note": "Non-admin users receive 403 Forbidden automatically"
}

Response for non-admin (403 Forbidden):
{
  "detail": "Admin access required - Insufficient permissions"
}
"""
