"""
Push Notification Service for Family Budget.

Handles sending Web Push notifications to users via pywebpush.
Supports sending to individual users, excluding connected users (SSE),
and automatic cleanup of expired subscriptions.

Usage:
    from backend.app.services.push_service import PushService

    # Send to specific user
    await PushService.send_to_user(session, user_id, "Title", "Body", {"url": "/facts"})

    # Send to all users without active SSE connections
    await PushService.broadcast_except_connected(
        session, connected_user_ids, "Title", "Body", data
    )
"""

import logging
from datetime import datetime

from pywebpush import WebPushException, webpush
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from backend.app.core.config import get_settings
from backend.app.core.json_utils import dumps as json_dumps
from backend.app.models.push_subscription import PushSubscription

logger = logging.getLogger(__name__)
settings = get_settings()


class PushService:
    """Service for sending Web Push notifications."""

    @staticmethod
    def is_configured() -> bool:
        """Check if VAPID keys are properly configured."""
        if not settings.VAPID_PUBLIC_KEY or not settings.VAPID_PRIVATE_KEY:
            return False
        if "PLACEHOLDER" in settings.VAPID_PUBLIC_KEY:
            return False
        if "0123456789" in settings.VAPID_PUBLIC_KEY:
            return False
        if len(settings.VAPID_PUBLIC_KEY) < 65:
            return False
        return True

    @staticmethod
    async def send_to_subscription(
        subscription: PushSubscription,
        title: str,
        body: str,
        data: dict | None = None,
        session: AsyncSession | None = None
    ) -> bool:
        """
        Send push notification to a single subscription.

        Args:
            subscription: PushSubscription model instance
            title: Notification title
            body: Notification body text
            data: Optional data payload (e.g., {"url": "/facts"})
            session: Optional database session for cleanup on 410 Gone

        Returns:
            True if sent successfully, False otherwise
        """
        if not PushService.is_configured():
            logger.warning("[Push] VAPID not configured, skipping notification")
            return False

        subscription_info = {
            "endpoint": subscription.endpoint,
            "keys": {
                "p256dh": subscription.p256dh_key,
                "auth": subscription.auth_key
            }
        }

        payload = {
            "title": title,
            "body": body,
            "icon": "/static/icons/icon-192.png",
            "badge": "/static/icons/icon-192.png",
            "tag": "budget-notification",
            "data": data or {}
        }

        try:
            webpush(
                subscription_info=subscription_info,
                data=json_dumps(payload),
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims={"sub": f"mailto:{settings.VAPID_CONTACT_EMAIL}"}
            )

            # Update last_used_at
            if session:
                subscription.last_used_at = datetime.utcnow()
                session.add(subscription)
                # Don't commit here - let caller handle transaction

            logger.debug(
                f"[Push] Sent to user {subscription.user_id}: {title}"
            )
            return True

        except WebPushException as e:
            if e.response and e.response.status_code == 410:
                # 410 Gone - subscription expired, remove from database
                logger.info(
                    f"[Push] Subscription expired for user {subscription.user_id}, "
                    f"removing: {subscription.endpoint[:50]}..."
                )
                if session:
                    await session.delete(subscription)
                    # Don't commit here - let caller handle transaction
            else:
                logger.error(
                    f"[Push] Failed to send to user {subscription.user_id}: "
                    f"{e.response.status_code if e.response else 'Unknown error'}"
                )
            return False

        except Exception as e:
            logger.error(
                f"[Push] Unexpected error sending to user {subscription.user_id}: {e}"
            )
            return False

    @staticmethod
    async def send_to_user(
        session: AsyncSession,
        user_id: int,
        title: str,
        body: str,
        data: dict | None = None
    ) -> int:
        """
        Send push notification to all subscriptions of a specific user.

        Args:
            session: Database session
            user_id: Target user ID
            title: Notification title
            body: Notification body text
            data: Optional data payload

        Returns:
            Number of successfully sent notifications
        """
        if not PushService.is_configured():
            return 0

        statement = select(PushSubscription).where(
            PushSubscription.user_id == user_id
        )
        result = await session.execute(statement)
        subscriptions = result.scalars().all()

        if not subscriptions:
            logger.debug(f"[Push] No subscriptions for user {user_id}")
            return 0

        sent_count = 0
        for sub in subscriptions:
            if await PushService.send_to_subscription(sub, title, body, data, session):
                sent_count += 1

        await session.commit()
        return sent_count

    @staticmethod
    async def broadcast_except_connected(
        session: AsyncSession,
        connected_user_ids: set[int],
        title: str,
        body: str,
        data: dict | None = None
    ) -> int:
        """
        Send push notification to all users WITHOUT active SSE connections.

        This is the key method for integration with SSE:
        - Users with open tabs receive real-time updates via SSE
        - Users without open tabs receive push notifications

        Args:
            session: Database session
            connected_user_ids: Set of user IDs with active SSE connections
            title: Notification title
            body: Notification body text
            data: Optional data payload

        Returns:
            Number of successfully sent notifications
        """
        if not PushService.is_configured():
            return 0

        # Get all subscriptions for users NOT in connected set
        if connected_user_ids:
            statement = select(PushSubscription).where(
                PushSubscription.user_id.notin_(connected_user_ids)
            )
        else:
            # No connected users - send to all
            statement = select(PushSubscription)

        result = await session.execute(statement)
        subscriptions = result.scalars().all()

        if not subscriptions:
            logger.debug("[Push] No offline subscriptions to notify")
            return 0

        sent_count = 0
        notified_users = set()

        for sub in subscriptions:
            # Only send one notification per user (first subscription wins)
            if sub.user_id in notified_users:
                continue

            if await PushService.send_to_subscription(sub, title, body, data, session):
                sent_count += 1
                notified_users.add(sub.user_id)

        await session.commit()

        if sent_count > 0:
            logger.info(
                f"[Push] Broadcast to {sent_count} offline users: {title}"
            )

        return sent_count

    @staticmethod
    async def broadcast_all(
        session: AsyncSession,
        title: str,
        body: str,
        data: dict | None = None
    ) -> int:
        """
        Send push notification to ALL users (regardless of SSE status).

        Use this for important announcements that should reach everyone.

        Args:
            session: Database session
            title: Notification title
            body: Notification body text
            data: Optional data payload

        Returns:
            Number of successfully sent notifications
        """
        if not PushService.is_configured():
            return 0

        statement = select(PushSubscription)
        result = await session.execute(statement)
        subscriptions = result.scalars().all()

        if not subscriptions:
            return 0

        sent_count = 0
        notified_users = set()

        for sub in subscriptions:
            if sub.user_id in notified_users:
                continue

            if await PushService.send_to_subscription(sub, title, body, data, session):
                sent_count += 1
                notified_users.add(sub.user_id)

        await session.commit()

        if sent_count > 0:
            logger.info(f"[Push] Broadcast to all ({sent_count} users): {title}")

        return sent_count

    @staticmethod
    async def cleanup_expired(session: AsyncSession) -> int:
        """
        Clean up expired subscriptions.

        This can be called periodically (e.g., from scheduler) to remove
        subscriptions that haven't been used for a long time.

        Args:
            session: Database session

        Returns:
            Number of removed subscriptions
        """
        # For now, just log - actual cleanup happens on 410 responses
        # Could add logic to remove subscriptions not used in 30+ days
        logger.debug("[Push] Cleanup called (no-op for now)")
        return 0
