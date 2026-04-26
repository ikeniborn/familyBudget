"""
Unit tests for User model (SCD Type 1).

Tests verify that User model has correct fields and constraints after
migration from SCD Type 2 to SCD Type 1 architecture.
"""

import pytest
from datetime import datetime

from backend.app.models.user import User


def test_user_model_fields():
    """Test User model has correct fields (SCD1 - no SCD2 fields)."""
    user = User(
        telegram_id=123456789,
        username="testuser",
        first_name="Test",
        last_name="User",
        photo_url="/static/avatars/123.jpg",
        is_admin=False,
        is_active=True,
        last_login_at=datetime.utcnow()
    )

    # Check profile fields
    assert user.telegram_id == 123456789
    assert user.username == "testuser"
    assert user.first_name == "Test"
    assert user.last_name == "User"
    assert user.photo_url == "/static/avatars/123.jpg"

    # Check status fields
    assert user.is_admin is False
    assert user.is_active is True
    assert user.last_login_at is not None

    # Check SCD2 fields are REMOVED (breaking change from previous version)
    assert not hasattr(user, 'valid_from'), "valid_from should be removed (moved to UserHistory)"
    assert not hasattr(user, 'valid_to'), "valid_to should be removed (moved to UserHistory)"
    assert not hasattr(user, 'is_current'), "is_current should be removed (moved to UserHistory)"


def test_user_telegram_id_unique():
    """Test telegram_id has unique constraint."""
    # Check via SQLAlchemy table column (sa_column carries DB constraints)
    telegram_id_col = User.__table__.columns['telegram_id']
    assert telegram_id_col.unique is True, \
        "telegram_id should have unique constraint"


def test_user_default_values():
    """Test User model has correct default values."""
    user = User(
        telegram_id=123456789
    )

    # Check defaults
    assert user.username is None  # Optional
    assert user.first_name is None  # Optional
    assert user.last_name is None  # Optional
    assert user.photo_url is None  # Optional
    assert user.is_admin is False  # Default False
    assert user.is_active is False  # Default False (requires admin activation)
    assert user.last_login_at is None  # Optional
    assert user.created_at is not None  # Auto-generated
    assert user.updated_at is not None  # Auto-generated


def test_user_required_fields():
    """Test User model enforces 'telegram_id OR email' constraint at table level."""
    # Both telegram_id and email are nullable individually (User() instantiates),
    # but a CHECK constraint requires at least one to be set.
    constraints = [c.sqltext.text for c in User.__table__.constraints if hasattr(c, 'sqltext')]
    assert any('telegram_id' in s and 'email' in s for s in constraints), \
        "User table must have CHECK constraint requiring telegram_id OR email"


def test_user_repr():
    """Test User model __repr__ returns correct string."""
    user = User(
        id=1,
        telegram_id=123456789,
        username="testuser",
        first_name="Test",
        last_name="User",
        is_admin=True,
        is_active=True
    )

    repr_str = repr(user)
    assert "User(id=1" in repr_str
    assert "telegram_id=123456789" in repr_str
    assert "username=testuser" in repr_str
    assert "first_name=Test" in repr_str
    assert "last_name=User" in repr_str
    assert "is_admin=True" in repr_str
    assert "is_active=True" in repr_str


def test_user_tablename():
    """Test User model uses correct table name."""
    assert User.__tablename__ == "t_d_user"


def test_user_indexes():
    """Test User model has correct indexes."""
    cols = User.__table__.columns
    assert cols['telegram_id'].index is True
    assert cols['is_active'].index is True
    assert cols['last_login_at'].index is True


def test_user_scd1_architecture():
    """Test User model follows SCD Type 1 architecture (no versioning)."""
    user = User(
        telegram_id=123456789,
        username="john_doe"
    )

    # Verify SCD1 characteristics:
    # 1. NO version fields (valid_from, valid_to, is_current)
    assert not hasattr(user, 'valid_from')
    assert not hasattr(user, 'valid_to')
    assert not hasattr(user, 'is_current')

    # 2. Stable PK (id field exists and is primary key)
    assert User.__table__.columns['id'].primary_key is True

    # 3. Business key (telegram_id) is unique
    assert User.__table__.columns['telegram_id'].unique is True
