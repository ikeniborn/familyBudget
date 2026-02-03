"""
Pydantic schemas for Push Notification API.

Defines request/response models for web push notification management.
"""

from typing import Any, Optional

from pydantic import BaseModel, Field


class PushSubscriptionKeys(BaseModel):
    """
    Push subscription encryption keys.

    Attributes:
        p256dh: Public key for message encryption (P-256 ECDH)
        auth: Authentication secret for message authentication
    """
    p256dh: str = Field(..., description="Public key for P-256 ECDH encryption")
    auth: str = Field(..., description="Authentication secret")


class PushSubscription(BaseModel):
    """
    Push subscription details from browser.

    Attributes:
        endpoint: Push service endpoint URL (FCM, APNS, etc.)
        keys: Encryption keys for push messages
    """
    endpoint: str = Field(..., description="Push service endpoint URL")
    keys: PushSubscriptionKeys = Field(..., description="Encryption keys")
    expirationTime: Optional[int] = Field(None, description="Subscription expiration timestamp")


class PushSubscriptionCreate(BaseModel):
    """
    Request to create/store a push subscription.

    Attributes:
        subscription: Push subscription object from browser
        user_agent: User's browser user agent string
    """
    subscription: PushSubscription = Field(..., description="Push subscription object")
    user_agent: str = Field(..., description="Browser user agent")

    class Config:
        json_schema_extra = {
            "example": {
                "subscription": {
                    "endpoint": "https://fcm.googleapis.com/fcm/send/abc123...",
                    "keys": {
                        "p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM=",
                        "auth": "tBHItJI5svbpez7KI4CCXg=="
                    },
                    "expirationTime": None
                },
                "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
        }


class PushSubscriptionResponse(BaseModel):
    """
    Response for push subscription operations.

    Attributes:
        status: Operation status (subscribed, unsubscribed, sent, etc.)
    """
    status: str = Field(..., description="Operation status")

    class Config:
        json_schema_extra = {
            "example": {
                "status": "subscribed"
            }
        }


class VAPIDKeyResponse(BaseModel):
    """
    Response containing VAPID public key.

    Attributes:
        public_key: VAPID public key for browser push subscriptions
        configured: Whether VAPID keys are properly configured on server
    """
    public_key: str = Field(..., description="VAPID public key (base64url encoded)")
    configured: bool = Field(default=True, description="Whether push notifications are configured")

    class Config:
        json_schema_extra = {
            "example": {
                "public_key": "BCMbJwHdGPAp3Rk5X8YN...",
                "configured": True
            }
        }


class PushNotificationRequest(BaseModel):
    """
    Request to send a push notification.

    Attributes:
        user_id: Target user ID
        title: Notification title
        body: Notification body text
        data: Additional notification data (optional)
    """
    user_id: int = Field(..., description="Target user ID", gt=0)
    title: str = Field(..., description="Notification title", min_length=1, max_length=100)
    body: str = Field(..., description="Notification body", min_length=1, max_length=200)
    data: Optional[dict[str, Any]] = Field(None, description="Additional notification data")

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": 1,
                "title": "Синхронизация завершена",
                "body": "Синхронизировано записей: 5",
                "data": {
                    "type": "sync_completed",
                    "count": 5
                }
            }
        }
