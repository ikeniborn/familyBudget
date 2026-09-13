"""
Pydantic schemas for the AI module (settings, models discovery, health check).

The provider token is write-only: requests may carry it in full, responses
expose only a masked tail (`***…last4`).
"""
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AISettingsResponse(BaseModel):
    """AI settings as exposed to the admin UI (token masked)."""

    model_config = ConfigDict(from_attributes=True)

    enabled: bool
    endpoint_url: str
    token_masked: str | None = None
    model_text: str | None = None
    model_image: str | None = None
    model_voice: str | None = None
    confidence_threshold: float
    updated_at: datetime


class AISettingsUpdate(BaseModel):
    """Partial update; omitted fields keep their current values.

    `api_token` semantics: omitted -> keep current token; empty string -> clear.
    """

    enabled: bool | None = None
    endpoint_url: str | None = Field(default=None, min_length=1, max_length=500)
    api_token: str | None = Field(default=None, max_length=1000)
    model_text: str | None = Field(default=None, max_length=255)
    model_image: str | None = Field(default=None, max_length=255)
    model_voice: str | None = Field(default=None, max_length=255)
    confidence_threshold: float | None = Field(default=None, ge=0.0, le=1.0)

    @field_validator("endpoint_url")
    @classmethod
    def endpoint_strip(cls, v: str | None) -> str | None:
        return v.rstrip("/") if v else v


class AIStatusResponse(BaseModel):
    """Per-slot availability for regular users (drives UI button visibility)."""

    enabled: bool
    text: bool
    image: bool
    voice: bool


class ParseTransactionRequest(BaseModel):
    """Free-text phrase to parse into a transaction draft."""

    text: str = Field(..., min_length=1, max_length=500)

    @field_validator("text")
    @classmethod
    def text_strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("text must not be blank")
        return v


class TransactionDraft(BaseModel):
    """FactCreate-shaped draft produced by the LLM; user must confirm it.

    `confidence` is 'low' below the configured threshold — the UI shows a
    "проверь категорию" flag. `financial_center_id` may be null when the
    model could not pick an account; the user selects it manually.
    """

    article_id: int
    article_path: str
    article_type: str
    amount: int
    fact_date: date
    description: str | None = None
    financial_center_id: int | None = None
    financial_center_name: str | None = None
    record_type: Literal["fact", "plan"] = "fact"
    confidence: Literal["high", "low"]
    warnings: list[str] = []


class AIModelInfo(BaseModel):
    """One model alias reported by the provider's GET /v1/models."""

    id: str
    capabilities: list[str] = []


class AIModelsResponse(BaseModel):
    models: list[AIModelInfo]


class SlotHealth(BaseModel):
    """Health-check result for one model slot."""

    status: Literal["ok", "error", "not_configured"]
    latency_ms: int | None = None
    detail: str | None = None


class AIHealthCheckResponse(BaseModel):
    """Per-slot provider availability, probed with built-in canned examples."""

    text: SlotHealth
    image: SlotHealth
    voice: SlotHealth
