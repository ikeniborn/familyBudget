from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from backend.app.core.config import get_settings
from backend.app.api.v1.router import api_router
from backend.app.db.session import init_db, close_db
from backend.app.db.health import check_db_connection


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events.

    Startup: Initialize database connection
    Shutdown: Clean up database connections
    """
    # Startup
    print("Starting up...")
    await init_db()
    print("Database initialized")

    yield

    # Shutdown
    print("Shutting down...")
    await close_db()
    print("Database connections closed")


settings = get_settings()

app = FastAPI(
    title="Family Budget API",
    description="API for Family Budget Management System",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check endpoint
@app.get("/health")
async def health_check() -> dict[str, str | bool]:
    """
    Health check endpoint to verify API and database status.

    Returns:
        dict: Status message indicating API and database health
    """
    db_connected = await check_db_connection()

    return {
        "status": "ok" if db_connected else "degraded",
        "database": db_connected
    }


# Include API v1 router
app.include_router(api_router)
