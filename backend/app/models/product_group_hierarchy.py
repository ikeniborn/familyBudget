"""
ProductGroup Hierarchy Model - Closure Table Implementation

This module implements the Closure Table pattern for efficient hierarchical queries
on the product group tree structure. It complements the adjacency list (parent_id) in the
ProductGroup model by storing ALL ancestor-descendant paths.

Pattern: Closure Table
Table: t_d_product_group_hierarchy
Maintenance: Managed via service layer (ProductGroupHierarchyService)
"""

from sqlmodel import Field, SQLModel


class ProductGroupHierarchy(SQLModel, table=True):
    """
    Closure Table for product group hierarchy.

    Stores ALL paths in the product group tree, enabling efficient hierarchical queries.
    This is a pure junction/association table that complements the adjacency list
    (parent_id) in the ProductGroup model.

    Table: t_d_product_group_hierarchy
    Pattern: Closure Table

    The table stores three types of relationships:
    1. Self-references: (group_id, group_id, 0)
       - Every product group has a path to itself with depth 0
    2. Direct parent-child: (parent_id, child_id, 1)
       - Direct relationships from adjacency list
    3. All ancestor-descendant: (ancestor_id, descendant_id, depth)
       - Transitive closure of all paths in the tree

    Example hierarchy:
        Food (id=1)
        ├─ Dairy (id=2)
        │  ├─ Milk (id=3)
        │  └─ Cheese (id=4)
        └─ Vegetables (id=5)
           └─ Leafy Greens (id=6)

    Closure table entries (24 rows total):
        # Self-references (depth=0)
        (1, 1, 0)  -- Food → Food
        (2, 2, 0)  -- Dairy → Dairy
        (3, 3, 0)  -- Milk → Milk
        (4, 4, 0)  -- Cheese → Cheese
        (5, 5, 0)  -- Vegetables → Vegetables
        (6, 6, 0)  -- Leafy Greens → Leafy Greens

        # Direct relationships (depth=1)
        (1, 2, 1)  -- Food → Dairy
        (1, 5, 1)  -- Food → Vegetables
        (2, 3, 1)  -- Dairy → Milk
        (2, 4, 1)  -- Dairy → Cheese
        (5, 6, 1)  -- Vegetables → Leafy Greens

        # Transitive relationships (depth>1)
        (1, 3, 2)  -- Food → Milk (via Dairy)
        (1, 4, 2)  -- Food → Cheese (via Dairy)
        (1, 6, 2)  -- Food → Leafy Greens (via Vegetables)

    Query Examples:
    ----------------

    1. Get all descendants of "Food" (id=1):
       SELECT descendant_id FROM t_d_product_group_hierarchy
       WHERE ancestor_id = 1 AND depth > 0
       Result: [2, 3, 4, 5, 6]

    2. Get direct children of "Food":
       SELECT descendant_id FROM t_d_product_group_hierarchy
       WHERE ancestor_id = 1 AND depth = 1
       Result: [2, 5]

    3. Get all ancestors of "Milk" (id=3):
       SELECT ancestor_id FROM t_d_product_group_hierarchy
       WHERE descendant_id = 3 AND depth > 0
       Result: [1, 2]

    4. Get subtree of "Food" up to depth 1:
       SELECT descendant_id FROM t_d_product_group_hierarchy
       WHERE ancestor_id = 1 AND depth <= 1
       Result: [1, 2, 5]

    5. Check if "Milk" is descendant of "Food":
       SELECT EXISTS (
         SELECT 1 FROM t_d_product_group_hierarchy
         WHERE ancestor_id = 1 AND descendant_id = 3
       )
       Result: true

    6. Get path length from "Food" to "Milk":
       SELECT depth FROM t_d_product_group_hierarchy
       WHERE ancestor_id = 1 AND descendant_id = 3
       Result: 2

    Benefits:
    ---------
    - O(1) query complexity for descendants/ancestors
    - No recursive queries needed
    - Efficient subtree operations
    - Direct path length calculation
    - Simple existence checks

    Trade-offs:
    -----------
    - More storage: O(n²) worst case for deep trees
    - Insert/delete requires updating multiple rows
    - Maintained via ProductGroupHierarchyService

    Performance:
    ------------
    - Indexed on (ancestor_id, descendant_id) [PRIMARY KEY]
    - Indexed on descendant_id for reverse lookups
    - Indexed on depth for level-based queries

    Note: This table is managed by ProductGroupHierarchyService.
          Direct manipulation is NOT recommended. Use ProductGroup.parent_id changes
          via the service layer which will update the closure table.

    Attributes:
        ancestor_id: ProductGroup ID of the ancestor in the hierarchy path
        descendant_id: ProductGroup ID of the descendant in the hierarchy path
        depth: Distance between ancestor and descendant (0=self, 1=direct child, >1=deeper)

    Primary Key: (ancestor_id, descendant_id)
    Foreign Keys: ancestor_id → t_d_product_group.id, descendant_id → t_d_product_group.id
    """

    __tablename__ = "t_d_product_group_hierarchy"

    # Composite primary key (ancestor_id, descendant_id)
    ancestor_id: int = Field(
        foreign_key="t_d_product_group.id",
        primary_key=True,
        description="ProductGroup ID of the ancestor in hierarchy"
    )

    descendant_id: int = Field(
        foreign_key="t_d_product_group.id",
        primary_key=True,
        index=True,
        description="ProductGroup ID of the descendant in hierarchy"
    )

    # Depth in hierarchy
    depth: int = Field(
        nullable=False,
        index=True,
        ge=0,
        description="Depth in hierarchy: 0=self, 1=direct child, >1=deeper descendants"
    )

    def __repr__(self) -> str:
        """
        String representation showing the hierarchical path.

        Returns:
            Human-readable representation of the hierarchy relationship

        Examples:
            ProductGroupHierarchy(1 → 1, depth=0)  # Self-reference
            ProductGroupHierarchy(1 → 2, depth=1)  # Direct child
            ProductGroupHierarchy(1 → 3, depth=2)  # Grandchild
        """
        relationship = "self" if self.depth == 0 else f"depth={self.depth}"
        return f"ProductGroupHierarchy({self.ancestor_id} → {self.descendant_id}, {relationship})"

    def is_self_reference(self) -> bool:
        """
        Check if this entry represents a self-reference.

        Returns:
            True if ancestor_id == descendant_id (always depth=0)
        """
        return self.ancestor_id == self.descendant_id

    def is_direct_relationship(self) -> bool:
        """
        Check if this entry represents a direct parent-child relationship.

        Returns:
            True if depth == 1 (direct child)
        """
        return self.depth == 1

    def is_transitive_relationship(self) -> bool:
        """
        Check if this entry represents a transitive relationship (grandchild or deeper).

        Returns:
            True if depth > 1 (not self, not direct child)
        """
        return self.depth > 1


class Config:
    """SQLModel configuration."""

    schema_extra = {
        "example": {
            "ancestor_id": 1,
            "descendant_id": 3,
            "depth": 2
        }
    }
