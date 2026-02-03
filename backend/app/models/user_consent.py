"""
User Consent model for GDPR compliance.

This module defines the UserConsent model for tracking user consent
for cookies, analytics, and other data processing activities.

GDPR Requirements:
- Record what consents were given/withdrawn
- When they were given
- Store proof of consent (IP, user agent)
- Allow consent withdrawal at any time
- Keep historical records of consent changes
"""

from datetime import datetime

from sqlmodel import Field, SQLModel


class UserConsent(SQLModel, table=True):
    """
    User consent records for GDPR compliance.

    Stores explicit user consent for various data processing activities:
    - Essential cookies (required, cannot be disabled)
    - Analytics tracking
    - Push notifications
    - Data processing for personalization

    Table: t_user_consent
    Pattern: Append-only audit log (never update/delete existing records)

    Attributes:
        id: Surrogate primary key (auto-generated)
        user_id: User ID (NULL for anonymous/pre-login consent)
        session_id: Session ID for anonymous consent tracking
        consent_type: Type of consent (cookies, analytics, push, etc.)
        consent_given: Whether consent was granted (True) or withdrawn (False)
        privacy_policy_version: Version of privacy policy user agreed to
        ip_address: User's IP address at time of consent (legal proof)
        user_agent: User's browser user agent (legal proof)
        created_at: Timestamp when consent was recorded

    Consent Types:
        - essential: Essential cookies (always required, recorded for audit)
        - analytics: Analytics and usage tracking
        - push_notifications: Web push notifications
        - personalization: Personalized content and recommendations

    GDPR Notes:
        - Records are APPEND-ONLY - never update or delete
        - New consent = new record (tracks consent history)
        - Withdrawal = new record with consent_given=False
        - Latest record per user/consent_type is the current state

    Example:
        # Record initial cookie consent
        consent = UserConsent(
            user_id=1,
            consent_type="analytics",
            consent_given=True,
            privacy_policy_version="1.0",
            ip_address="192.168.1.100",
            user_agent="Mozilla/5.0...",
        )

        # Record consent withdrawal (new record)
        withdrawal = UserConsent(
            user_id=1,
            consent_type="analytics",
            consent_given=False,  # Withdrawal
            privacy_policy_version="1.0",
            ip_address="192.168.1.100",
            user_agent="Mozilla/5.0...",
        )
    """

    __tablename__ = "t_user_consent"

    # Primary key
    id: int | None = Field(
        default=None,
        primary_key=True,
        description="Surrogate primary key"
    )

    # User identification
    user_id: int | None = Field(
        default=None,
        foreign_key="t_d_user.id",
        nullable=True,
        index=True,
        description="User ID (NULL for anonymous/pre-login consent)"
    )

    session_id: str | None = Field(
        default=None,
        max_length=255,
        nullable=True,
        index=True,
        description="Session ID for anonymous consent tracking (pre-login)"
    )

    # Consent details
    consent_type: str = Field(
        nullable=False,
        max_length=50,
        index=True,
        description="Consent type: essential, analytics, push_notifications, personalization"
    )

    consent_given: bool = Field(
        nullable=False,
        description="True=consent granted, False=consent withdrawn"
    )

    privacy_policy_version: str = Field(
        default="1.0",
        max_length=20,
        nullable=False,
        description="Version of privacy policy at time of consent"
    )

    # Legal proof (required by GDPR)
    ip_address: str | None = Field(
        default=None,
        max_length=45,  # IPv6 max length
        nullable=True,
        description="User's IP address at time of consent"
    )

    user_agent: str | None = Field(
        default=None,
        max_length=500,
        nullable=True,
        description="User's browser user agent at time of consent"
    )

    # Audit timestamp
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        index=True,
        description="Timestamp when consent was recorded"
    )

    def __repr__(self) -> str:
        """String representation of UserConsent model."""
        action = "GRANTED" if self.consent_given else "WITHDRAWN"
        user = f"user_{self.user_id}" if self.user_id else f"session_{self.session_id}"
        return (
            f"UserConsent(id={self.id}, {user}, "
            f"type={self.consent_type}, {action}, "
            f"policy_v{self.privacy_policy_version})"
        )

    def is_anonymous(self) -> bool:
        """
        Check if this is anonymous consent (pre-login).

        Returns:
            bool: True if consent was recorded before user login
        """
        return self.user_id is None

    @classmethod
    def consent_types(cls) -> list:
        """
        Get list of valid consent types.

        Returns:
            list: Valid consent type strings
        """
        return [
            "essential",           # Required cookies (session, auth)
            "analytics",           # Usage analytics
            "push_notifications",  # Web push notifications
            "personalization",     # Personalized content
        ]
