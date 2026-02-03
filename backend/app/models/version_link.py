"""
Version Link Models - Track SCD Type 2 version relationships

These models store the linkage between old and new versions when dimension records
are updated via SCD Type 2 versioning pattern.

Tables:
- t_d_article_version_link: Article version relationships
- t_d_financial_center_version_link: FinancialCenter version relationships
- t_d_cost_center_version_link: CostCenter version relationships

Each link records:
- old_id → new_id relationship
- When the new version was created
- Who made the change (audit trail)
- What fields changed (JSONB array)

Created: 2025-11-09
"""
from typing import Optional

from datetime import datetime

from sqlalchemy import TIMESTAMP
from sqlmodel import JSON, Column, Field, SQLModel


class ArticleVersionLink(SQLModel, table=True):
    """
    Tracks version links for Article dimension (SCD Type 2).

    When an Article is updated (name, type, or code changes), a new version is created.
    This table records the relationship: old_article_id → new_article_id.

    Example:
    --------
    Article "Продукты" (id=1) is renamed to "Еда и напитки" (new id=50).
    Link record: old_article_id=1, new_article_id=50, changed_fields=["name"]
    """

    __tablename__ = "t_d_article_version_link"

    id: Optional[int] = Field(default=None, primary_key=True)

    # Version relationship
    old_article_id: int = Field(
        foreign_key="t_d_article.id",
        description="Previous version ID (is_current=false)",
        index=True,
    )
    new_article_id: int = Field(
        foreign_key="t_d_article.id",
        description="New version ID (is_current=true)",
        index=True,
    )

    # Audit trail
    created_at: datetime = Field(
        sa_column=Column(TIMESTAMP, nullable=False),
        default_factory=datetime.utcnow,
        description="When the new version was created",
    )
    changed_by_user_id: Optional[int] = Field(
        default=None,
        foreign_key="t_d_user.id",
        description="User who triggered the change (NULL for system/trigger changes)",
    )

    # Change tracking
    changed_fields: Optional[list[str]] = Field(
        default=None,
        sa_column=Column(JSON),
        description="JSON array of field names that changed, e.g. ['name', 'type']",
    )


class FinancialCenterVersionLink(SQLModel, table=True):
    """
    Tracks version links for FinancialCenter dimension (SCD Type 2).

    Example:
    --------
    FinancialCenter "Наличные" (id=10) code changed CFO-1 → CFO-2 (new id=20).
    Link record: old_fc_id=10, new_fc_id=20, changed_fields=["code"]
    """

    __tablename__ = "t_d_financial_center_version_link"

    id: Optional[int] = Field(default=None, primary_key=True)

    # Version relationship
    old_fc_id: int = Field(
        foreign_key="t_d_financial_center.id",
        description="Previous version ID",
        index=True,
    )
    new_fc_id: int = Field(
        foreign_key="t_d_financial_center.id",
        description="New version ID",
        index=True,
    )

    # Audit trail
    created_at: datetime = Field(
        sa_column=Column(TIMESTAMP, nullable=False),
        default_factory=datetime.utcnow,
        description="When the new version was created",
    )
    changed_by_user_id: Optional[int] = Field(
        default=None,
        foreign_key="t_d_user.id",
        description="User who triggered the change",
    )

    # Change tracking
    changed_fields: Optional[list[str]] = Field(
        default=None,
        sa_column=Column(JSON),
        description="JSON array of field names that changed",
    )


class CostCenterVersionLink(SQLModel, table=True):
    """
    Tracks version links for CostCenter dimension (SCD Type 2).

    Example:
    --------
    CostCenter "Отпуск 2024" (id=5) renamed to "Отпуск Таиланд 2024" (new id=15).
    Link record: old_cc_id=5, new_cc_id=15, changed_fields=["name"]
    """

    __tablename__ = "t_d_cost_center_version_link"

    id: Optional[int] = Field(default=None, primary_key=True)

    # Version relationship
    old_cc_id: int = Field(
        foreign_key="t_d_cost_center.id",
        description="Previous version ID",
        index=True,
    )
    new_cc_id: int = Field(
        foreign_key="t_d_cost_center.id",
        description="New version ID",
        index=True,
    )

    # Audit trail
    created_at: datetime = Field(
        sa_column=Column(TIMESTAMP, nullable=False),
        default_factory=datetime.utcnow,
        description="When the new version was created",
    )
    changed_by_user_id: Optional[int] = Field(
        default=None,
        foreign_key="t_d_user.id",
        description="User who triggered the change",
    )

    # Change tracking
    changed_fields: Optional[list[str]] = Field(
        default=None,
        sa_column=Column(JSON),
        description="JSON array of field names that changed",
    )
