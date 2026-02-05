"""
Article dimension table model with SCD Type 1 and hierarchical structure.

This module defines the Article model for budget categories with in-place updates
(NO versioning). Full change history is stored in separate ArticleHistory table (SCD Type 2).

IMPORTANT: This is a breaking change from previous SCD Type 2 implementation.
Migration required to convert existing data.

Key features:
- SCD Type 1 (current data only, in-place updates)
- Hierarchical organization using adjacency list (parent_id)
- Global articles shared across users and user-specific articles
- Full change history in ArticleHistory table
"""
from datetime import datetime

from sqlmodel import Field, SQLModel


class Article(SQLModel, table=True):
    """
    Article (category) dimension table with SCD Type 1 and hierarchy support.

    Changes to this table are in-place updates (no versioning).
    Full change history is stored in ArticleHistory table (SCD Type 2).

    Stable PK (id) ensures FK integrity in fact tables (t_f_budget_fact, etc).
    Unlike previous SCD Type 2 implementation, the id field NEVER changes when
    article is updated.

    Articles represent budget categories (e.g., "Food", "Transport", "Salary").
    Supports hierarchical organization via parent_id (adjacency list pattern).
    Can be user-specific or global (shared across all users).

    Table: t_d_article
    Pattern: SCD Type 1 + Adjacency List (parent_id for hierarchy)

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

    SCD Type 1 Pattern:
        - Main table contains ONLY current article data (no historical versions)
        - History is stored in separate t_d_article_history table (SCD Type 2)
        - FK in fact tables (t_f_budget_fact.article_id) remain stable (NO updates needed)
        - Article updates (name, parent_id, etc.) are in-place (UPDATE, not INSERT)

    Migration from SCD Type 2:
        Old SCD2 fields REMOVED:
        - valid_from: Replaced by ArticleHistory.valid_from
        - valid_to: Replaced by ArticleHistory.valid_to
        - is_current: Replaced by ArticleHistory.is_current

        Migration Strategy (Phase 2):
        1. Keep only is_current=True version in main table
        2. Move ALL versions to ArticleHistory table
        3. Remap FK in fact tables (old versioned id → new stable id)
        4. Rebuild closure table (t_d_article_hierarchy)

    Attributes:
        id: Surrogate primary key (stable - NEVER changes on updates)
        user_id: Owner user ID (required - tracks creator for audit, SCD1 - in-place update)
        parent_id: Parent article ID for hierarchy (NULL for root articles, SCD1 - in-place update)
        name: Article display name (required, max 255 chars, SCD1 - in-place update)
        description: Optional description or notes (SCD1 - in-place update)
        type: Article type - 'income' or 'expense' (required, SCD1 - in-place update)
        code: Business code for external integrations (optional, SCD1 - in-place update)
        is_active: Active flag (True = visible in UI, False = archived, SCD1 - in-place update)
        created_at: Timestamp when record was created (immutable)
        updated_at: Timestamp when record was last updated (auto-updated on changes)

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
        - When updating an article, use in-place UPDATE (ArticleService will create history record)
        - All articles must have user_id (required field)
        - Parent article must exist before creating child article
        - Unique constraint: (name, type) for active records
        - Full change history is stored in ArticleHistory table (SCD Type 2)
    """

    __tablename__ = "t_d_article"

    # Primary key
    id: int | None = Field(
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
    parent_id: int | None = Field(
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
    description: str | None = Field(
        default=None,
        description="Optional description or notes about the article/category"
    )
    type: str = Field(
        nullable=False,
        max_length=20,
        index=True,
        description="Article type: 'income' or 'expense' (enforced by CHECK constraint)"
    )
    code: str | None = Field(
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
        description="Active status flag (True = visible in UI dropdowns, False = archived, SCD1 - in-place update)"
    )

    # Audit fields
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        description="Record creation timestamp (immutable)"
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        description="Record last update timestamp (auto-updated on changes)"
    )

    # NOTE: SCD Type 2 fields REMOVED (breaking change from previous version)
    # - valid_from: Moved to ArticleHistory table
    # - valid_to: Moved to ArticleHistory table
    # - is_current: Moved to ArticleHistory table
    #
    # Full change history is now stored in separate ArticleHistory table (SCD Type 2)

    def __repr__(self) -> str:
        """String representation of Article model."""
        return (
            f"Article(id={self.id}, name='{self.name}', type='{self.type}', "
            f"user_id={self.user_id}, parent_id={self.parent_id}, "
            f"is_active={self.is_active})"
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
        ...     .where(Article.is_active == True)
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
