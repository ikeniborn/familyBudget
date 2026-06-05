"""
Hierarchy Query Service for ProductGroup Tree Structure.

This module provides efficient hierarchical queries using the Closure Table pattern
(ProductGroupHierarchy model). All queries are optimized with O(1) complexity thanks to
pre-computed paths stored in the closure table.

Key Functions:
    - get_subtree(): Get all descendants of a product group
    - get_ancestors(): Get all ancestors of a product group
    - get_direct_children(): Get immediate children only
    - get_depth(): Get maximum depth of subtree
    - create_hierarchy_paths(): Create closure table entries for new product group
    - delete_hierarchy_paths(): Delete closure table entries when deleting product group
    - move_subtree(): Move product group to new parent (updates closure table)
    - rebuild_hierarchy(): Rebuild entire closure table from adjacency list

Performance:
    All queries use indexed lookups on closure table - O(1) complexity.
    No recursive queries needed.
"""

from sqlalchemy import delete, insert, literal
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.models.product_group import ProductGroup
from backend.app.models.product_group_hierarchy import ProductGroupHierarchy


async def get_all(session: AsyncSession) -> list[ProductGroupHierarchy]:
    """Return all rows from the closure table."""
    result = await session.exec(select(ProductGroupHierarchy))
    return list(result.all())


async def get_subtree(
    session: AsyncSession,
    product_group_id: int,
    max_depth: int | None = None,
    include_self: bool = True,
) -> list[ProductGroup]:
    """
    Get all descendants of a product group (subtree).

    Uses closure table for efficient O(1) query.

    Args:
        session: AsyncSession for database operations
        product_group_id: Root product group ID to get subtree for
        max_depth: Optional maximum depth to traverse (None = unlimited)
        include_self: If True, includes the root product group itself

    Returns:
        List of ProductGroup instances ordered by depth (root first, then children, etc.)

    Example:
        >>> # Get all descendants of "Food" product group
        >>> groups = await get_subtree(session, product_group_id=1)
        >>> # Returns: [Food, Dairy, Vegetables, Milk, Cheese, Leafy Greens]

        >>> # Get only direct children
        >>> groups = await get_subtree(session, product_group_id=1, max_depth=1)

    Notes:
        - Results are ordered by depth (shallowest first)
        - Returns empty list if product group not found or no descendants
    """
    # Build closure table query
    statement = select(ProductGroupHierarchy.descendant_id, ProductGroupHierarchy.depth).where(
        ProductGroupHierarchy.ancestor_id == product_group_id
    )

    # Apply depth filter
    if not include_self:
        statement = statement.where(ProductGroupHierarchy.depth > 0)

    if max_depth is not None:
        statement = statement.where(ProductGroupHierarchy.depth <= max_depth)

    # Order by depth (root → leaves)
    statement = statement.order_by(ProductGroupHierarchy.depth)

    # Execute query to get descendant IDs
    result = await session.execute(statement)
    descendants = result.all()

    if not descendants:
        return []

    # Extract IDs
    descendant_ids = [d.descendant_id for d in descendants]

    # Load ProductGroup instances
    groups_stmt = select(ProductGroup).where(
        ProductGroup.id.in_(descendant_ids)
    )
    groups_result = await session.execute(groups_stmt)
    groups = list(groups_result.scalars().all())

    # Sort groups by depth (maintain closure table ordering)
    # Create depth lookup
    depth_map = {d.descendant_id: d.depth for d in descendants}
    groups.sort(key=lambda g: depth_map.get(g.id, 999))

    return groups


async def get_ancestors(
    session: AsyncSession,
    product_group_id: int,
    include_self: bool = False,
) -> list[ProductGroup]:
    """
    Get all ancestors of a product group (path to root).

    Uses closure table for efficient O(1) query.

    Args:
        session: AsyncSession for database operations
        product_group_id: ProductGroup ID to get ancestors for
        include_self: If True, includes the product group itself

    Returns:
        List of ProductGroup instances ordered by depth DESC (root first, then children, group last)

    Example:
        >>> # Get path from root to "Milk" product group
        >>> ancestors = await get_ancestors(session, product_group_id=3)
        >>> # Returns: [Food, Dairy] (root → ... → parent)

        >>> # Include the group itself
        >>> path = await get_ancestors(session, product_group_id=3, include_self=True)
        >>> # Returns: [Food, Dairy, Milk]

    Notes:
        - Results ordered root-first (depth DESC)
        - Returns empty list if product group is root or not found
        - Useful for breadcrumb navigation
    """
    # Build closure table query
    statement = select(ProductGroupHierarchy.ancestor_id, ProductGroupHierarchy.depth).where(
        ProductGroupHierarchy.descendant_id == product_group_id
    )

    # Apply self filter
    if not include_self:
        statement = statement.where(ProductGroupHierarchy.depth > 0)

    # Order by depth DESC (root → leaves)
    statement = statement.order_by(ProductGroupHierarchy.depth.desc())

    # Execute query to get ancestor IDs
    result = await session.execute(statement)
    ancestors = result.all()

    if not ancestors:
        return []

    # Extract IDs
    ancestor_ids = [a.ancestor_id for a in ancestors]

    # Load ProductGroup instances
    groups_stmt = select(ProductGroup).where(
        ProductGroup.id.in_(ancestor_ids)
    )
    groups_result = await session.execute(groups_stmt)
    groups = list(groups_result.scalars().all())

    # Sort groups by depth DESC (root first)
    depth_map = {a.ancestor_id: a.depth for a in ancestors}
    groups.sort(key=lambda g: depth_map.get(g.id, -1), reverse=True)

    return groups


async def get_direct_children(
    session: AsyncSession,
    product_group_id: int,
) -> list[ProductGroup]:
    """
    Get direct children of a product group (depth=1).

    Args:
        session: AsyncSession for database operations
        product_group_id: ProductGroup ID to get children for

    Returns:
        List of direct child ProductGroup instances

    Example:
        >>> # Get direct children of "Food"
        >>> children = await get_direct_children(session, product_group_id=1)
        >>> # Returns: [Dairy, Vegetables]
    """
    return await get_subtree(
        session=session,
        product_group_id=product_group_id,
        max_depth=1,
        include_self=False
    )


async def get_depth(
    session: AsyncSession,
    product_group_id: int,
) -> int:
    """
    Get maximum depth of subtree rooted at product_group_id.

    Args:
        session: AsyncSession for database operations
        product_group_id: ProductGroup ID to get depth for

    Returns:
        Maximum depth of subtree (0 if leaf node)

    Example:
        >>> depth = await get_depth(session, product_group_id=1)
        >>> # Returns: 2 (if tree has 3 levels including root)
    """
    from sqlalchemy import func

    statement = select(func.max(ProductGroupHierarchy.depth)).where(
        ProductGroupHierarchy.ancestor_id == product_group_id
    )

    result = await session.execute(statement)
    max_depth = result.scalar_one_or_none()

    return max_depth if max_depth is not None else 0


async def create_hierarchy_paths(
    session: AsyncSession,
    product_group_id: int,
    parent_id: int | None = None,
) -> None:
    """
    Create closure table entries for new product group.

    Creates two types of entries:
    1. Self-reference (depth=0)
    2. All ancestor paths from parent (depth incremented)

    Args:
        session: AsyncSession for database operations
        product_group_id: ID of newly created product group
        parent_id: Optional parent product group ID (None for root groups)

    Example:
        >>> # After creating new product group
        >>> pg = ProductGroup(name="Milk", parent_id=2)
        >>> session.add(pg)
        >>> await session.commit()
        >>> await session.refresh(pg)
        >>> await create_hierarchy_paths(session, product_group_id=pg.id, parent_id=pg.parent_id)

    Notes:
        - Must be called AFTER committing new product group to DB
        - Automatically creates all necessary closure table entries
    """
    # Step 1: Create self-reference (depth=0)
    self_ref = ProductGroupHierarchy(
        ancestor_id=product_group_id,
        descendant_id=product_group_id,
        depth=0
    )
    session.add(self_ref)

    # Step 2: If has parent, copy all ancestor paths from parent + increment depth
    if parent_id is not None:
        # Use raw SQL for efficiency (INSERT INTO ... SELECT ...)
        stmt = insert(ProductGroupHierarchy).from_select(
            ['ancestor_id', 'descendant_id', 'depth'],
            select(
                ProductGroupHierarchy.ancestor_id,
                literal(product_group_id),
                ProductGroupHierarchy.depth + 1
            ).where(ProductGroupHierarchy.descendant_id == parent_id)
        )
        await session.execute(stmt)

    await session.commit()


async def delete_hierarchy_paths(
    session: AsyncSession,
    product_group_id: int,
) -> None:
    """
    Delete closure table entries when deleting product group.

    Removes all entries where product_group_id appears as ancestor or descendant.

    Args:
        session: AsyncSession for database operations
        product_group_id: ID of product group being deleted

    Example:
        >>> # Before deleting product group
        >>> await delete_hierarchy_paths(session, product_group_id=5)
        >>> # Then delete the product group itself
        >>> await session.delete(product_group)
        >>> await session.commit()

    Notes:
        - Must be called BEFORE deleting product group from main table
        - Removes all paths involving this product group
        - Child groups must be handled separately (reparent or delete)
    """
    # Delete all entries where product_group_id is ancestor or descendant
    stmt = delete(ProductGroupHierarchy).where(
        (ProductGroupHierarchy.ancestor_id == product_group_id) |
        (ProductGroupHierarchy.descendant_id == product_group_id)
    )
    await session.execute(stmt)
    await session.commit()


async def move_subtree(
    session: AsyncSession,
    product_group_id: int,
    new_parent_id: int | None,
) -> None:
    """
    Move product group (and its subtree) to new parent.

    Updates closure table to reflect new hierarchy structure.

    Args:
        session: AsyncSession for database operations
        product_group_id: ID of product group to move
        new_parent_id: ID of new parent (None to move to root)

    Example:
        >>> # Move "Milk" from "Dairy" to "Beverages"
        >>> await move_subtree(session, product_group_id=3, new_parent_id=10)

    Notes:
        - Rebuilds closure table entries for moved subtree
        - Automatically handles all descendants
        - Requires two steps: delete old paths, insert new paths
    """
    # Step 1: Get all descendants (including self) that need to be moved
    descendants_stmt = select(ProductGroupHierarchy.descendant_id).where(
        ProductGroupHierarchy.ancestor_id == product_group_id
    )
    descendants_result = await session.execute(descendants_stmt)
    descendant_ids = [row[0] for row in descendants_result.all()]

    # Step 2: Delete old ancestor paths (but keep within-subtree paths)
    # Delete all paths where ancestor is OUTSIDE subtree and descendant is INSIDE subtree
    delete_stmt = delete(ProductGroupHierarchy).where(
        ProductGroupHierarchy.descendant_id.in_(descendant_ids),
        ~ProductGroupHierarchy.ancestor_id.in_(descendant_ids)
    )
    await session.execute(delete_stmt)

    # Step 3: Insert new ancestor paths
    if new_parent_id is not None:
        # For each descendant in moved subtree, create paths to new ancestors
        for descendant_id in descendant_ids:
            # Get depth within moved subtree
            depth_stmt = select(ProductGroupHierarchy.depth).where(
                ProductGroupHierarchy.ancestor_id == product_group_id,
                ProductGroupHierarchy.descendant_id == descendant_id
            )
            depth_result = await session.execute(depth_stmt)
            subtree_depth = depth_result.scalar_one()

            # Insert paths from new parent's ancestors to this descendant
            insert_stmt = insert(ProductGroupHierarchy).from_select(
                ['ancestor_id', 'descendant_id', 'depth'],
                select(
                    ProductGroupHierarchy.ancestor_id,
                    literal(descendant_id),
                    ProductGroupHierarchy.depth + subtree_depth + 1
                ).where(ProductGroupHierarchy.descendant_id == new_parent_id)
            )
            await session.execute(insert_stmt)

    await session.commit()


async def rebuild_hierarchy(
    session: AsyncSession,
) -> None:
    """
    Rebuild entire closure table from ProductGroup.parent_id adjacency list.

    Use this function to repair broken closure table or after bulk operations.

    Args:
        session: AsyncSession for database operations

    Example:
        >>> # After bulk import or data corruption
        >>> await rebuild_hierarchy(session)

    Notes:
        - Truncates closure table and rebuilds from scratch
        - Reads parent_id from ProductGroup table
        - Can be slow for large hierarchies (use sparingly)
    """
    # Step 1: Truncate closure table
    await session.execute(delete(ProductGroupHierarchy))

    # Step 2: Get all product groups
    groups_stmt = select(ProductGroup.id, ProductGroup.parent_id)
    groups_result = await session.execute(groups_stmt)
    groups = groups_result.all()

    # Step 3: Insert self-references
    for group in groups:
        self_ref = ProductGroupHierarchy(
            ancestor_id=group.id,
            descendant_id=group.id,
            depth=0
        )
        session.add(self_ref)

    await session.flush()

    # Step 4: Build paths iteratively (breadth-first)
    # For each level of depth, create paths
    max_iterations = 100  # Prevent infinite loops
    for iteration in range(max_iterations):
        # Find groups that need parent paths created
        # (groups with parent_id but no ancestor paths yet, except self-ref)
        needs_paths_stmt = select(ProductGroup.id, ProductGroup.parent_id).where(
            ProductGroup.parent_id.isnot(None),
            ~ProductGroup.id.in_(
                select(ProductGroupHierarchy.descendant_id).where(
                    ProductGroupHierarchy.depth > 0
                )
            )
        )
        needs_paths_result = await session.execute(needs_paths_stmt)
        needs_paths = needs_paths_result.all()

        if not needs_paths:
            break  # All paths created

        # For each group, copy paths from parent
        for group_id, parent_id in needs_paths:
            insert_stmt = insert(ProductGroupHierarchy).from_select(
                ['ancestor_id', 'descendant_id', 'depth'],
                select(
                    ProductGroupHierarchy.ancestor_id,
                    literal(group_id),
                    ProductGroupHierarchy.depth + 1
                ).where(ProductGroupHierarchy.descendant_id == parent_id)
            )
            await session.execute(insert_stmt)

        await session.flush()

    await session.commit()
