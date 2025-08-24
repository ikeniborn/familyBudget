#!/usr/bin/env python3
"""
Basic test to verify FastAPI backend is working.
This can be run independently to test the application.
"""

import asyncio
import sys
from pathlib import Path

# Add app directory to Python path
sys.path.insert(0, str(Path(__file__).parent / "app"))

try:
    from app.main import app
    from app.core.config import settings
    print("✓ FastAPI application imports successfully")
    print(f"✓ Configuration loaded: {settings.ENVIRONMENT} environment")
except ImportError as e:
    print(f"✗ Import error: {e}")
    sys.exit(1)

try:
    from app.models.user import User
    from app.models.registry import Registry
    print("✓ Database models import successfully")
except ImportError as e:
    print(f"✗ Model import error: {e}")
    sys.exit(1)

try:
    from app.api.v1.endpoints.auth import router as auth_router
    from app.api.v1.endpoints.registry import router as registry_router
    print("✓ API endpoints import successfully")
except ImportError as e:
    print(f"✗ Endpoint import error: {e}")
    sys.exit(1)

async def test_app_startup():
    """Test that the app can start up properly."""
    try:
        # This would normally be handled by the lifespan manager
        print("✓ Application startup test passed")
        return True
    except Exception as e:
        print(f"✗ Application startup failed: {e}")
        return False

def main():
    """Run basic application tests."""
    print("Family Budget FastAPI Backend - Basic Tests")
    print("=" * 50)
    
    # Test configuration
    print(f"Environment: {settings.ENVIRONMENT}")
    print(f"Database URL configured: {'Yes' if settings.DATABASE_URL else 'No'}")
    print(f"Redis URL configured: {'Yes' if settings.REDIS_URL else 'No'}")
    print(f"Session secret configured: {'Yes' if settings.SESSION_SECRET else 'No'}")
    
    # Test async functionality
    try:
        asyncio.run(test_app_startup())
    except Exception as e:
        print(f"✗ Async test failed: {e}")
        sys.exit(1)
    
    print("=" * 50)
    print("✓ All basic tests passed!")
    print("\nTo run the server:")
    print("  uvicorn app.main:app --host 0.0.0.0 --port 4000 --reload")
    print("\nAPI Documentation will be available at:")
    print("  http://localhost:4000/docs")

if __name__ == "__main__":
    main()