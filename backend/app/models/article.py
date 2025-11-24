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

    Shared References Architecture:
        - All articles are shared across all users (accessible by everyone)
        - Only administrators can CREATE/UPDATE/DELETE articles
        - All users can READ all articles
        - user_id tracks the creator for audit trail purposes

    SCD Type 2 Pattern:
        Each article can have multiple versions over time:
        - Only one version has is_current=True
        - valid_from/valid_to define the validity period
        - Historical versions preserved for audit

    Attributes:
        id: Surrogate primary key (auto-generated)
        user_id: Owner user ID (required - tracks creator for audit)
        parent_id: Parent article ID for hierarchy (NULL for root articles)
        name: Article display name (required, max 255 chars)
        description: Optional description or notes about the article/category (text field)
        type: Article type - 'income' or 'expense' (required, max 20 chars)
        code: Business code for external integrations (optional, auto-generated as ART-1, ART-2, ...)
        is_active: Active flag (True = visible in UI, False = archived)
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
        - Unique constraint: (name, type, is_current) for current records
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
    description: Optional[str] = Field(
        default=None,
        description="Optional description or notes about the article/category"
    )
    type: str = Field(
        nullable=False,
        max_length=20,
        index=True,
        description="Article type: 'income' or 'expense' (enforced by CHECK constraint)"
    )
    code: Optional[str] = Field(
        default=None,
        max_length=50,
        nullable=True,
        index=True,
        description="Business code for external integrations (e.g., ART-1, ART-2). Auto-generated if not provided."
    )

    # Active status flag (archived categories functionality)
    is_active: bool = Field(
        default=True,
        nullable=False,
        index=True,
        description="Active status flag (True = visible in UI dropdowns, False = archived)"
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


class ArticleUsageStats(SQLModel, table=True):
    """
    Article usage statistics table - pre-calculated category popularity metrics.

    Stores aggregated statistics about how often each category is used in transactions.
    Updated daily at 00:00 via cron job (APScheduler).
    Used for sorting categories by popularity in frontend dropdowns.

    Table: t_article_usage_stats
    Pattern: Aggregated statistics table (updated daily)

    Update Mechanism:
        - APScheduler cron job runs daily at 00:00
        - Calls recalculate_article_usage_stats() PostgreSQL function
        - Truncates table and recalculates from t_f_budget_fact
        - No historical data - only current statistics

    Performance:
        - Indexed by usage_count DESC for fast sorting
        - Small table (only used categories, typically <100 rows)
        - JOIN with t_d_article in API for sorted category lists

    Attributes:
        article_id: Foreign key to t_d_article.id (primary key)
        usage_count: Number of times category used in transactions (all time)
        last_updated: Timestamp when statistics were last recalculated

    Examples:
        # Query top 10 most used categories
        >>> stmt = (
        ...     select(Article, ArticleUsageStats.usage_count)
        ...     .outerjoin(ArticleUsageStats, Article.id == ArticleUsageStats.article_id)
        ...     .where(Article.is_current == True)
        ...     .order_by(desc(func.coalesce(ArticleUsageStats.usage_count, 0)))
        ...     .limit(10)
        ... )

        # Manually recalculate statistics (for testing)
        >>> await session.execute(text("SELECT recalculate_article_usage_stats()"))

    Notes:
        - Statistics are updated daily, not in real-time
        - Only articles that are actually used appear in this table
        - Frontend JOINs with Article for sorted category lists
        - COALESCE(usage_count, 0) handles articles with no usage
        - Separate table keeps t_d_article clean (no changes to dimension table)
    """

    __tablename__ = "t_article_usage_stats"

    # Primary key (same as article_id)
    article_id: int = Field(
        primary_key=True,
        foreign_key="t_d_article.id",
        description="Foreign key to t_d_article.id"
    )

    # Statistics
    usage_count: int = Field(
        default=0,
        nullable=False,
        description="Number of times this category is used in t_f_budget_fact (all time count)"
    )
    last_updated: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        description="Timestamp when statistics were last recalculated (typically 00:00 daily)"
    )

    def __repr__(self) -> str:
        """String representation of ArticleUsageStats model."""
        return (
            f"ArticleUsageStats(article_id={self.article_id}, "
            f"usage_count={self.usage_count}, "
            f"last_updated={self.last_updated})"
        )
