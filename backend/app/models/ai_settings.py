"""
AI settings model (single-row configuration).

Stores runtime configuration for the AI module (OpenAI-compatible provider):
endpoint URL, bearer token, and the model alias per slot (text / image / voice).
Managed from the admin web UI, not from environment variables.

Single-row pattern: the service layer always reads/creates the row with id=1.

Table: t_d_ai_settings
"""
from datetime import datetime

from sqlalchemy import func
from sqlmodel import Field, SQLModel

AI_SETTINGS_ROW_ID = 1


class AISettings(SQLModel, table=True):
    """Single-row AI module configuration (see module docstring)."""

    __tablename__ = "t_d_ai_settings"

    id: int | None = Field(default=None, primary_key=True)
    enabled: bool = Field(default=False)
    endpoint_url: str = Field(
        default="https://homelab.ikeniborn.ru/v1", max_length=500
    )
    # Full-rights provider token; never returned to clients in full (masked).
    api_token: str | None = Field(default=None, max_length=1000)
    model_text: str | None = Field(default=None, max_length=255)
    model_image: str | None = Field(default=None, max_length=255)
    model_voice: str | None = Field(default=None, max_length=255)
    # Below this threshold a category suggestion is flagged "verify category".
    confidence_threshold: float = Field(default=0.7, ge=0.0, le=1.0)
    updated_by: int | None = Field(default=None, foreign_key="t_d_user.id")
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column_kwargs={"onupdate": func.now()},
    )
