"""
Family Budget - FastAPI Backend Application
Main application entry point.
"""
import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
import redis.asyncio as redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.database import engine, Base, get_db
from app.core.session import SessionMiddleware, get_current_user_from_session
from app.api.v1.router import api_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan events."""
    # Startup
    print("Starting Family Budget API...")
    
    # Create database tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Initialize Redis connection
    app.state.redis = redis.from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True
    )
    
    # Test Redis connection
    try:
        await app.state.redis.ping()
        print("Redis connection established")
    except Exception as e:
        print(f"Redis connection failed: {e}")
        raise
    
    print("Family Budget API started successfully")
    
    yield
    
    # Shutdown
    print("Shutting down Family Budget API...")
    if hasattr(app.state, "redis"):
        await app.state.redis.close()
    print("Family Budget API shutdown complete")


# Create FastAPI application
app = FastAPI(
    title="Family Budget API",
    description="Budget management system with multi-user support and Telegram authentication",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Add trusted host middleware for production security
if settings.ENVIRONMENT == "production":
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=settings.ALLOWED_HOSTS
    )

# Add session middleware
app.add_middleware(SessionMiddleware)

# Include API router
app.include_router(api_router, prefix="/api")

# Startup event
@app.on_event("startup")
async def startup_event():
    print("FastAPI startup complete")


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "Family Budget API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    try:
        # Check Redis connection
        await app.state.redis.ping()
        
        # Check database connection
        from sqlalchemy import text
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
        
        return {
            "status": "healthy",
            "database": "connected",
            "redis": "connected",
            "environment": settings.ENVIRONMENT
        }
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "error": str(e)
            }
        )


@app.get("/api/dashboard")
async def dashboard_endpoint(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Dashboard endpoint - proxies to /api/reports/dashboard-stats."""
    from app.api.v1.endpoints.reports import get_dashboard_statistics
    
    # Get current user from session
    user = await get_current_user_from_session(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Call the actual dashboard statistics function
    return await get_dashboard_statistics(
        request=request,
        period_id=None,
        db=db,
        current_user=user
    )


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler for unhandled errors."""
    if isinstance(exc, HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": exc.detail}
        )
    
    # Log the error in production
    if settings.ENVIRONMENT == "production":
        print(f"Unhandled exception: {exc}")
    
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": str(exc) if settings.DEBUG else "An unexpected error occurred"
        }
    )


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "4000")),
        reload=settings.DEBUG,
        log_level="info" if settings.DEBUG else "warning"
    )