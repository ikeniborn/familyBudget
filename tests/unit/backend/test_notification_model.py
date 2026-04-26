"""
Unit tests for Notification model.

Tests model validation, broadcast detection, and field constraints.
"""

from datetime import date, datetime
import pytest
from pydantic import ValidationError

from backend.app.models.notification import Notification


class TestNotificationModel:
    """Test Notification SQLModel."""

    def test_create_notification_minimal(self):
        """Test creating notification with minimal required fields."""
        notification = Notification(
            article_id=1,
            notification_type="budget_threshold",
            plan_amount=10000,
            actual_amount=9000,
            period_start=date(2025, 10, 1),
            period_end=date(2025, 10, 31),
        )

        assert notification.article_id == 1
        assert notification.notification_type == "budget_threshold"
        assert notification.plan_amount == 10000
        assert notification.actual_amount == 9000
        assert notification.period_start == date(2025, 10, 1)
        assert notification.period_end == date(2025, 10, 31)
        assert notification.threshold_percent == 90  # Default value
        assert notification.user_id is None  # Default (broadcast)

    def test_create_notification_full(self):
        """Test creating notification with all fields."""
        notification = Notification(
            id=1,
            user_id=123,
            article_id=5,
            notification_type="budget_exceeded",
            threshold_percent=100,
            plan_amount=5000,
            actual_amount=5500,
            period_start=date(2025, 10, 1),
            period_end=date(2025, 10, 31),
            created_at=datetime(2025, 10, 31, 12, 0, 0),
        )

        assert notification.id == 1
        assert notification.user_id == 123
        assert notification.article_id == 5
        assert notification.notification_type == "budget_exceeded"
        assert notification.threshold_percent == 100
        assert notification.plan_amount == 5000
        assert notification.actual_amount == 5500
        assert notification.period_start == date(2025, 10, 1)
        assert notification.period_end == date(2025, 10, 31)
        assert notification.created_at == datetime(2025, 10, 31, 12, 0, 0)

    def test_is_broadcast_true(self):
        """Test is_broadcast() returns True when user_id is None."""
        notification = Notification(
            user_id=None,  # Broadcast notification
            article_id=1,
            notification_type="budget_threshold",
            plan_amount=10000,
            actual_amount=9000,
            period_start=date(2025, 10, 1),
            period_end=date(2025, 10, 31),
        )

        assert notification.is_broadcast() is True

    def test_is_broadcast_false(self):
        """Test is_broadcast() returns False when user_id is set."""
        notification = Notification(
            user_id=123,  # User-specific notification
            article_id=1,
            notification_type="budget_threshold",
            plan_amount=10000,
            actual_amount=9000,
            period_start=date(2025, 10, 1),
            period_end=date(2025, 10, 31),
        )

        assert notification.is_broadcast() is False

    def test_notification_type_validation(self):
        """Test notification_type field validation."""
        notification = Notification(
            article_id=1,
            notification_type="budget_threshold",
            plan_amount=10000,
            actual_amount=9000,
            period_start=date(2025, 10, 1),
            period_end=date(2025, 10, 31),
        )
        assert notification.notification_type == "budget_threshold"

        # Test different notification types
        notification.notification_type = "budget_exceeded"
        assert notification.notification_type == "budget_exceeded"

        notification.notification_type = "weekly_report"
        assert notification.notification_type == "weekly_report"

    def test_threshold_percent_default(self):
        """Test threshold_percent has default value of 90."""
        notification = Notification(
            article_id=1,
            notification_type="budget_threshold",
            plan_amount=10000,
            actual_amount=9000,
            period_start=date(2025, 10, 1),
            period_end=date(2025, 10, 31),
        )

        assert notification.threshold_percent == 90

    def test_threshold_percent_custom(self):
        """Test setting custom threshold_percent."""
        notification = Notification(
            article_id=1,
            notification_type="budget_threshold",
            threshold_percent=80,
            plan_amount=10000,
            actual_amount=8000,
            period_start=date(2025, 10, 1),
            period_end=date(2025, 10, 31),
        )

        assert notification.threshold_percent == 80

    def test_integer_amounts(self):
        """Test that amounts are stored as integer rubles."""
        notification = Notification(
            article_id=1,
            notification_type="budget_threshold",
            plan_amount=10000,
            actual_amount=9000,
            period_start=date(2025, 10, 1),
            period_end=date(2025, 10, 31),
        )

        assert isinstance(notification.plan_amount, int)
        assert isinstance(notification.actual_amount, int)
        assert notification.plan_amount == 10000
        assert notification.actual_amount == 9000

    def test_date_fields(self):
        """Test period_start and period_end date fields."""
        notification = Notification(
            article_id=1,
            notification_type="budget_threshold",
            plan_amount=10000,
            actual_amount=9000,
            period_start=date(2025, 10, 1),
            period_end=date(2025, 10, 31),
        )

        assert isinstance(notification.period_start, date)
        assert isinstance(notification.period_end, date)
        assert notification.period_start == date(2025, 10, 1)
        assert notification.period_end == date(2025, 10, 31)

    def test_created_at_default(self):
        """Test created_at has default value (utcnow)."""
        notification = Notification(
            article_id=1,
            notification_type="budget_threshold",
            plan_amount=10000,
            actual_amount=9000,
            period_start=date(2025, 10, 1),
            period_end=date(2025, 10, 31),
        )

        # created_at should be set automatically
        assert notification.created_at is not None
        assert isinstance(notification.created_at, datetime)

        # Should be close to current time (within 1 second)
        time_diff = (datetime.utcnow() - notification.created_at).total_seconds()
        assert abs(time_diff) < 1.0

    def test_missing_required_fields(self):
        """Test validation fails when required fields are missing."""
        # Import NotificationCreate schema for validation testing
        # (Notification SQLModel with table=True doesn't validate required fields for ORM compatibility)
        from backend.app.schemas.notification import NotificationCreate

        # Missing article_id
        with pytest.raises(ValidationError) as exc_info:
            NotificationCreate(
                notification_type="budget_threshold",
                plan_amount=10000,
                actual_amount=9000,
                period_start=date(2025, 10, 1),
                period_end=date(2025, 10, 31),
            )
        assert "article_id" in str(exc_info.value)

        # Missing notification_type
        with pytest.raises(ValidationError) as exc_info:
            NotificationCreate(
                article_id=1,
                plan_amount=10000,
                actual_amount=9000,
                period_start=date(2025, 10, 1),
                period_end=date(2025, 10, 31),
            )
        assert "notification_type" in str(exc_info.value)

        # Missing plan_amount
        with pytest.raises(ValidationError) as exc_info:
            NotificationCreate(
                article_id=1,
                notification_type="budget_threshold",
                actual_amount=9000,
                period_start=date(2025, 10, 1),
                period_end=date(2025, 10, 31),
            )
        assert "plan_amount" in str(exc_info.value)

    def test_user_id_nullable(self):
        """Test user_id can be None (for broadcast notifications)."""
        # Explicit None
        notification = Notification(
            user_id=None,
            article_id=1,
            notification_type="budget_threshold",
            plan_amount=10000,
            actual_amount=9000,
            period_start=date(2025, 10, 1),
            period_end=date(2025, 10, 31),
        )
        assert notification.user_id is None

        # Omitted (defaults to None)
        notification2 = Notification(
            article_id=1,
            notification_type="budget_threshold",
            plan_amount=10000,
            actual_amount=9000,
            period_start=date(2025, 10, 1),
            period_end=date(2025, 10, 31),
        )
        assert notification2.user_id is None


class TestNotificationBroadcastLogic:
    """Test broadcast-specific logic."""

    def test_broadcast_notification_scenario(self):
        """Test complete broadcast notification scenario."""
        # Create broadcast notification (user_id=None)
        notification = Notification(
            user_id=None,  # Broadcast
            article_id=10,
            notification_type="budget_exceeded",
            threshold_percent=100,
            plan_amount=50000,
            actual_amount=52000,
            period_start=date(2025, 10, 1),
            period_end=date(2025, 10, 31),
        )

        # Verify broadcast status
        assert notification.is_broadcast() is True
        assert notification.user_id is None

        # Verify other fields
        assert notification.article_id == 10
        assert notification.notification_type == "budget_exceeded"
        assert notification.actual_amount > notification.plan_amount

    def test_user_specific_notification_scenario(self):
        """Test complete user-specific notification scenario."""
        # Create user-specific notification
        notification = Notification(
            user_id=999,  # Specific user
            article_id=5,
            notification_type="budget_threshold",
            threshold_percent=90,
            plan_amount=20000,
            actual_amount=18000,
            period_start=date(2025, 10, 1),
            period_end=date(2025, 10, 31),
        )

        # Verify NOT broadcast
        assert notification.is_broadcast() is False
        assert notification.user_id == 999

        # Verify notification data
        percent = (notification.actual_amount / notification.plan_amount) * 100
        assert percent >= notification.threshold_percent
