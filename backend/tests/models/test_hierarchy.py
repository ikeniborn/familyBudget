"""
Unit tests for ArticleHierarchy model (Closure Table).

Tests hierarchical relationships, depth calculations, and closure table queries.
"""

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.article import Article
from backend.app.models.hierarchy import ArticleHierarchy
from backend.app.models.user import User

# ============================================================================
# ArticleHierarchy Creation Tests
# ============================================================================


@pytest.mark.asyncio
async def test_create_self_reference(session: AsyncSession, test_article_root: Article):
    """Test creating self-reference entry (depth=0)."""
    hierarchy = ArticleHierarchy(
        ancestor_id=test_article_root.id,
        descendant_id=test_article_root.id,
        depth=0,
    )

    session.add(hierarchy)
    await session.commit()
    await session.refresh(hierarchy)

    assert hierarchy.ancestor_id == test_article_root.id
    assert hierarchy.descendant_id == test_article_root.id
    assert hierarchy.depth == 0


@pytest.mark.asyncio
async def test_create_direct_relationship(session: AsyncSession, test_article_root: Article, test_article_child: Article):
    """Test creating direct parent-child relationship (depth=1)."""
    hierarchy = ArticleHierarchy(
        ancestor_id=test_article_root.id,
        descendant_id=test_article_child.id,
        depth=1,
    )

    session.add(hierarchy)
    await session.commit()
    await session.refresh(hierarchy)

    assert hierarchy.ancestor_id == test_article_root.id
    assert hierarchy.descendant_id == test_article_child.id
    assert hierarchy.depth == 1


@pytest.mark.asyncio
async def test_create_transitive_relationship(session: AsyncSession, test_user: User):
    """Test creating transitive relationship (depth>1)."""
    # Create 3-level hierarchy
    root = Article(user_id=test_user.id, name="Root", type="expense")
    child = Article(user_id=test_user.id, parent_id=None, name="Child", type="expense")
    grandchild = Article(user_id=test_user.id, parent_id=None, name="Grandchild", type="expense")

    session.add(root)
    session.add(child)
    session.add(grandchild)
    await session.commit()
    await session.refresh(root)
    await session.refresh(child)
    await session.refresh(grandchild)

    # Create transitive relationship: root -> grandchild (depth=2)
    hierarchy = ArticleHierarchy(
        ancestor_id=root.id,
        descendant_id=grandchild.id,
        depth=2,
    )

    session.add(hierarchy)
    await session.commit()
    await session.refresh(hierarchy)

    assert hierarchy.depth == 2


# ============================================================================
# Closure Table Query Tests
# ============================================================================


@pytest.mark.asyncio
async def test_query_all_descendants(session: AsyncSession, test_user: User):
    """Test querying all descendants of an article."""
    # Create hierarchy:
    # Food (1)
    # ├─ Groceries (2)
    # └─ Dining Out (3)

    food = Article(user_id=test_user.id, name="Food", type="expense")
    session.add(food)
    await session.commit()
    await session.refresh(food)

    groceries = Article(user_id=test_user.id, parent_id=food.id, name="Groceries", type="expense")
    dining = Article(user_id=test_user.id, parent_id=food.id, name="Dining Out", type="expense")
    session.add(groceries)
    session.add(dining)
    await session.commit()
    await session.refresh(groceries)
    await session.refresh(dining)

    # Create closure table entries
    hierarchies = [
        ArticleHierarchy(ancestor_id=food.id, descendant_id=food.id, depth=0),
        ArticleHierarchy(ancestor_id=food.id, descendant_id=groceries.id, depth=1),
        ArticleHierarchy(ancestor_id=food.id, descendant_id=dining.id, depth=1),
        ArticleHierarchy(ancestor_id=groceries.id, descendant_id=groceries.id, depth=0),
        ArticleHierarchy(ancestor_id=dining.id, descendant_id=dining.id, depth=0),
    ]

    for h in hierarchies:
        session.add(h)
    await session.commit()

    # Query all descendants of Food (depth > 0)
    stmt = select(ArticleHierarchy).where(
        ArticleHierarchy.ancestor_id == food.id,
        ArticleHierarchy.depth > 0,
    )
    result = await session.execute(stmt)
    descendants = result.scalars().all()

    assert len(descendants) == 2
    descendant_ids = {d.descendant_id for d in descendants}
    assert descendant_ids == {groceries.id, dining.id}


@pytest.mark.asyncio
async def test_query_direct_children_only(session: AsyncSession, test_user: User):
    """Test querying only direct children (depth=1)."""
    # Create hierarchy with grandchildren
    root = Article(user_id=test_user.id, name="Root", type="expense")
    session.add(root)
    await session.commit()
    await session.refresh(root)

    child1 = Article(user_id=test_user.id, parent_id=root.id, name="Child1", type="expense")
    child2 = Article(user_id=test_user.id, parent_id=root.id, name="Child2", type="expense")
    session.add(child1)
    session.add(child2)
    await session.commit()
    await session.refresh(child1)
    await session.refresh(child2)

    grandchild = Article(user_id=test_user.id, parent_id=child1.id, name="Grandchild", type="expense")
    session.add(grandchild)
    await session.commit()
    await session.refresh(grandchild)

    # Create closure table entries
    hierarchies = [
        ArticleHierarchy(ancestor_id=root.id, descendant_id=root.id, depth=0),
        ArticleHierarchy(ancestor_id=root.id, descendant_id=child1.id, depth=1),
        ArticleHierarchy(ancestor_id=root.id, descendant_id=child2.id, depth=1),
        ArticleHierarchy(ancestor_id=root.id, descendant_id=grandchild.id, depth=2),  # Not direct
        ArticleHierarchy(ancestor_id=child1.id, descendant_id=child1.id, depth=0),
        ArticleHierarchy(ancestor_id=child2.id, descendant_id=child2.id, depth=0),
        ArticleHierarchy(ancestor_id=child1.id, descendant_id=grandchild.id, depth=1),
        ArticleHierarchy(ancestor_id=grandchild.id, descendant_id=grandchild.id, depth=0),
    ]

    for h in hierarchies:
        session.add(h)
    await session.commit()

    # Query only direct children (depth=1)
    stmt = select(ArticleHierarchy).where(
        ArticleHierarchy.ancestor_id == root.id,
        ArticleHierarchy.depth == 1,
    )
    result = await session.execute(stmt)
    children = result.scalars().all()

    assert len(children) == 2
    child_ids = {c.descendant_id for c in children}
    assert child_ids == {child1.id, child2.id}


@pytest.mark.asyncio
async def test_query_all_ancestors(session: AsyncSession, test_user: User):
    """Test querying all ancestors of an article."""
    # Create hierarchy:
    # Food (1) -> Groceries (2) -> Organic (3)

    food = Article(user_id=test_user.id, name="Food", type="expense")
    session.add(food)
    await session.commit()
    await session.refresh(food)

    groceries = Article(user_id=test_user.id, parent_id=food.id, name="Groceries", type="expense")
    session.add(groceries)
    await session.commit()
    await session.refresh(groceries)

    organic = Article(user_id=test_user.id, parent_id=groceries.id, name="Organic", type="expense")
    session.add(organic)
    await session.commit()
    await session.refresh(organic)

    # Create closure table entries
    hierarchies = [
        ArticleHierarchy(ancestor_id=food.id, descendant_id=food.id, depth=0),
        ArticleHierarchy(ancestor_id=food.id, descendant_id=groceries.id, depth=1),
        ArticleHierarchy(ancestor_id=food.id, descendant_id=organic.id, depth=2),
        ArticleHierarchy(ancestor_id=groceries.id, descendant_id=groceries.id, depth=0),
        ArticleHierarchy(ancestor_id=groceries.id, descendant_id=organic.id, depth=1),
        ArticleHierarchy(ancestor_id=organic.id, descendant_id=organic.id, depth=0),
    ]

    for h in hierarchies:
        session.add(h)
    await session.commit()

    # Query all ancestors of Organic (depth > 0)
    stmt = select(ArticleHierarchy).where(
        ArticleHierarchy.descendant_id == organic.id,
        ArticleHierarchy.depth > 0,
    )
    result = await session.execute(stmt)
    ancestors = result.scalars().all()

    assert len(ancestors) == 2
    ancestor_ids = {a.ancestor_id for a in ancestors}
    assert ancestor_ids == {food.id, groceries.id}


@pytest.mark.asyncio
async def test_query_subtree_with_max_depth(session: AsyncSession, test_user: User):
    """Test querying subtree with maximum depth limit."""
    # Create hierarchy:
    # Food (1) -> Groceries (2) -> Organic (3)

    food = Article(user_id=test_user.id, name="Food", type="expense")
    session.add(food)
    await session.commit()
    await session.refresh(food)

    groceries = Article(user_id=test_user.id, parent_id=food.id, name="Groceries", type="expense")
    session.add(groceries)
    await session.commit()
    await session.refresh(groceries)

    organic = Article(user_id=test_user.id, parent_id=groceries.id, name="Organic", type="expense")
    session.add(organic)
    await session.commit()
    await session.refresh(organic)

    # Create closure table entries
    hierarchies = [
        ArticleHierarchy(ancestor_id=food.id, descendant_id=food.id, depth=0),
        ArticleHierarchy(ancestor_id=food.id, descendant_id=groceries.id, depth=1),
        ArticleHierarchy(ancestor_id=food.id, descendant_id=organic.id, depth=2),
        ArticleHierarchy(ancestor_id=groceries.id, descendant_id=groceries.id, depth=0),
        ArticleHierarchy(ancestor_id=groceries.id, descendant_id=organic.id, depth=1),
        ArticleHierarchy(ancestor_id=organic.id, descendant_id=organic.id, depth=0),
    ]

    for h in hierarchies:
        session.add(h)
    await session.commit()

    # Query subtree up to depth 1 (Food and direct children only)
    stmt = select(ArticleHierarchy).where(
        ArticleHierarchy.ancestor_id == food.id,
        ArticleHierarchy.depth <= 1,
    )
    result = await session.execute(stmt)
    subtree = result.scalars().all()

    assert len(subtree) == 2  # Food (0) and Groceries (1), not Organic (2)
    descendant_ids = {s.descendant_id for s in subtree}
    assert descendant_ids == {food.id, groceries.id}


# ============================================================================
# Model Method Tests
# ============================================================================


@pytest.mark.asyncio
async def test_is_self_reference_method(session: AsyncSession, test_article_root: Article):
    """Test is_self_reference() method."""
    hierarchy = ArticleHierarchy(
        ancestor_id=test_article_root.id,
        descendant_id=test_article_root.id,
        depth=0,
    )

    assert hierarchy.is_self_reference() is True


@pytest.mark.asyncio
async def test_is_not_self_reference(session: AsyncSession, test_article_root: Article, test_article_child: Article):
    """Test is_self_reference() returns False for non-self."""
    hierarchy = ArticleHierarchy(
        ancestor_id=test_article_root.id,
        descendant_id=test_article_child.id,
        depth=1,
    )

    assert hierarchy.is_self_reference() is False


@pytest.mark.asyncio
async def test_is_direct_relationship_method(session: AsyncSession, test_article_root: Article, test_article_child: Article):
    """Test is_direct_relationship() method."""
    hierarchy = ArticleHierarchy(
        ancestor_id=test_article_root.id,
        descendant_id=test_article_child.id,
        depth=1,
    )

    assert hierarchy.is_direct_relationship() is True


@pytest.mark.asyncio
async def test_is_not_direct_relationship(session: AsyncSession, test_user: User):
    """Test is_direct_relationship() returns False for depth != 1."""
    # Self-reference (depth=0)
    hierarchy1 = ArticleHierarchy(ancestor_id=1, descendant_id=1, depth=0)
    assert hierarchy1.is_direct_relationship() is False

    # Transitive (depth=2)
    hierarchy2 = ArticleHierarchy(ancestor_id=1, descendant_id=3, depth=2)
    assert hierarchy2.is_direct_relationship() is False


@pytest.mark.asyncio
async def test_is_transitive_relationship_method(session: AsyncSession):
    """Test is_transitive_relationship() method."""
    hierarchy = ArticleHierarchy(
        ancestor_id=1,
        descendant_id=3,
        depth=2,
    )

    assert hierarchy.is_transitive_relationship() is True


@pytest.mark.asyncio
async def test_is_not_transitive_relationship(session: AsyncSession):
    """Test is_transitive_relationship() returns False for depth <= 1."""
    # Self-reference (depth=0)
    hierarchy1 = ArticleHierarchy(ancestor_id=1, descendant_id=1, depth=0)
    assert hierarchy1.is_transitive_relationship() is False

    # Direct (depth=1)
    hierarchy2 = ArticleHierarchy(ancestor_id=1, descendant_id=2, depth=1)
    assert hierarchy2.is_transitive_relationship() is False


# ============================================================================
# Model Representation Tests
# ============================================================================


@pytest.mark.asyncio
async def test_hierarchy_repr_self_reference(session: AsyncSession):
    """Test ArticleHierarchy __repr__ for self-reference."""
    hierarchy = ArticleHierarchy(
        ancestor_id=1,
        descendant_id=1,
        depth=0,
    )

    repr_str = repr(hierarchy)

    assert "ArticleHierarchy" in repr_str
    assert "1 → 1" in repr_str
    assert "self" in repr_str


@pytest.mark.asyncio
async def test_hierarchy_repr_direct_child(session: AsyncSession):
    """Test ArticleHierarchy __repr__ for direct child."""
    hierarchy = ArticleHierarchy(
        ancestor_id=1,
        descendant_id=2,
        depth=1,
    )

    repr_str = repr(hierarchy)

    assert "ArticleHierarchy" in repr_str
    assert "1 → 2" in repr_str
    assert "depth=1" in repr_str


@pytest.mark.asyncio
async def test_hierarchy_repr_grandchild(session: AsyncSession):
    """Test ArticleHierarchy __repr__ for grandchild."""
    hierarchy = ArticleHierarchy(
        ancestor_id=1,
        descendant_id=3,
        depth=2,
    )

    repr_str = repr(hierarchy)

    assert "ArticleHierarchy" in repr_str
    assert "1 → 3" in repr_str
    assert "depth=2" in repr_str


# ============================================================================
# Complex Hierarchy Tests
# ============================================================================


@pytest.mark.asyncio
async def test_complex_hierarchy_all_paths(session: AsyncSession, test_user: User):
    """Test complex hierarchy with all closure table paths."""
    # Create hierarchy:
    # Food (1)
    # ├─ Groceries (2)
    # │  ├─ Organic (3)
    # │  └─ Regular (4)
    # └─ Dining Out (5)

    food = Article(user_id=test_user.id, name="Food", type="expense")
    session.add(food)
    await session.commit()
    await session.refresh(food)

    groceries = Article(user_id=test_user.id, parent_id=food.id, name="Groceries", type="expense")
    dining = Article(user_id=test_user.id, parent_id=food.id, name="Dining Out", type="expense")
    session.add(groceries)
    session.add(dining)
    await session.commit()
    await session.refresh(groceries)
    await session.refresh(dining)

    organic = Article(user_id=test_user.id, parent_id=groceries.id, name="Organic", type="expense")
    regular = Article(user_id=test_user.id, parent_id=groceries.id, name="Regular", type="expense")
    session.add(organic)
    session.add(regular)
    await session.commit()
    await session.refresh(organic)
    await session.refresh(regular)

    # Create all closure table entries (5 self + 4 direct + 4 transitive = 13 total)
    hierarchies = [
        # Self-references (5)
        ArticleHierarchy(ancestor_id=food.id, descendant_id=food.id, depth=0),
        ArticleHierarchy(ancestor_id=groceries.id, descendant_id=groceries.id, depth=0),
        ArticleHierarchy(ancestor_id=dining.id, descendant_id=dining.id, depth=0),
        ArticleHierarchy(ancestor_id=organic.id, descendant_id=organic.id, depth=0),
        ArticleHierarchy(ancestor_id=regular.id, descendant_id=regular.id, depth=0),
        # Direct relationships (4)
        ArticleHierarchy(ancestor_id=food.id, descendant_id=groceries.id, depth=1),
        ArticleHierarchy(ancestor_id=food.id, descendant_id=dining.id, depth=1),
        ArticleHierarchy(ancestor_id=groceries.id, descendant_id=organic.id, depth=1),
        ArticleHierarchy(ancestor_id=groceries.id, descendant_id=regular.id, depth=1),
        # Transitive relationships (4)
        ArticleHierarchy(ancestor_id=food.id, descendant_id=organic.id, depth=2),
        ArticleHierarchy(ancestor_id=food.id, descendant_id=regular.id, depth=2),
    ]

    for h in hierarchies:
        session.add(h)
    await session.commit()

    # Query all descendants of Food
    stmt = select(ArticleHierarchy).where(ArticleHierarchy.ancestor_id == food.id)
    result = await session.execute(stmt)
    all_paths = result.scalars().all()

    assert len(all_paths) == 6  # Food itself + 5 descendants
