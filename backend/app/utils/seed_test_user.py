"""
Seed Test User for E2E Tests

Creates a test user with predefined credentials when TEST_MODE is enabled.
Used in E2E test environment (docker-compose.e2e.yml) to ensure test user exists.

Usage:
- Called automatically on backend startup when TEST_MODE=true
- Uses TEST_USER_EMAIL and TEST_USER_PASSWORD from environment variables
- Implements get_or_create pattern (idempotent - safe to run multiple times)

Security:
- Only runs in TEST_MODE (disabled in production)
- Credentials should be GitHub Actions secrets (not committed to git)
- Test database is ephemeral (tmpfs, no persistent data)
"""

import logging
import os
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.user import User
from backend.app.services.password_service import hash_password

logger = logging.getLogger(__name__)


async def seed_test_user(db: AsyncSession) -> Optional[User]:
    """
    Create or get test user for E2E tests.

    Args:
        db: Database session

    Returns:
        User object if created/found, None if TEST_MODE is disabled

    Raises:
        ValueError: If TEST_USER_EMAIL or TEST_USER_PASSWORD not set in TEST_MODE
    """
    # Check if TEST_MODE is enabled
    test_mode = os.getenv("TEST_MODE", "false").lower() == "true"

    if not test_mode:
        logger.debug("TEST_MODE disabled, skipping test user seeding")
        return None

    # Get test user credentials from environment
    test_email = os.getenv("TEST_USER_EMAIL")
    test_password = os.getenv("TEST_USER_PASSWORD")

    if not test_email or not test_password:
        raise ValueError(
            "TEST_USER_EMAIL and TEST_USER_PASSWORD must be set when TEST_MODE=true"
        )

    logger.info(f"[TEST_MODE] Seeding test user: {test_email}")

    # Check if user already exists (get_or_create pattern)
    stmt = select(User).where(User.email == test_email)
    result = await db.execute(stmt)
    existing_user = result.scalar_one_or_none()

    if existing_user:
        logger.info(f"[TEST_MODE] Test user already exists: {test_email} (id={existing_user.id})")
        return existing_user

    # Create new test user
    hashed_password = hash_password(test_password)

    new_user = User(
        email=test_email,
        hashed_password=hashed_password,
        is_active=True,
        is_superuser=False,
        telegram_id=None,  # E2E tests use email/password auth
        username=f"Test User ({test_email})",
    )

    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    logger.info(f"[TEST_MODE] ✓ Test user created: {test_email} (id={new_user.id})")

    return new_user
