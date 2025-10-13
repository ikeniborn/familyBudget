"""
Hierarchy Query Service for Article Tree Structure.

This module provides efficient hierarchical queries using the Closure Table pattern
(ArticleHierarchy model). All queries are optimized with O(1) complexity thanks to
pre-computed paths stored in the closure table.

Key Functions:
    - get_subtree(): Get all descendants of an article
    - get_ancestors(): Get all ancestors of an article
    - get_path(): Get path from root to article
    - get_depth(): Get maximum depth of subtree
    - get_direct_children(): Get immediate children only
    - get_root(): Find root article of tree

Performance:
    All queries use indexed lookups on closure table - O(1) complexity.
    No recursive queries needed.
"""

from typing import Optional

from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.models.article import Article
from backend.app.models.hierarchy import ArticleHierarchy


async def get_subtree(
    session: AsyncSession,
    article_id: int,
    max_depth: Optional[int] = None,
    include_self: bool = True,
) -> list[Article]:
    """
    Get all descendants of an article (subtree).

    Uses closure table for efficient O(1) query.

    Args:
        session: AsyncSession for database operations
        article_id: Root article ID to get subtree for
        max_depth: Optional maximum depth to traverse (None = unlimited)
        include_self: If True, includes the root article itself

    Returns:
        List of Article instances ordered by depth (root first, then children, etc.)

    Example:
        >>> # Get all descendants of "Food" article
        >>> articles = await get_subtree(session, article_id=1)
        >>> # Returns: [Food, Groceries, Dining Out, Organic, Regular, Restaurants]

        >>> # Get only direct children and grandchildren
        >>> articles = await get_subtree(session, article_id=1, max_depth=2)

        >>> # Get descendants without root
        >>> articles = await get_subtree(session, article_id=1, include_self=False)

    Notes:
        - Results are ordered by depth (shallowest first)
        - Only returns current versions (is_current=True)
        - Returns empty list if article not found or no descendants
        - Respects user isolation (caller must check access rights)
    """
    # Build closure table query
    statement = select(ArticleHierarchy.descendant_id, ArticleHierarchy.depth).where(
        ArticleHierarchy.ancestor_id == article_id
    )

    # Apply depth filter
    if not include_self:
        statement = statement.where(ArticleHierarchy.depth > 0)

    if max_depth is not None:
        statement = statement.where(ArticleHierarchy.depth <= max_depth)

    # Order by depth (root → leaves)
    statement = statement.order_by(ArticleHierarchy.depth)

    # Execute query to get descendant IDs
    result = await session.execute(statement)
    descendants = result.all()

    if not descendants:
        return []

    # Extract IDs
    descendant_ids = [d.descendant_id for d in descendants]

    # Load Article instances (only current versions)
    articles_stmt = select(Article).where(
        Article.id.in_(descendant_ids),
        Article.is_current == True  # noqa: E712
    )
    articles_result = await session.execute(articles_stmt)
    articles = list(articles_result.scalars().all())

    # Sort articles by depth (maintain closure table ordering)
    # Create depth lookup
    depth_map = {d.descendant_id: d.depth for d in descendants}
    articles.sort(key=lambda a: depth_map.get(a.id, 999))

    return articles


async def get_ancestors(
    session: AsyncSession,
    article_id: int,
    include_self: bool = False,
) -> list[Article]:
    """
    Get all ancestors of an article (path to root).

    Uses closure table for efficient O(1) query.

    Args:
        session: AsyncSession for database operations
        article_id: Article ID to get ancestors for
        include_self: If True, includes the article itself

    Returns:
        List of Article instances ordered by depth DESC (root first, then children, article last)

    Example:
        >>> # Get path from root to "Organic" article
        >>> ancestors = await get_ancestors(session, article_id=3)
        >>> # Returns: [Food, Groceries] (root → ... → parent)

        >>> # Include the article itself
        >>> path = await get_ancestors(session, article_id=3, include_self=True)
        >>> # Returns: [Food, Groceries, Organic]

    Notes:
        - Results ordered root-first (depth DESC)
        - Only returns current versions (is_current=True)
        - Returns empty list if article is root or not found
        - Useful for breadcrumb navigation
    """
    # Build closure table query
    statement = select(ArticleHierarchy.ancestor_id, ArticleHierarchy.depth).where(
        ArticleHierarchy.descendant_id == article_id
    )

    # Apply self filter
    if not include_self:
        statement = statement.where(ArticleHierarchy.depth > 0)

    # Order by depth DESC (root first)
    statement = statement.order_by(ArticleHierarchy.depth.desc())

    # Execute query to get ancestor IDs
    result = await session.execute(statement)
    ancestors = result.all()

    if not ancestors:
        return []

    # Extract IDs
    ancestor_ids = [a.ancestor_id for a in ancestors]

    # Load Article instances (only current versions)
    articles_stmt = select(Article).where(
        Article.id.in_(ancestor_ids),
        Article.is_current == True  # noqa: E712
    )
    articles_result = await session.execute(articles_stmt)
    articles = list(articles_result.scalars().all())

    # Sort articles by depth DESC (maintain closure table ordering)
    # Create depth lookup
    depth_map = {a.ancestor_id: a.depth for a in ancestors}
    articles.sort(key=lambda a: depth_map.get(a.id, 0), reverse=True)

    return articles


async def get_path(
    session: AsyncSession,
    article_id: int,
) -> list[Article]:
    """
    Get complete path from root to article (includes both ancestors and self).

    Convenience function equivalent to get_ancestors(include_self=True).

    Args:
        session: AsyncSession for database operations
        article_id: Article ID to get path for

    Returns:
        List of Article instances ordered root → article

    Example:
        >>> # Get breadcrumb path for "Organic"
        >>> path = await get_path(session, article_id=3)
        >>> # Returns: [Food, Groceries, Organic]
        >>> breadcrumb = " > ".join(a.name for a in path)
        >>> # "Food > Groceries > Organic"

    Notes:
        - Always includes the article itself
        - Root article returns single-element list [root]
        - Useful for breadcrumbs and navigation
    """
    return await get_ancestors(session, article_id, include_self=True)


async def get_depth(
    session: AsyncSession,
    article_id: int,
) -> int:
    """
    Get maximum depth of subtree below article.

    Returns 0 if article is a leaf (no children).

    Args:
        session: AsyncSession for database operations
        article_id: Article ID to calculate depth for

    Returns:
        Maximum depth of subtree (0 = leaf, 1 = has children, etc.)

    Example:
        >>> # Check if article has children
        >>> depth = await get_depth(session, article_id=1)
        >>> # Returns: 2 (has children and grandchildren)

        >>> # Leaf node
        >>> depth = await get_depth(session, article_id=3)
        >>> # Returns: 0 (no children)

    Notes:
        - O(1) query using closure table MAX(depth)
        - Returns 0 for leaf nodes
        - Returns None if article not found (converted to 0)
    """
    # Query for maximum depth in subtree
    statement = select(func.max(ArticleHierarchy.depth)).where(
        ArticleHierarchy.ancestor_id == article_id
    )

    result = await session.execute(statement)
    max_depth = result.scalar_one_or_none()

    return max_depth if max_depth is not None else 0


async def get_direct_children(
    session: AsyncSession,
    article_id: int,
) -> list[Article]:
    """
    Get immediate children of an article (depth=1 only).

    Args:
        session: AsyncSession for database operations
        article_id: Parent article ID

    Returns:
        List of direct child Article instances

    Example:
        >>> # Get direct children of "Food"
        >>> children = await get_direct_children(session, article_id=1)
        >>> # Returns: [Groceries, Dining Out] (depth=1 only)

    Notes:
        - Only returns direct children (depth=1)
        - Only returns current versions (is_current=True)
        - Returns empty list if no children
        - Excludes transitive descendants (grandchildren, etc.)
    """
    return await get_subtree(
        session=session,
        article_id=article_id,
        max_depth=1,
        include_self=False,
    )


async def get_root(
    session: AsyncSession,
    article_id: int,
) -> Optional[Article]:
    """
    Find root article of the tree containing the given article.

    Root is the article with no ancestors (top of hierarchy).

    Args:
        session: AsyncSession for database operations
        article_id: Article ID to find root for

    Returns:
        Root Article instance or None if not found

    Example:
        >>> # Find root of "Organic" article
        >>> root = await get_root(session, article_id=3)
        >>> # Returns: Food (top of hierarchy)

    Notes:
        - Returns the article itself if it's already root
        - Returns None if article not found
        - Uses closure table to find ancestor with maximum depth
    """
    # Query for ancestor with maximum depth (root is furthest ancestor)
    statement = (
        select(ArticleHierarchy.ancestor_id, ArticleHierarchy.depth)
        .where(ArticleHierarchy.descendant_id == article_id)
        .order_by(ArticleHierarchy.depth.desc())
        .limit(1)
    )

    result = await session.execute(statement)
    root_entry = result.first()

    if not root_entry:
        return None

    root_id = root_entry.ancestor_id

    # Load root Article instance
    article_stmt = select(Article).where(
        Article.id == root_id,
        Article.is_current == True  # noqa: E712
    )
    article_result = await session.execute(article_stmt)
    return article_result.scalar_one_or_none()


async def is_descendant_of(
    session: AsyncSession,
    article_id: int,
    potential_ancestor_id: int,
) -> bool:
    """
    Check if article is a descendant of another article.

    Args:
        session: AsyncSession for database operations
        article_id: Article ID to check
        potential_ancestor_id: Potential ancestor article ID

    Returns:
        True if article is descendant of potential_ancestor

    Example:
        >>> # Check if "Organic" is under "Food"
        >>> is_under = await is_descendant_of(
        ...     session,
        ...     article_id=3,  # Organic
        ...     potential_ancestor_id=1  # Food
        ... )
        >>> # Returns: True

    Notes:
        - Uses closure table EXISTS query (very fast)
        - Returns False if either article not found
        - Self-references return True (article is descendant of itself)
    """
    # Query closure table for path existence
    statement = select(ArticleHierarchy).where(
        ArticleHierarchy.ancestor_id == potential_ancestor_id,
        ArticleHierarchy.descendant_id == article_id,
    )

    result = await session.execute(statement)
    return result.scalar_one_or_none() is not None


async def get_level(
    session: AsyncSession,
    article_id: int,
) -> int:
    """
    Get level of article in tree (distance from root).

    Root articles have level=0, their children have level=1, etc.

    Args:
        session: AsyncSession for database operations
        article_id: Article ID to get level for

    Returns:
        Level in tree (0=root, 1=child of root, etc.)

    Example:
        >>> # Get level of "Organic"
        >>> level = await get_level(session, article_id=3)
        >>> # Returns: 2 (Food → Groceries → Organic)

    Notes:
        - Root articles return 0
        - Uses closure table to find maximum ancestor depth
        - Returns 0 if article not found
    """
    # Query for maximum depth to any ancestor (= level in tree)
    statement = select(func.max(ArticleHierarchy.depth)).where(
        ArticleHierarchy.descendant_id == article_id
    )

    result = await session.execute(statement)
    level = result.scalar_one_or_none()

    return level if level is not None else 0
