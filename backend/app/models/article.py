"""
Article dimension table model with SCD Type 2 and hierarchical structure.

This module defines the Article model for budget categories with support for:
- Slowly Changing Dimension Type 2 pattern for historical tracking
- Hierarchical organization using adjacency list (parent_id)
- Global articles shared across users and user-specific articles
"""

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class Article(SQLModel, table=True):
    """
    Article (category) dimension table with SCD Type 2 and hierarchy support.

    Articles represent budget categories (e.g., "Food", "Transport", "Salary").
    Supports hierarchical organization via parent_id (adjacency list pattern).
    Can be user-specific or global (shared across all users).

    Table: t_d_article
    Pattern: SCD Type 2 + Adjacency List (parent_id for hierarchy)

    Business Key: user_id + name + type (for uniqueness)

    Hierarchical Structure:
        The parent_id creates a tree structure:
        - Root articles: parent_id = NULL
        - Child articles: parent_id references parent article's id
        - Example hierarchy:
            Food (id=1, parent_id=NULL)
            ├── Groceries (id=2, parent_id=1)
            └── Restaurants (id=3, parent_id=1)

    User-specific Articles:
        - All articles are user-specific with required user_id
        - Each user maintains their own set of categories

    SCD Type 2 Pattern:
        Each article can have multiple versions over time:
        - Only one version has is_current=True
        - valid_from/valid_to define the validity period
        - Historical versions preserved for audit

    Attributes:
        id: Surrogate primary key (auto-generated)
        user_id: Owner user ID (required)
        parent_id: Parent article ID for hierarchy (NULL for root articles)
        name: Article display name (required, max 255 chars)
        type: Article type - 'income' or 'expense' (required, max 20 chars)
        valid_from: Start of validity period for this record
        valid_to: End of validity period (9999-12-31 for current records)
        is_current: Flag indicating if this is the current version
        created_at: Timestamp when record was created
        updated_at: Timestamp when record was last updated

    Examples:
        # Root article (top-level category)
        >>> article = Article(
        ...     user_id=123,
        ...     name="Food",
        ...     type="expense"
        ... )

        # Child article (subcategory)
        >>> groceries = Article(
        ...     user_id=123,
        ...     parent_id=1,
        ...     name="Groceries",
        ...     type="expense"
        ... )

        # Income article
        >>> salary = Article(
        ...     user_id=123,
        ...     name="Salary",
        ...     type="income"
        ... )

    Notes:
        - The type field must be validated at application level to be 'income' or 'expense'
        - Use CHECK constraint in database: CHECK (type IN ('income', 'expense'))
        - When updating an article, create new version and set old version's is_current=False
        - All articles must have user_id (required field)
        - Parent article must exist before creating child article
        - Unique constraint: (user_id, name, type, is_current) for current records
    """

    __tablename__ = "t_d_article"

    # Primary key
    id: Optional[int] = Field(
        default=None,
        primary_key=True,
        description="Surrogate primary key"
    )

    # Foreign keys
    user_id: int = Field(
        foreign_key="t_d_user.id",
        index=True,
        nullable=False,
        description="Owner user ID (required - all articles are user-specific)"
    )
    parent_id: Optional[int] = Field(
        default=None,
        foreign_key="t_d_article.id",
        index=True,
        description="Parent article ID for hierarchy (adjacency list pattern)"
    )

    # Business keys and attributes
    name: str = Field(
        nullable=False,
        max_length=255,
        description="Article display name"
    )
    type: str = Field(
        nullable=False,
        max_length=20,
        index=True,
        description="Article type: 'income' or 'expense' (enforced by CHECK constraint)"
    )

    # SCD Type 2 fields
    valid_from: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        description="Start of validity period"
    )
    valid_to: Optional[datetime] = Field(
        default=datetime(9999, 12, 31, 23, 59, 59),
        nullable=True,
        description="End of validity period (9999-12-31 for current)"
    )
    is_current: bool = Field(
        default=True,
        nullable=False,
        index=True,
        description="Current version flag"
    )

    # Audit fields
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        description="Record creation timestamp"
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        description="Record last update timestamp"
    )

    def __repr__(self) -> str:
        """String representation of Article model."""
        return (
            f"Article(id={self.id}, name='{self.name}', type='{self.type}', "
            f"user_id={self.user_id}, parent_id={self.parent_id}, "
            f"is_current={self.is_current})"
        )
