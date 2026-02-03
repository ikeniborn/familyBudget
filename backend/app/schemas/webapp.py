"""
Telegram Web Apps Pydantic schemas.

Schemas for Telegram Web Apps initData validation and responses.
Separate from auth.py because Web Apps use different validation algorithm.

References:
    - https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
"""


from pydantic import BaseModel, Field


class WebAppInitDataRequest(BaseModel):
    """
    Web App initData validation request.

    Contains raw initData string from Telegram.WebApp.initData.
    Format: "query_id=...&user={...}&auth_date=1234567890&hash=..."

    Attributes:
        initData: Raw initData string from Telegram Web App

    Example:
        >>> request = WebAppInitDataRequest(
        ...     initData="query_id=AAHdF6IQAAAAAN0XohDhrOrc&user=%7B%22id%22%3A123456789%..."
        ... )
    """

    initData: str = Field(
        description="Raw initData string from Telegram.WebApp.initData",
        examples=[
            "query_id=AAHdF6IQAAAAAN0XohDhrOrc&user=%7B%22id%22%3A123456789%2C%22first_name%22%3A%22John%22%7D&auth_date=1699999999&hash=abc123def456..."
        ],
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "initData": "query_id=AAHdF6IQAAAAAN0XohDhrOrc&user=%7B%22id%22%3A123456789%2C%22first_name%22%3A%22John%22%7D&auth_date=1699999999&hash=abc123def456789abcdef"
            }
        }
    }


class WebAppUser(BaseModel):
    """
    User data extracted from Web App initData.

    Subset of UserResponse optimized for Web Apps.

    Attributes:
        id: User's database ID
        telegram_id: User's Telegram ID
        username: Telegram username (optional)
        first_name: User's first name
        last_name: User's last name (optional)
        is_admin: Admin status flag
    """

    id: int = Field(description="User's database ID", examples=[1])
    telegram_id: int = Field(description="User's Telegram ID", examples=[123456789])
    username: str | None = Field(
        default=None, description="Telegram username", examples=["johndoe", None]
    )
    first_name: str | None = Field(
        default=None, description="User's first name", examples=["John"]
    )
    last_name: str | None = Field(
        default=None, description="User's last name", examples=["Doe", None]
    )
    is_admin: bool = Field(default=False, description="Admin status flag", examples=[False])

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "id": 1,
                "telegram_id": 123456789,
                "username": "johndoe",
                "first_name": "John",
                "last_name": "Doe",
                "is_admin": False,
            }
        },
    }


class WebAppValidateResponse(BaseModel):
    """
    Web App initData validation response.

    Returned after successful validation.

    Attributes:
        valid: Validation status (always true in response, 401 on invalid)
        user: User data
        access_token: JWT access token for API calls
    """

    valid: bool = Field(default=True, description="Validation status", examples=[True])
    user: WebAppUser = Field(description="Authenticated user data")
    access_token: str = Field(
        description="JWT access token (7-day expiry)",
        examples=["eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."],
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "valid": True,
                "user": {
                    "id": 1,
                    "telegram_id": 123456789,
                    "username": "johndoe",
                    "first_name": "John",
                    "last_name": "Doe",
                    "is_admin": False,
                },
                "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            }
        }
    }
