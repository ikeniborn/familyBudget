#!/usr/bin/env python3
"""
Create admin user from environment variables.

This script creates an admin user with email/password authentication
if ADMIN_EMAIL and ADMIN_PASSWORD are set in environment.

The admin user can login WITHOUT 2FA requirement (security exception
for emergency system access).

Usage:
    python scripts/create_admin_user.py

Environment Variables:
    ADMIN_EMAIL: Admin email address (optional)
    ADMIN_PASSWORD: Admin password (plain text, will be hashed)
    ADMIN_TELEGRAM_ID: Admin Telegram ID (optional, for account linking)
    DATABASE_URL: PostgreSQL connection string (required)

Exit Codes:
    0: Success (admin created or already exists, or skipped if not configured)
    1: Error (missing DATABASE_URL, password validation failed, database error)

Security:
    - Password validated against OWASP 2023 requirements (min 12 chars, complexity)
    - Password hashed with Argon2id (memory-hard, GPU-resistant)
    - Admin flags: is_admin=True, is_active=True, two_factor_enabled=False
    - Idempotent: safe to run multiple times (updates existing admin if needed)
"""

import asyncio
import logging
import os
import sys
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel import select

# Configure logging first (before any log messages)
logging.basicConfig(
    level=logging.INFO,
    format='[%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)

# Add project root to path (for Docker container: /app)
# This allows imports like 'from backend.app.models...' to work correctly
# In Docker: script runs from /app/scripts/, so '..' points to /app (project root)
script_dir = os.path.dirname(__file__)
project_root = os.path.join(script_dir, '..')
sys.path.insert(0, project_root)

logger.info(f"[ADMIN_USER] Script directory: {script_dir}")
logger.info(f"[ADMIN_USER] Project root added to sys.path: {project_root}")
logger.info(f"[ADMIN_USER] sys.path[0] = {sys.path[0]}")

# Import from backend.app.* (requires /app in sys.path)
from backend.app.models.user import User
from backend.app.services.password_service import hash_password, validate_password_strength, verify_password
from backend.app.services.user_service import create_initial_history

# Security utilities
import hashlib


def hash_email_for_logging(email: str) -> str:
    """Hash email для безопасного логирования (первые 8 символов SHA256)."""
    if not email:
        return "empty_email"
    normalized_email = email.lower().strip()
    hash_obj = hashlib.sha256(normalized_email.encode('utf-8'))
    return hash_obj.hexdigest()[:8]


async def create_admin_user():
    """
    Create admin user from environment variables.

    Returns:
        int: Exit code (0=success, 1=error)
    """

    # =========================================================================
    # STEP 1: Validate Environment Variables
    # =========================================================================

    admin_email = os.getenv('ADMIN_EMAIL', '').strip()
    admin_password = os.getenv('ADMIN_PASSWORD', '').strip()
    database_url = os.getenv('DATABASE_URL', '').strip()

    # Admin email/password are optional (Telegram-only auth is valid)
    if not admin_email or not admin_password:
        logger.info(
            "[ADMIN_USER] ADMIN_EMAIL or ADMIN_PASSWORD not set - "
            "skipping email/password admin creation"
        )
        logger.info(
            "[ADMIN_USER] Admin can still authenticate via Telegram "
            "(ADMIN_TELEGRAM_ID)"
        )
        return 0

    if not database_url:
        logger.error("[ADMIN_USER] DATABASE_URL not set")
        logger.error("[ADMIN_USER] Cannot connect to database")
        return 1

    logger.info(f"[ADMIN_USER] Creating admin user: email_hash={hash_email_for_logging(admin_email)}")

    # =========================================================================
    # STEP 2: Validate Password Strength
    # =========================================================================

    is_strong, error_message = validate_password_strength(admin_password)
    if not is_strong:
        # НЕ логируем сам error_message (может содержать части пароля)
        logger.error("[ADMIN_USER] Password validation failed. Please check password requirements.")
        logger.error("[ADMIN_USER] Password requirements (OWASP 2023):")
        logger.error("[ADMIN_USER]   - Minimum 12 characters")
        logger.error("[ADMIN_USER]   - At least one uppercase letter (A-Z)")
        logger.error("[ADMIN_USER]   - At least one lowercase letter (a-z)")
        logger.error("[ADMIN_USER]   - At least one digit (0-9)")
        logger.error("[ADMIN_USER]   - At least one special character")
        logger.error("[ADMIN_USER]   - Not in common passwords list (top 100)")
        return 1

    logger.info("[ADMIN_USER] Password validation passed (OWASP 2023 compliant)")

    # =========================================================================
    # STEP 3: Connect to Database
    # =========================================================================

    engine = create_async_engine(database_url, echo=False)
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session() as session:
        try:
            # =================================================================
            # STEP 4: Check if Admin User Already Exists
            # =================================================================

            stmt = select(User).where(User.email == admin_email.lower())
            result = await session.execute(stmt)
            existing_user = result.scalar_one_or_none()

            if existing_user:
                logger.info(
                    f"[ADMIN_USER] Admin user already exists with user_id={existing_user.id}"
                )
                logger.info(
                    f"[ADMIN_USER] User flags: "
                    f"is_admin={existing_user.is_admin}, "
                    f"is_active={existing_user.is_active}, "
                    f"two_factor_enabled={existing_user.two_factor_enabled}"
                )

                # Update admin flags if needed
                updated = False

                if not existing_user.is_admin:
                    logger.warning(
                        f"[ADMIN_USER] User {admin_email} exists but is NOT admin - "
                        f"promoting to admin"
                    )
                    existing_user.is_admin = True
                    updated = True

                if not existing_user.is_active:
                    logger.warning(
                        f"[ADMIN_USER] User {admin_email} exists but is NOT active - "
                        f"activating"
                    )
                    existing_user.is_active = True
                    updated = True

                if existing_user.two_factor_enabled:
                    logger.warning(
                        f"[ADMIN_USER] User user_id={existing_user.id} has 2FA enabled - "
                        f"disabling for admin bypass"
                    )
                    existing_user.two_factor_enabled = False
                    updated = True

                # Update password if environment variable changed
                # (User may have changed password via web UI, so we check first)
                if not verify_password(admin_password, existing_user.password_hash):
                    logger.info(
                        f"[ADMIN_USER] Updating password for user_id={existing_user.id} "
                        f"(environment variable changed)"
                    )
                    existing_user.password_hash = hash_password(admin_password)
                    updated = True

                if updated:
                    existing_user.updated_at = datetime.utcnow()
                    session.add(existing_user)
                    await session.commit()
                    logger.info(f"[ADMIN_USER] Admin user updated: {admin_email}")
                else:
                    logger.info(
                        f"[ADMIN_USER] Admin user unchanged (flags and password "
                        f"already correct)"
                    )

                return 0

            # =================================================================
            # STEP 5: Create New Admin User
            # =================================================================

            # Link to Telegram ID if provided
            admin_telegram_id = os.getenv('ADMIN_TELEGRAM_ID', '').strip()
            telegram_id = int(admin_telegram_id) if admin_telegram_id else None

            admin_user = User(
                email=admin_email.lower(),
                password_hash=hash_password(admin_password),
                first_name="Admin",
                is_admin=True,
                is_active=True,
                two_factor_enabled=False,  # Admin bypass 2FA requirement
                telegram_id=telegram_id,  # Link to Telegram if provided
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )

            session.add(admin_user)
            await session.commit()
            await session.refresh(admin_user)

            logger.info("[ADMIN_USER] ✓ Admin user created successfully")
            logger.info(f"[ADMIN_USER] User ID: {admin_user.id}")
            logger.info(f"[ADMIN_USER] is_admin: {admin_user.is_admin}")
            logger.info(f"[ADMIN_USER] is_active: {admin_user.is_active}")
            logger.info(
                f"[ADMIN_USER] two_factor_enabled: {admin_user.two_factor_enabled} "
                f"(admin bypasses 2FA)"
            )
            if telegram_id:
                logger.info(f"[ADMIN_USER] Linked to Telegram ID: {telegram_id}")

            # =================================================================
            # STEP 6: Create Initial History Record (SCD Type 2)
            # =================================================================

            logger.info("[ADMIN_USER] Creating initial history record...")
            await create_initial_history(session=session, user=admin_user, change_type="CREATE")
            logger.info("[ADMIN_USER] ✓ Initial history record created")

            logger.info(
                "[ADMIN_USER] Admin can now login via:"
            )
            logger.info(
                "[ADMIN_USER]   - Email + Password (provided during setup)"
            )
            if telegram_id:
                logger.info(
                    f"[ADMIN_USER]   - Telegram OAuth: ID {telegram_id}"
                )

            logger.info(
                "[ADMIN_USER] ⚠️  SECURITY RECOMMENDATION: "
                "Change password after deployment via web UI"
            )

            return 0

        except Exception as e:
            logger.error(f"[ADMIN_USER] Database error: {e}")
            logger.error(
                "[ADMIN_USER] Admin user creation failed - check error above"
            )
            return 1
        finally:
            await engine.dispose()


if __name__ == "__main__":
    exit_code = asyncio.run(create_admin_user())
    sys.exit(exit_code)
