"""
Database session management with async SQLModel.

Provides async database engine and session management for FastAPI endpoints.
"""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.config import get_settings

settings = get_settings()

# Create async engine with connection pooling
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,  # Set to True for SQL query logging
    future=True,
    pool_size=5,
    max_overflow=10,
)

# Create async session factory
async_session_maker = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that provides async database session.

    Yields:
        AsyncSession: Database session for the request

    Example:
        @app.get("/items")
        async def get_items(session: AsyncSession = Depends(get_session)):
            result = await session.execute(select(Item))
            return result.scalars().all()
    """
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


@asynccontextmanager
async def get_session_context():
    """
    Context manager for database session (for background jobs and scheduler).

    This is an alternative to get_session() for use outside of FastAPI dependency injection.
    Use this in background jobs, scheduler tasks, or standalone scripts.

    Usage:
        async with get_session_context() as session:
            result = await session.execute(select(Article))
            items = result.scalars().all()
            # Session commits automatically on exit

    Note:
        - For FastAPI endpoints, use get_session() dependency instead
        - Session automatically commits on success, rolls back on exception
        - Session closes automatically after context exits

    Yields:
        AsyncSession: Database session for background operations
    """
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """
    Initialize database (create tables if needed).

    Note: In production, use Alembic migrations instead.
    """
    async with engine.begin():
        # SQLModel.metadata.create_all would go here
        # But we're using migrations from EPIC-001
        pass


async def close_db() -> None:
    """
    Cleanup database connections on shutdown.
    """
    await engine.dispose()
