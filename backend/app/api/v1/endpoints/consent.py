"""
User Consent API endpoints for GDPR compliance.

Provides endpoints for:
- Recording user consent for cookies/analytics/push
- Getting current consent status
- Withdrawing consent

GDPR Requirements:
- Consent must be freely given, specific, informed, and unambiguous
- Must keep proof of consent (IP, timestamp, user agent)
- Allow withdrawal at any time
- Append-only records (never delete)
"""
from typing import Optional

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import desc, select

from backend.app.core.auth import get_current_user, get_current_user_optional
from backend.app.db.session import get_session
from backend.app.models.user import User
from backend.app.models.user_consent import UserConsent
from backend.app.schemas.consent import (
    ConsentCreate,
    ConsentRecordResponse,
    ConsentStatus,
    ConsentStatusResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/consent", tags=["consent"])


def get_client_ip(request: Request) -> str:
    """Extract client IP from request headers."""
    # Check for proxy headers first
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()

    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip

    # Fall back to direct connection
    if request.client:
        return request.client.host

    return "unknown"


def get_user_agent(request: Request) -> str:
    """Extract user agent from request headers."""
    return request.headers.get("user-agent", "unknown")[:500]


@router.get("/status", response_model=ConsentStatusResponse)
async def get_consent_status(
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: Optional[User] = Depends(get_current_user_optional)
) -> ConsentStatusResponse:
    """
    Get current consent status for the user.

    Returns the latest consent state for each consent type.
    For authenticated users, uses user_id.
    For anonymous users, returns empty status (consent required).

    Returns:
        ConsentStatusResponse with current consent states
    """
    if not current_user:
        # Anonymous user - no consent recorded yet
        return ConsentStatusResponse(
            has_consented=False,
            consents={},
            privacy_policy_version=None
        )

    # Get latest consent for each type
    consents: dict[str, ConsentStatus] = {}
    latest_policy_version = None

    for consent_type in UserConsent.consent_types():
        result = await session.exec(
            select(UserConsent)
            .where(UserConsent.user_id == current_user.id)
            .where(UserConsent.consent_type == consent_type)
            .order_by(desc(UserConsent.created_at))
            .limit(1)
        )
        consent = result.first()

        if consent:
            consents[consent_type] = ConsentStatus(
                consent_type=consent_type,
                consent_given=consent.consent_given,
                recorded_at=consent.created_at
            )
            # Track latest policy version
            if latest_policy_version is None or consent.created_at > datetime.min:
                latest_policy_version = consent.privacy_policy_version

    return ConsentStatusResponse(
        has_consented=len(consents) > 0,
        consents=consents,
        privacy_policy_version=latest_policy_version
    )


@router.post("", response_model=ConsentRecordResponse)
async def record_consent(
    consent_data: ConsentCreate,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> ConsentRecordResponse:
    """
    Record user consent choices.

    Creates append-only records for each consent type.
    GDPR requires keeping proof of consent.

    Args:
        consent_data: Consent choices to record
        request: HTTP request for extracting IP/user agent
        session: Database session
        current_user: Authenticated user

    Returns:
        ConsentRecordResponse with operation status

    Note:
        - Essential cookies consent cannot be denied (required for app to function)
        - All consent records are append-only (never deleted or updated)
    """
    ip_address = get_client_ip(request)
    user_agent = get_user_agent(request)

    recorded_count = 0

    for consent_item in consent_data.consents:
        # Essential cookies are always required - force to True
        consent_given = consent_item.consent_given
        if consent_item.consent_type == "essential":
            consent_given = True

        # Create new consent record (append-only)
        consent_record = UserConsent(
            user_id=current_user.id,
            consent_type=consent_item.consent_type,
            consent_given=consent_given,
            privacy_policy_version=consent_data.privacy_policy_version,
            ip_address=ip_address,
            user_agent=user_agent,
            created_at=datetime.utcnow()
        )

        session.add(consent_record)
        recorded_count += 1

        logger.info(
            f"[Consent] User {current_user.id} {('granted' if consent_given else 'denied')} "
            f"{consent_item.consent_type} consent (policy v{consent_data.privacy_policy_version})"
        )

    await session.commit()

    return ConsentRecordResponse(
        status="recorded",
        recorded_count=recorded_count
    )


@router.post("/withdraw/{consent_type}", response_model=ConsentRecordResponse)
async def withdraw_consent(
    consent_type: str,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> ConsentRecordResponse:
    """
    Withdraw specific consent.

    Creates a new record with consent_given=False.
    GDPR requires allowing consent withdrawal at any time.

    Args:
        consent_type: Type of consent to withdraw
        request: HTTP request for extracting IP/user agent
        session: Database session
        current_user: Authenticated user

    Returns:
        ConsentRecordResponse with operation status

    Raises:
        HTTPException: If consent_type is invalid or essential
    """
    # Validate consent type
    valid_types = UserConsent.consent_types()
    if consent_type not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid consent type. Valid types: {', '.join(valid_types)}"
        )

    # Essential cookies cannot be withdrawn
    if consent_type == "essential":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Essential cookies consent cannot be withdrawn (required for app to function)"
        )

    ip_address = get_client_ip(request)
    user_agent = get_user_agent(request)

    # Get latest consent to find policy version
    result = await session.exec(
        select(UserConsent)
        .where(UserConsent.user_id == current_user.id)
        .where(UserConsent.consent_type == consent_type)
        .order_by(desc(UserConsent.created_at))
        .limit(1)
    )
    latest = result.first()
    policy_version = latest.privacy_policy_version if latest else "1.0"

    # Create withdrawal record (append-only)
    withdrawal_record = UserConsent(
        user_id=current_user.id,
        consent_type=consent_type,
        consent_given=False,  # Withdrawal
        privacy_policy_version=policy_version,
        ip_address=ip_address,
        user_agent=user_agent,
        created_at=datetime.utcnow()
    )

    session.add(withdrawal_record)
    await session.commit()

    logger.info(
        f"[Consent] User {current_user.id} withdrew {consent_type} consent"
    )

    return ConsentRecordResponse(
        status="withdrawn",
        recorded_count=1
    )
