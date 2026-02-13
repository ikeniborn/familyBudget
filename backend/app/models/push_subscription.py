"""
Push Subscription model for Web Push notifications.

Stores browser push subscriptions for sending notifications via Web Push API.
Each user can have multiple subscriptions (different browsers/devices).
"""
from datetime import datetime

from sqlmodel import Field, SQLModel


class PushSubscription(SQLModel, table=True):
    """
    Web Push subscription for a user.

    Table: t_push_subscription
    Pattern: Service table (no SCD history tracking)

    A user can have multiple subscriptions (different browsers/devices).
    Subscriptions are automatically deleted when:
    - User is deleted (CASCADE)
    - Push endpoint returns 410 Gone (expired subscription)

    Attributes:
        id: Primary key
        user_id: Foreign key to user (CASCADE delete)
        endpoint: Push service endpoint URL (unique)
        p256dh_key: ECDH public key for encryption
        auth_key: Authentication secret
        user_agent: Browser user agent string for debugging
        created_at: When subscription was created
        last_used_at: When subscription was last successfully used
    """

    __tablename__ = "t_push_subscription"

    id: int | None = Field(
        default=None,
        primary_key=True,
        description="Auto-incrementing primary key"
    )

    user_id: int = Field(
        nullable=False,
        foreign_key="t_d_user.id",
        index=True,
        description="User who owns this subscription"
    )

    endpoint: str = Field(
        nullable=False,
        max_length=2000,
        description="Push service endpoint URL (unique per subscription)"
    )

    p256dh_key: str = Field(
        nullable=False,
        max_length=500,
        description="ECDH public key for message encryption (base64)"
    )

    auth_key: str = Field(
        nullable=False,
        max_length=100,
        description="Authentication secret for message encryption (base64)"
    )

    user_agent: str | None = Field(
        default=None,
        max_length=500,
        description="Browser user agent for debugging"
    )

    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        description="When subscription was created"
    )

    last_used_at: datetime | None = Field(
        default=None,
        description="When subscription was last successfully used for sending"
    )
