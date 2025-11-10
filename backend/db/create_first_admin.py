#!/usr/bin/env python3
"""
Bootstrap script to create first admin user from ADMIN_TELEGRAM_ID environment variable.

This script creates the first administrator account using the Telegram ID specified
in the .env file (ADMIN_TELEGRAM_ID). This solves the bootstrap problem where:
- System requires users to be in database before authentication
- Only admins can create users via admin panel
- Admin panel requires authentication (catch-22!)

Usage:
    python backend/db/create_first_admin.py

    # Or via Docker:
    docker exec familybudget-backend bash -c "cd /app && PYTHONPATH=/app python backend/db/create_first_admin.py"

Features:
    - Idempotent: safe to run multiple times
    - Reads ADMIN_TELEGRAM_ID from .env
    - Creates user with is_admin=True
    - Uses SCD Type 2 structure (valid_from, valid_to, is_current)
    - Uses raw SQL to avoid model import issues
    - Detailed logging

Requirements:
    - Database must be initialized (migrations applied)
    - ADMIN_TELEGRAM_ID must be set in .env
    - Connection settings from environment (.env file)

After running:
    1. Admin user will exist in database
    2. Admin can authenticate via Telegram OAuth
    3. Profile (username, first_name) will be auto-updated on first login
    4. Admin can create other users via admin panel
"""

import asyncio
import logging
import os
import sys
from datetime import datetime
from pathlib import Path

# Add backend to path for imports
sys.path.insert(0, "/app")

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from backend.app.core.config import get_settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def create_first_admin() -> None:
    """
    Create first admin user from ADMIN_TELEGRAM_ID environment variable.

    Raises:
        ValueError: If ADMIN_TELEGRAM_ID is not set in environment
        Exception: If database operations fail
    """
    logger.info("=" * 70)
    logger.info("Bootstrap Script: Create First Admin User")
    logger.info("=" * 70)

    # Get settings
    settings = get_settings()
    admin_telegram_id = settings.ADMIN_TELEGRAM_ID

    if not admin_telegram_id:
        raise ValueError(
            "ADMIN_TELEGRAM_ID is not set in environment. "
            "Please set it in .env file and try again."
        )

    logger.info(f"Target admin Telegram ID: {admin_telegram_id}")

    # Prepare database connection
    database_url = settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
    engine = create_async_engine(database_url, echo=False)

    async with engine.connect() as conn:
        try:
            # Check if admin user already exists
            logger.info("Checking if admin user already exists...")
            check_query = text("""
                SELECT id, telegram_id, username, first_name, is_admin, created_at
                FROM t_d_user
                WHERE telegram_id = :telegram_id AND is_current = true
            """)
            result = await conn.execute(check_query, {"telegram_id": admin_telegram_id})
            existing_admin = result.fetchone()

            if existing_admin:
                logger.info("=" * 70)
                logger.info("✓ Admin user already exists!")
                logger.info(f"  - User ID: {existing_admin.id}")
                logger.info(f"  - Telegram ID: {existing_admin.telegram_id}")
                logger.info(f"  - Username: {existing_admin.username}")
                logger.info(f"  - First Name: {existing_admin.first_name}")
                logger.info(f"  - Is Admin: {existing_admin.is_admin}")
                logger.info(f"  - Created: {existing_admin.created_at}")
                logger.info("=" * 70)
                logger.info("No action needed. You can authenticate via Telegram OAuth.")
                return

            # Create new admin user
            logger.info("Creating new admin user...")
            insert_query = text("""
                INSERT INTO t_d_user (
                    telegram_id,
                    username,
                    first_name,
                    is_admin,
                    is_current,
                    valid_from,
                    valid_to,
                    created_at,
                    updated_at
                ) VALUES (
                    :telegram_id,
                    :username,
                    :first_name,
                    :is_admin,
                    :is_current,
                    :valid_from,
                    :valid_to,
                    :created_at,
                    :updated_at
                ) RETURNING id, telegram_id, username, is_admin
            """)

            now = datetime.utcnow()
            insert_params = {
                "telegram_id": admin_telegram_id,
                "username": "admin",  # Placeholder, will be updated on first Telegram login
                "first_name": "Admin",  # Placeholder, will be updated on first Telegram login
                "is_admin": True,
                "is_current": True,
                "valid_from": now,
                "valid_to": datetime(9999, 12, 31, 23, 59, 59),
                "created_at": now,
                "updated_at": now,
            }

            result = await conn.execute(insert_query, insert_params)
            await conn.commit()
            created_user = result.fetchone()

            logger.info("=" * 70)
            logger.info("✓ Admin user created successfully!")
            logger.info(f"  - User ID: {created_user.id}")
            logger.info(f"  - Telegram ID: {created_user.telegram_id}")
            logger.info(f"  - Username: {created_user.username} (placeholder)")
            logger.info(f"  - Is Admin: {created_user.is_admin}")
            logger.info("=" * 70)
            logger.info("Next steps:")
            logger.info("  1. Authenticate via Telegram OAuth:")
            logger.info(f"     https://{settings.DOMAIN}/api/v1/auth/telegram-login")
            logger.info("  2. Your profile (username, first_name) will be")
            logger.info("     automatically updated from Telegram on first login")
            logger.info("  3. You can now create other users via admin panel")
            logger.info("=" * 70)

        except Exception as e:
            logger.error("=" * 70)
            logger.error("✗ Error creating admin user!")
            logger.error(f"  Error: {e}")
            logger.error("=" * 70)
            await conn.rollback()
            raise
        finally:
            await engine.dispose()


async def main():
    """Main entry point."""
    try:
        await create_first_admin()
    except ValueError as e:
        logger.error(f"Configuration error: {e}")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
