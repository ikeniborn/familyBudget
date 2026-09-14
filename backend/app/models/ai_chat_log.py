"""
AI analytics chat log (server-side query history, ai-analytics-chat-history).

One row per analytics-chat exchange: the user's question, the scope the
model resolved (with the aggregates the answer was grounded in), the
grounded answer, the outcome status, and latency. Read back by
GET /api/v1/ai/analytics-chat/history for the analytics-page history UI.

Table: t_f_ai_chat_log
"""
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Column, Text
from sqlmodel import Field, SQLModel


class AIChatLog(SQLModel, table=True):
    """One analytics-chat exchange (see module docstring)."""

    __tablename__ = "t_f_ai_chat_log"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="t_d_user.id", index=True)
    question: str = Field(max_length=500)
    # Resolved scope + aggregates the answer was grounded in; null when
    # scope extraction failed.
    scope: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON))
    answer: str | None = Field(default=None, sa_column=Column(Text))
    status: str = Field(max_length=20)  # 'ok' | 'parse_error' | 'provider_error'
    latency_ms: int | None = Field(default=None)
    created_at: datetime = Field(
        default_factory=datetime.utcnow, nullable=False, index=True
    )
