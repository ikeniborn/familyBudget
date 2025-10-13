"""
FastAPI dependency injection functions.

These dependencies will be used throughout the application for:
- Database session management
- User authentication and authorization
- Configuration access
"""

from backend.app.core.config import get_settings
from backend.app.db.session import get_session

# Current user dependency (TASK-014)
# async def get_current_user():
#     """
#     Extracts and validates JWT token, returns current user.
#     Will be implemented in TASK-014.
#     """
#     pass

# Current admin dependency (TASK-014)
# async def get_current_admin():
#     """
#     Validates that current user is an admin.
#     Will be implemented in TASK-014.
#     """
#     pass

__all__ = [
    "get_settings",
    "get_session",  # TASK-011: Database session dependency
    # "get_current_user",  # Uncomment in TASK-014
    # "get_current_admin",  # Uncomment in TASK-014
]
