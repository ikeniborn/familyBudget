from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from .config import settings  # Import the settings instance

# Create the async engine using the DATABASE_URL from settings
# echo=True can be useful for debugging SQL queries, disable for production
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,  # Set to True to see generated SQL
    future=True  # Use SQLAlchemy 2.0 style
)

# Create a sessionmaker for creating AsyncSession instances
# expire_on_commit=False prevents attributes from expiring after commit
SessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,  # Explicit commit/rollback needed
    autoflush=False,  # Explicit flush needed
)

# Create a base class for declarative class definitions
Base = declarative_base()


# Dependency function to get a database session
async def get_db() -> AsyncSession:
    """
    FastAPI dependency that provides a database session per request.
    Ensures the session is closed afterwards.
    """
    async with SessionLocal() as session:
        try:
            yield session
            await session.commit()  # Commit transaction if no exceptions
        except Exception:
            await session.rollback()  # Rollback on error
            raise
        finally:
            await session.close()  # Ensure session is closed