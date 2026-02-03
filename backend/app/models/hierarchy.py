"""
Article Hierarchy Model - Closure Table Implementation

This module implements the Closure Table pattern for efficient hierarchical queries
on the article tree structure. It complements the adjacency list (parent_id) in the
Article model by storing ALL ancestor-descendant paths.

Pattern: Closure Table
Table: t_d_article_hierarchy
Maintenance: Automated via database triggers (see EPIC-001 TASK-005)
"""

from sqlmodel import Field, SQLModel


class ArticleHierarchy(SQLModel, table=True):
    """
    Closure Table for article hierarchy.

    Stores ALL paths in the article tree, enabling efficient hierarchical queries.
    This is a pure junction/association table that complements the adjacency list
    (parent_id) in the Article model.

    Table: t_d_article_hierarchy
    Pattern: Closure Table

    The table stores three types of relationships:
    1. Self-references: (article_id, article_id, 0)
       - Every article has a path to itself with depth 0
    2. Direct parent-child: (parent_id, child_id, 1)
       - Direct relationships from adjacency list
    3. All ancestor-descendant: (ancestor_id, descendant_id, depth)
       - Transitive closure of all paths in the tree

    Example hierarchy:
        Food (id=1)
        ├─ Groceries (id=2)
        │  ├─ Organic (id=3)
        │  └─ Regular (id=4)
        └─ Dining Out (id=5)
           └─ Restaurants (id=6)

    Closure table entries (24 rows total):
        # Self-references (depth=0)
        (1, 1, 0)  -- Food → Food
        (2, 2, 0)  -- Groceries → Groceries
        (3, 3, 0)  -- Organic → Organic
        (4, 4, 0)  -- Regular → Regular
        (5, 5, 0)  -- Dining Out → Dining Out
        (6, 6, 0)  -- Restaurants → Restaurants

        # Direct relationships (depth=1)
        (1, 2, 1)  -- Food → Groceries
        (1, 5, 1)  -- Food → Dining Out
        (2, 3, 1)  -- Groceries → Organic
        (2, 4, 1)  -- Groceries → Regular
        (5, 6, 1)  -- Dining Out → Restaurants

        # Transitive relationships (depth>1)
        (1, 3, 2)  -- Food → Organic (via Groceries)
        (1, 4, 2)  -- Food → Regular (via Groceries)
        (1, 6, 2)  -- Food → Restaurants (via Dining Out)

    Query Examples:
    ----------------

    1. Get all descendants of "Food" (id=1):
       SELECT descendant_id FROM t_d_article_hierarchy
       WHERE ancestor_id = 1 AND depth > 0
       Result: [2, 3, 4, 5, 6]

    2. Get direct children of "Food":
       SELECT descendant_id FROM t_d_article_hierarchy
       WHERE ancestor_id = 1 AND depth = 1
       Result: [2, 5]

    3. Get all ancestors of "Organic" (id=3):
       SELECT ancestor_id FROM t_d_article_hierarchy
       WHERE descendant_id = 3 AND depth > 0
       Result: [1, 2]

    4. Get subtree of "Food" up to depth 1:
       SELECT descendant_id FROM t_d_article_hierarchy
       WHERE ancestor_id = 1 AND depth <= 1
       Result: [1, 2, 5]

    5. Check if "Organic" is descendant of "Food":
       SELECT EXISTS (
         SELECT 1 FROM t_d_article_hierarchy
         WHERE ancestor_id = 1 AND descendant_id = 3
       )
       Result: true

    6. Get path length from "Food" to "Organic":
       SELECT depth FROM t_d_article_hierarchy
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
    - Maintained by triggers (EPIC-001 TASK-005)

    Performance:
    ------------
    - Indexed on (ancestor_id, descendant_id) [PRIMARY KEY]
    - Indexed on descendant_id for reverse lookups
    - Indexed on depth for level-based queries

    Note: This table is automatically maintained by database triggers.
          Direct manipulation is NOT recommended. Use Article.parent_id changes
          which will propagate through triggers.

    Attributes:
        ancestor_id: Article ID of the ancestor in the hierarchy path
        descendant_id: Article ID of the descendant in the hierarchy path
        depth: Distance between ancestor and descendant (0=self, 1=direct child, >1=deeper)

    Primary Key: (ancestor_id, descendant_id)
    Foreign Keys: ancestor_id → t_d_article.id, descendant_id → t_d_article.id
    """

    __tablename__ = "t_d_article_hierarchy"

    # Composite primary key (ancestor_id, descendant_id)
    ancestor_id: int = Field(
        foreign_key="t_d_article.id",
        primary_key=True,
        description="Article ID of the ancestor in hierarchy"
    )

    descendant_id: int = Field(
        foreign_key="t_d_article.id",
        primary_key=True,
        index=True,
        description="Article ID of the descendant in hierarchy"
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
            ArticleHierarchy(1 → 1, depth=0)  # Self-reference
            ArticleHierarchy(1 → 2, depth=1)  # Direct child
            ArticleHierarchy(1 → 3, depth=2)  # Grandchild
        """
        relationship = "self" if self.depth == 0 else f"depth={self.depth}"
        return f"ArticleHierarchy({self.ancestor_id} → {self.descendant_id}, {relationship})"

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
