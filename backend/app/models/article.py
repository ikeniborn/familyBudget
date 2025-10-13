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

    Business Key: user_id + code (for user articles) or code (for global articles)

    Hierarchical Structure:
        The parent_id creates a tree structure:
        - Root articles: parent_id = NULL
        - Child articles: parent_id references parent article's id
        - Example hierarchy:
            Food (id=1, parent_id=NULL)
            ├── Groceries (id=2, parent_id=1)
            └── Restaurants (id=3, parent_id=1)

    Global vs User Articles:
        - Global articles (is_global=True): Shared across all users, user_id=NULL
        - User articles (is_global=False): Specific to a user, user_id=<user_id>

    SCD Type 2 Pattern:
        Each article can have multiple versions over time:
        - Only one version has is_current=True
        - valid_from/valid_to define the validity period
        - Historical versions preserved for audit

    Attributes:
        id: Surrogate primary key (auto-generated)
        user_id: Owner user ID (NULL for global articles)
        parent_id: Parent article ID for hierarchy (NULL for root articles)
        code: Business key for the article (optional, max 50 chars)
        name: Article display name (required, max 255 chars)
        type: Article type - 'income' or 'expense' (required, max 20 chars)
        is_global: Flag indicating if article is shared across all users
        valid_from: Start of validity period for this record
        valid_to: End of validity period (9999-12-31 for current records)
        is_current: Flag indicating if this is the current version
        created_at: Timestamp when record was created
        updated_at: Timestamp when record was last updated

    Examples:
        # Global root article (shared across users)
        >>> article = Article(
        ...     code="FOOD",
        ...     name="Food",
        ...     type="expense",
        ...     is_global=True
        ... )

        # User-specific child article
        >>> groceries = Article(
        ...     user_id=123,
        ...     parent_id=1,
        ...     name="Groceries",
        ...     type="expense",
        ...     is_global=False
        ... )

        # Income article
        >>> salary = Article(
        ...     user_id=123,
        ...     code="SALARY",
        ...     name="Salary",
        ...     type="income",
        ...     is_global=False
        ... )

    Notes:
        - The type field must be validated at application level to be 'income' or 'expense'
        - Use CHECK constraint in database: CHECK (type IN ('income', 'expense'))
        - When updating an article, create new version and set old version's is_current=False
        - Global articles (is_global=True) should have user_id=NULL
        - Parent article must exist before creating child article
    """

    __tablename__ = "t_d_article"

    # Primary key
    id: Optional[int] = Field(
        default=None,
        primary_key=True,
        description="Surrogate primary key"
    )

    # Foreign keys
    user_id: Optional[int] = Field(
        default=None,
        foreign_key="t_d_user.id",
        index=True,
        description="Owner user ID (NULL for global articles)"
    )
    parent_id: Optional[int] = Field(
        default=None,
        foreign_key="t_d_article.id",
        index=True,
        description="Parent article ID for hierarchy (adjacency list pattern)"
    )

    # Business keys and attributes
    code: Optional[str] = Field(
        default=None,
        max_length=50,
        description="Business key for article identification"
    )
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
    is_global: bool = Field(
        default=False,
        nullable=False,
        description="Global articles are shared across all users (user_id must be NULL)"
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
            f"is_global={self.is_global}, is_current={self.is_current})"
        )
