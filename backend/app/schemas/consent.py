"""
Pydantic schemas for User Consent API (GDPR compliance).

Defines request/response models for cookie consent management.
"""
from typing import Optional

from datetime import datetime

from pydantic import BaseModel, Field


class ConsentItem(BaseModel):
    """
    Single consent item for a specific type.

    Attributes:
        consent_type: Type of consent (essential, analytics, push_notifications, personalization)
        consent_given: Whether consent is granted (True) or denied/withdrawn (False)
    """
    consent_type: str = Field(
        ...,
        description="Consent type: essential, analytics, push_notifications, personalization",
        pattern="^(essential|analytics|push_notifications|personalization)$"
    )
    consent_given: bool = Field(..., description="True=consent granted, False=consent denied")


class ConsentCreate(BaseModel):
    """
    Request to record user consent choices.

    Attributes:
        consents: List of consent items
        privacy_policy_version: Version of privacy policy user agreed to

    Example:
        {
            "consents": [
                {"consent_type": "essential", "consent_given": true},
                {"consent_type": "analytics", "consent_given": true},
                {"consent_type": "push_notifications", "consent_given": false}
            ],
            "privacy_policy_version": "1.0"
        }
    """
    consents: list[ConsentItem] = Field(
        ...,
        min_length=1,
        description="List of consent choices"
    )
    privacy_policy_version: str = Field(
        default="1.0",
        max_length=20,
        description="Privacy policy version"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "consents": [
                    {"consent_type": "essential", "consent_given": True},
                    {"consent_type": "analytics", "consent_given": True},
                    {"consent_type": "push_notifications", "consent_given": False},
                    {"consent_type": "personalization", "consent_given": True}
                ],
                "privacy_policy_version": "1.0"
            }
        }


class ConsentStatus(BaseModel):
    """
    Current consent status for a user.

    Attributes:
        consent_type: Type of consent
        consent_given: Current consent state
        recorded_at: When consent was last recorded
    """
    consent_type: str = Field(..., description="Consent type")
    consent_given: bool = Field(..., description="Current consent state")
    recorded_at: datetime = Field(..., description="When consent was last recorded")


class ConsentStatusResponse(BaseModel):
    """
    Response containing current consent status for all types.

    Attributes:
        has_consented: Whether user has any consent recorded
        consents: Dictionary of consent type -> status
        privacy_policy_version: Latest privacy policy version user agreed to
    """
    has_consented: bool = Field(
        ...,
        description="True if user has any consent recorded"
    )
    consents: dict[str, ConsentStatus] = Field(
        default_factory=dict,
        description="Consent status by type"
    )
    privacy_policy_version: Optional[str] = Field(
        None,
        description="Latest privacy policy version agreed to"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "has_consented": True,
                "consents": {
                    "essential": {
                        "consent_type": "essential",
                        "consent_given": True,
                        "recorded_at": "2025-12-03T14:00:00Z"
                    },
                    "analytics": {
                        "consent_type": "analytics",
                        "consent_given": True,
                        "recorded_at": "2025-12-03T14:00:00Z"
                    }
                },
                "privacy_policy_version": "1.0"
            }
        }


class ConsentRecordResponse(BaseModel):
    """
    Response after recording consent.

    Attributes:
        status: Operation status
        recorded_count: Number of consent records created
    """
    status: str = Field(..., description="Operation status")
    recorded_count: int = Field(..., description="Number of records created")

    class Config:
        json_schema_extra = {
            "example": {
                "status": "recorded",
                "recorded_count": 4
            }
        }
