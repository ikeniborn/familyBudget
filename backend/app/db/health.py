"""
Database health check utilities.

Provides functions to verify database connectivity for health endpoints.
"""

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from backend.app.db.session import engine


async def check_db_connection() -> bool:
    """
    Check database connectivity by executing a simple query.

    Returns:
        bool: True if database is accessible, False otherwise

    Example:
        @app.get("/health")
        async def health_check():
            db_ok = await check_db_connection()
            return {
                "status": "ok" if db_ok else "degraded",
                "database": "connected" if db_ok else "disconnected"
            }
    """
    try:
        async with engine.connect() as conn:
            # Execute simple query to verify connection
            await conn.execute(text("SELECT 1"))
            return True
    except SQLAlchemyError as e:
        # Log the error (logging will be added in TASK-022)
        print(f"Database health check failed: {e}")
        return False
    except Exception as e:
        print(f"Unexpected error in health check: {e}")
        return False


async def get_db_status() -> dict[str, str]:
    """
    Get detailed database status information.

    Returns:
        dict: Database status with connection state and details
    """
    is_connected = await check_db_connection()

    if is_connected:
        return {
            "status": "connected",
            "message": "Database is accessible"
        }
    else:
        return {
            "status": "disconnected",
            "message": "Database connection failed"
        }
