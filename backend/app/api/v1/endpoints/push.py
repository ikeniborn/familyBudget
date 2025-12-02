"""
Push Notification API endpoints for Family Budget PWA.

Provides VAPID key management and push subscription handling for web push notifications.

Browser Support:
- Chrome/Edge: ✅ Full support
- Safari 16.4+: ✅ Full support
- Яндекс.Браузер: ✅ Full support
"""

import json
import logging
from typing import Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.auth import get_current_user
from backend.app.db.session import get_session
from backend.app.models.user import User
from backend.app.schemas.push import (
    PushSubscriptionCreate,
    PushSubscriptionResponse,
    VAPIDKeyResponse,
    PushNotificationRequest
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/push", tags=["push"])

# VAPID Configuration
# TODO: Generate proper VAPID keys using py_vapid library
# For now, using placeholder - should be generated once and stored securely
VAPID_PUBLIC_KEY = "BCMbJwHdGPAp3Rk5X8YN0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
VAPID_PRIVATE_KEY = "PRIVATE_KEY_PLACEHOLDER"  # Should be stored in environment variables
VAPID_CLAIMS = {"sub": "mailto:admin@familybudget.example.com"}


@router.get("/vapid-key", response_model=VAPIDKeyResponse)
async def get_vapid_key(
    current_user: User = Depends(get_current_user)
) -> Dict[str, str]:
    """
    Get VAPID public key for push subscription.

    Returns:
        Dict containing the VAPID public key

    Example response:
        {
            "public_key": "BCMbJwHd..."
        }
    """
    logger.info(f"[Push] User {current_user.id} requested VAPID key")

    return {"public_key": VAPID_PUBLIC_KEY}


@router.post("/subscribe", response_model=PushSubscriptionResponse)
async def subscribe_to_push(
    subscription_data: PushSubscriptionCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
) -> Dict[str, str]:
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
    try:
        # TODO: Store subscription in database
        # For now, just log it
        logger.info(
            f"[Push] User {current_user.id} subscribed to push notifications: "
            f"{subscription_data.subscription.endpoint[:50]}..."
        )

        # In production, store subscription in database:
        # - user_id
        # - endpoint
        # - p256dh key
        # - auth key
        # - user_agent
        # - created_at

        return {"status": "subscribed"}

    except Exception as e:
        logger.error(f"[Push] Failed to subscribe user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to subscribe to push notifications: {str(e)}"
        )


@router.post("/unsubscribe", response_model=PushSubscriptionResponse)
async def unsubscribe_from_push(
    subscription_data: PushSubscriptionCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
) -> Dict[str, str]:
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
        # TODO: Remove subscription from database
        logger.info(
            f"[Push] User {current_user.id} unsubscribed from push notifications"
        )

        return {"status": "unsubscribed"}

    except Exception as e:
        logger.error(f"[Push] Failed to unsubscribe user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to unsubscribe from push notifications: {str(e)}"
        )


@router.post("/notify")
async def send_push_notification(
    notification: PushNotificationRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
) -> Dict[str, str]:
    """
    Send a push notification to a user.

    NOTE: This endpoint is for testing/admin use only.
    In production, push notifications should be triggered by backend events.

    Args:
        notification: Notification details
        current_user: Authenticated user (must be admin)
        session: Database session

    Returns:
        Status message

    Raises:
        HTTPException: If user is not admin or notification fails
    """
    # Only admins can send push notifications
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can send push notifications"
        )

    try:
        # TODO: Implement actual push notification sending using pywebpush
        # 1. Get user subscription from database
        # 2. Send push notification using webpush library
        # 3. Handle errors (expired subscription, etc.)

        logger.info(
            f"[Push] Admin {current_user.id} sending notification to user {notification.user_id}: "
            f"{notification.title}"
        )

        # Example implementation (commented out until dependencies are installed):
        # from pywebpush import webpush, WebPushException
        #
        # subscription_info = await get_user_subscription(notification.user_id, session)
        # if not subscription_info:
        #     raise HTTPException(404, "No subscription found for user")
        #
        # webpush(
        #     subscription_info=subscription_info,
        #     data=json.dumps({
        #         "title": notification.title,
        #         "body": notification.body,
        #         "icon": "/static/icons/icon-192.png",
        #         "badge": "/static/icons/icon-192.png",
        #         "tag": "budget-notification",
        #         "data": notification.data
        #     }),
        #     vapid_private_key=VAPID_PRIVATE_KEY,
        #     vapid_claims=VAPID_CLAIMS
        # )

        return {"status": "sent"}

    except Exception as e:
        logger.error(
            f"[Push] Failed to send notification to user {notification.user_id}: {e}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Push notification failed: {str(e)}"
        )
