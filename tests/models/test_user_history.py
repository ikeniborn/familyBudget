"""
Unit tests for UserHistory model (SCD Type 2).

Tests verify that UserHistory model correctly stores full change history
with temporal validity fields and audit metadata.
"""

import pytest
from datetime import datetime

from backend.app.models.user_history import UserHistory


def test_user_history_model_fields():
    """Test UserHistory model has correct fields (SCD2)."""
    valid_from = datetime.utcnow()

    history = UserHistory(
        user_id=1,
        telegram_id=123456789,
        username="testuser",
        first_name="Test",
        last_name="User",
        photo_url="/static/avatars/123.jpg",
        is_admin=False,
        is_active=True,
        last_login_at=datetime.utcnow(),
        valid_from=valid_from,
        is_current=True,
        change_type="CREATE"
    )

    # Check profile snapshot fields
    assert history.user_id == 1
    assert history.telegram_id == 123456789
    assert history.username == "testuser"
    assert history.first_name == "Test"
    assert history.last_name == "User"
    assert history.photo_url == "/static/avatars/123.jpg"

    # Check status snapshot fields
    assert history.is_admin is False
    assert history.is_active is True
    assert history.last_login_at is not None

    # Check SCD2 fields present (temporal validity)
    assert hasattr(history, 'valid_from')
    assert hasattr(history, 'valid_to')
    assert hasattr(history, 'is_current')
    assert history.valid_from == valid_from
    assert history.is_current is True

    # Check audit metadata fields
    assert history.change_type == "CREATE"
    assert hasattr(history, 'changed_fields')
    assert hasattr(history, 'changed_by_user_id')


def test_user_history_fk_constraint():
    """Test user_id has FK to t_d_user.id."""
    user_id_col = UserHistory.__table__.columns['user_id']
    fks = list(user_id_col.foreign_keys)
    assert any(fk.target_fullname == "t_d_user.id" for fk in fks), \
        "user_id should have FK constraint to t_d_user.id"


def test_user_history_default_values():
    """Test UserHistory model has correct default values."""
    history = UserHistory(
        user_id=1,
        telegram_id=123456789,
        is_admin=False,
        is_active=False,
        valid_from=datetime.utcnow()
    )

    # Check defaults
    assert history.username is None  # Optional
    assert history.first_name is None  # Optional
    assert history.last_name is None  # Optional
    assert history.photo_url is None  # Optional
    assert history.last_login_at is None  # Optional
    # Default 9999-12-31 (timezone-aware UTC)
    assert history.valid_to.replace(tzinfo=None) == datetime(9999, 12, 31, 23, 59, 59)
    assert history.is_current is True  # Default True
    assert history.change_type is None  # Optional
    assert history.changed_fields is None  # Optional
    assert history.changed_by_user_id is None  # Optional
    assert history.created_at is not None  # Auto-generated


def test_user_history_required_fields():
    """Test UserHistory model marks required columns as NOT NULL at DB level."""
    cols = UserHistory.__table__.columns
    for required in ('user_id', 'is_admin', 'is_active', 'valid_from', 'valid_to', 'is_current'):
        assert cols[required].nullable is False, \
            f"{required} should be NOT NULL"


def test_user_history_change_types():
    """Test UserHistory model supports different change types."""
    # CREATE change
    create_history = UserHistory(
        user_id=1,
        telegram_id=123456789,
        username="john_doe",
        is_admin=False,
        is_active=False,
        valid_from=datetime.utcnow(),
        change_type="CREATE"
    )
    assert create_history.change_type == "CREATE"

    # UPDATE change
    update_history = UserHistory(
        user_id=1,
        telegram_id=123456789,
        username="john_updated",
        is_admin=False,
        is_active=False,
        valid_from=datetime.utcnow(),
        change_type="UPDATE",
        changed_fields=["username"]
    )
    assert update_history.change_type == "UPDATE"
    assert update_history.changed_fields == ["username"]

    # ROLE_CHANGE change
    role_change_history = UserHistory(
        user_id=1,
        telegram_id=123456789,
        username="john_doe",
        is_admin=True,  # Changed
        is_active=True,  # Changed
        valid_from=datetime.utcnow(),
        change_type="ROLE_CHANGE",
        changed_fields=["is_admin", "is_active"],
        changed_by_user_id=2  # Admin who made the change
    )
    assert role_change_history.change_type == "ROLE_CHANGE"
    assert role_change_history.changed_fields == ["is_admin", "is_active"]
    assert role_change_history.changed_by_user_id == 2

    # LOGIN change
    login_history = UserHistory(
        user_id=1,
        telegram_id=123456789,
        username="john_doe",
        is_admin=False,
        is_active=True,
        last_login_at=datetime.utcnow(),
        valid_from=datetime.utcnow(),
        change_type="LOGIN",
        changed_fields=["last_login_at"]
    )
    assert login_history.change_type == "LOGIN"


def test_user_history_repr():
    """Test UserHistory model __repr__ returns correct string."""
    valid_from = datetime.utcnow()
    history = UserHistory(
        history_id=1,
        user_id=2,
        telegram_id=123456789,
        username="testuser",
        is_admin=False,
        is_active=True,
        valid_from=valid_from,
        is_current=True,
        change_type="CREATE"
    )

    repr_str = repr(history)
    assert "UserHistory(history_id=1" in repr_str
    assert "user_id=2" in repr_str
    assert "telegram_id=123456789" in repr_str
    assert "username=testuser" in repr_str
    assert "is_current=True" in repr_str
    assert "change_type=CREATE" in repr_str


def test_user_history_tablename():
    """Test UserHistory model uses correct table name."""
    assert UserHistory.__tablename__ == "t_d_user_history"


def test_user_history_indexes():
    """Test UserHistory model has correct indexes."""
    cols = UserHistory.__table__.columns
    assert cols['user_id'].index is True
    assert cols['telegram_id'].index is True
    assert cols['valid_from'].index is True
    assert cols['is_current'].index is True


def test_user_history_scd2_architecture():
    """Test UserHistory model follows SCD Type 2 architecture."""
    history = UserHistory(
        user_id=1,
        telegram_id=123456789,
        username="john_doe",
        is_admin=False,
        is_active=False,
        valid_from=datetime.utcnow()
    )

    # Verify SCD2 characteristics:
    # 1. Temporal validity fields present
    assert hasattr(history, 'valid_from')
    assert hasattr(history, 'valid_to')
    assert hasattr(history, 'is_current')

    # 2. Surrogate key for history records
    assert UserHistory.__table__.columns['history_id'].primary_key is True

    # 3. FK to stable User.id (not versioned)
    user_id_col = UserHistory.__table__.columns['user_id']
    fks = list(user_id_col.foreign_keys)
    assert any(fk.target_fullname == "t_d_user.id" for fk in fks)

    # 4. Audit metadata fields
    assert hasattr(history, 'change_type')
    assert hasattr(history, 'changed_fields')
    assert hasattr(history, 'changed_by_user_id')


def test_user_history_temporal_validity():
    """Test UserHistory model temporal validity workflow."""
    now = datetime.utcnow()

    # Create current version
    current_version = UserHistory(
        user_id=1,
        telegram_id=123456789,
        username="john_doe",
        is_admin=False,
        is_active=True,
        valid_from=now,
        valid_to=datetime(9999, 12, 31, 23, 59, 59),
        is_current=True,
        change_type="CREATE"
    )

    assert current_version.is_current is True
    assert current_version.valid_to == datetime(9999, 12, 31, 23, 59, 59)

    # Simulate closing old version
    old_version = UserHistory(
        user_id=1,
        telegram_id=123456789,
        username="john_old",
        is_admin=False,
        is_active=True,
        valid_from=datetime(2024, 1, 1),
        valid_to=now,  # Closed
        is_current=False,  # No longer current
        change_type="CREATE"
    )

    assert old_version.is_current is False
    assert old_version.valid_to == now
