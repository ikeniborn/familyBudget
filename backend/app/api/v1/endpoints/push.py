"""
Push Notification API endpoints for Family Budget PWA.

Provides VAPID key management and push subscription handling for web push notifications.

Browser Support:
- Chrome/Edge: ✅ Full support
- Safari 16.4+: ✅ Full support
- Яндекс.Браузер: ✅ Full support
"""

import logging
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from backend.app.core.auth import get_current_user
from backend.app.core.config import get_settings
from backend.app.db.session import get_session
from backend.app.models.push_subscription import PushSubscription
from backend.app.models.user import User
from backend.app.schemas.push import (
    PushNotificationRequest,
    PushSubscriptionCreate,
    PushSubscriptionResponse,
    VAPIDKeyResponse,
)

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/push", tags=["push"])


def is_vapid_configured() -> bool:
    """Check if VAPID keys are properly configured."""
    if not settings.VAPID_PUBLIC_KEY or not settings.VAPID_PRIVATE_KEY:
        return False
    # Check for placeholder values
    if "PLACEHOLDER" in settings.VAPID_PUBLIC_KEY:
        return False
    if "0123456789" in settings.VAPID_PUBLIC_KEY:
        return False
    # Valid VAPID public key should be at least 65 chars (base64url encoded)
    if len(settings.VAPID_PUBLIC_KEY) < 65:
        return False
    return True


@router.get("/vapid-key", response_model=VAPIDKeyResponse)
async def get_vapid_key() -> dict[str, str]:
    """
    Get VAPID public key for push subscription.

    PUBLIC ENDPOINT - No authentication required.
    VAPID public key is meant to be publicly accessible (like SSL certificates).
    Only the subscription endpoint requires authentication to associate the
    push endpoint with a specific user.

    Returns:
        Dict containing the VAPID public key

    Example response:
        {
            "public_key": "BCMbJwHd...",
            "configured": true
        }
    """
    logger.info("[Push] VAPID key requested (public endpoint)")

    if not is_vapid_configured():
        logger.warning("[Push] VAPID keys not configured - push notifications disabled")
        return {
            "public_key": "",
            "configured": False
        }

    return {
        "public_key": settings.VAPID_PUBLIC_KEY,
        "configured": True
    }


@router.post("/subscribe", response_model=PushSubscriptionResponse)
async def subscribe_to_push(
    subscription_data: PushSubscriptionCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
) -> dict[str, str]:
    """
    Subscribe to push notifications.

    Stores the push subscription for the current user in the database.

    Args:
        subscription_data: Push subscription details from browser
        current_user: Authenticated user
        session: Database session

    Returns:
        Status message

    Example request:
        {
            "subscription": {
                "endpoint": "https://fcm.googleapis.com/fcm/send/...",
                "keys": {
                    "p256dh": "...",
                    "auth": "..."
                }
            },
            "user_agent": "Mozilla/5.0..."
        }
    """
    if not is_vapid_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Push notifications not configured on server"
        )

    try:
        endpoint = subscription_data.subscription.endpoint
        p256dh_key = subscription_data.subscription.keys.p256dh
        auth_key = subscription_data.subscription.keys.auth
        user_agent = subscription_data.user_agent

        # Check if subscription already exists (by endpoint)
        statement = select(PushSubscription).where(
            PushSubscription.endpoint == endpoint
        )
        result = await session.execute(statement)
        existing = result.scalar_one_or_none()

        if existing:
            # Update existing subscription (might be different user or updated keys)
            existing.user_id = current_user.id
            existing.p256dh_key = p256dh_key
            existing.auth_key = auth_key
            existing.user_agent = user_agent
            logger.info(
                "[Push] Updated existing subscription for user %s: %s...",
                current_user.id, endpoint[:50]
            )
        else:
            # Create new subscription
            new_subscription = PushSubscription(
                user_id=current_user.id,
                endpoint=endpoint,
                p256dh_key=p256dh_key,
                auth_key=auth_key,
                user_agent=user_agent,
                created_at=datetime.utcnow(),
            )
            session.add(new_subscription)
            logger.info(
                "[Push] User %s subscribed to push notifications: %s...",
                current_user.id, endpoint[:50]
            )

        await session.commit()

        return {"status": "subscribed"}

    except Exception as e:
        logger.error("[Push] Failed to subscribe user %s: %s", current_user.id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to subscribe to push notifications: {str(e)}"
        )


@router.post("/unsubscribe", response_model=PushSubscriptionResponse)
async def unsubscribe_from_push(
    subscription_data: PushSubscriptionCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
) -> dict[str, str]:
    """
    Unsubscribe from push notifications.

    Removes the push subscription for the current user from the database.

    Args:
        subscription_data: Push subscription to remove
        current_user: Authenticated user
        session: Database session

    Returns:
        Status message
    """
    try:
        endpoint = subscription_data.subscription.endpoint

        # Find and delete subscription by endpoint
        statement = select(PushSubscription).where(
            PushSubscription.endpoint == endpoint
        )
        result = await session.execute(statement)
        subscription = result.scalar_one_or_none()

        if subscription:
            await session.delete(subscription)
            await session.commit()
            logger.info(
                "[Push] User %s unsubscribed from push notifications: %s...",
                current_user.id, endpoint[:50]
            )
        else:
            logger.debug(
                "[Push] Subscription not found for unsubscribe: %s...",
                endpoint[:50]
            )

        return {"status": "unsubscribed"}

    except Exception as e:
        logger.error("[Push] Failed to unsubscribe user %s: %s", current_user.id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to unsubscribe from push notifications: {str(e)}"
        )


@router.post("/notify")
async def send_push_notification(
    notification: PushNotificationRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
) -> dict[str, Any]:
    """
    Send a push notification to a user.

    NOTE: This endpoint is for testing/admin use only.
    In production, push notifications should be triggered by backend events.

    Args:
        notification: Notification details
        current_user: Authenticated user (must be admin)
        session: Database session

    Returns:
        Status message with sent count

    Raises:
        HTTPException: If user is not admin or notification fails
    """
    from backend.app.services.push_service import PushService

    # Only admins can send push notifications
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can send push notifications"
        )

    if not is_vapid_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Push notifications not configured on server"
        )

    try:
        logger.info(
            "[Push] Admin %s sending notification to user %s: %s",
            current_user.id, notification.user_id, notification.title
        )

        sent_count = await PushService.send_to_user(
            session=session,
            user_id=notification.user_id,
            title=notification.title,
            body=notification.body,
            data=notification.data
        )

        if sent_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No push subscriptions found for user"
            )

        return {"status": "sent", "sent_count": sent_count}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "[Push] Failed to send notification to user %s: %s", notification.user_id, e
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Push notification failed: {str(e)}"
        )
