"""Alembic environment configuration for Family Budget.

This module configures Alembic for managing database migrations in Production Mode.

Production ready since v5.0.0.
"""

import os
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool, text

# Add /app to sys.path to enable backend module imports
app_root = Path(__file__).resolve().parents[3]  # /app
if str(app_root) not in sys.path:
    sys.path.insert(0, str(app_root))

# Import all SQLModel models to ensure metadata is populated

# Import metadata from SQLModel
from sqlmodel import SQLModel  # noqa: E402

# Alembic Config object
config = context.config

# Set sqlalchemy.url from environment variable (DATABASE_URL)
# Convert asyncpg:// to postgresql:// for Alembic (synchronous driver)
database_url = os.getenv("DATABASE_URL", "")
if database_url.startswith("postgresql+asyncpg://"):
    database_url = database_url.replace("postgresql+asyncpg://", "postgresql://")
config.set_main_option("sqlalchemy.url", database_url)

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Add your model's MetaData object here for 'autogenerate' support
target_metadata = SQLModel.metadata

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (SQL script generation)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode (direct database connection)."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    # Use begin() instead of connect() to create a transactional context
    # This ensures that changes are committed when the context exits
    with connectable.begin() as connection:
        # Set ADMIN_TELEGRAM_ID for baseline migration bootstrap
        admin_telegram_id = os.getenv("ADMIN_TELEGRAM_ID")
        if admin_telegram_id:
            connection.execute(text(f"SET LOCAL app.admin_telegram_id = '{admin_telegram_id}'"))

        context.configure(
            connection=connection,
            target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
