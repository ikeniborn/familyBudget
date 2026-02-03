"""
Article-to-FinancialCenter linking table.

Simple linking table (no SCD Type 2 needed - just current links).
Implements "whitelist" pattern:
- No entries = available for ALL financial centers
- Has entries = available ONLY for listed financial centers

This model enables filtering of leaf articles based on selected financial center
when creating new transactions.
"""

from datetime import datetime

from sqlmodel import Field, SQLModel


class ArticleFinancialCenter(SQLModel, table=True):
    """
    Linking table between Article and FinancialCenter.

    Table: t_article_financial_center
    Pattern: Simple linking (no SCD2)

    Business Rules:
    - Only LEAF articles can have links
    - No links = article available for ALL financial centers
    - Has links = article available ONLY for linked financial centers

    Usage:
    - When creating a transaction, filter articles by selected financial center
    - Articles without any links pass the filter (available for all)
    - Articles with links must match the selected financial center

    Attributes:
        id: Surrogate primary key
        article_id: FK to t_d_article (must be LEAF article)
        financial_center_id: FK to t_d_financial_center
        created_at: Timestamp when link was created
    """

    __tablename__ = "t_article_financial_center"

    id: int | None = Field(
        default=None,
        primary_key=True,
        description="Surrogate primary key"
    )

    article_id: int = Field(
        foreign_key="t_d_article.id",
        index=True,
        nullable=False,
        description="FK to article (must be LEAF article)"
    )

    financial_center_id: int = Field(
        foreign_key="t_d_financial_center.id",
        index=True,
        nullable=False,
        description="FK to financial center"
    )

    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        description="Link creation timestamp"
    )
