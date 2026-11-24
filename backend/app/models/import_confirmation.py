"""Receipts for committed bank import confirmations and statement rows."""

from sqlalchemy import JSON, BigInteger
from sqlmodel import Field, SQLModel


class ImportConfirmation(SQLModel, table=True):
    """Replay a committed response for the same uploader and request."""

    __tablename__ = "t_import_confirmation"

    user_id: int = Field(primary_key=True, foreign_key="t_d_user.id", ondelete="CASCADE")
    confirmation_id: str = Field(primary_key=True, max_length=64)
    request_hash: str = Field(max_length=64)
    response: dict = Field(sa_type=JSON)


class ImportSourceReceipt(SQLModel, table=True):
    """Identify a committed statement row even after its staging row is removed."""

    __tablename__ = "t_import_source_receipt"

    user_id: int = Field(primary_key=True, foreign_key="t_d_user.id", ondelete="CASCADE")
    fingerprint: str = Field(primary_key=True, max_length=64)
    source_row: int = Field(primary_key=True)
    fact_id: int = Field(sa_type=BigInteger)
