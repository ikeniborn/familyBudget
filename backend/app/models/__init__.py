"""
SQLModel models package.

This package contains all database models for the Family Budget application.
All models are defined using SQLModel (SQLAlchemy + Pydantic integration).

Models:
    User: User dimension with SCD Type 2
    Article: Budget category/article dimension with SCD Type 2 and hierarchy
    BudgetFact: Budget transaction fact table
    ArticleHierarchy: Closure table for article hierarchy

Design Patterns:
    - SCD Type 2: Slowly Changing Dimension Type 2 for tracking historical changes
    - Closure Table: For efficient hierarchical queries on articles
    - Star Schema: BudgetFact as central fact table with dimension references

Usage:
    from backend.app.models import User, Article, BudgetFact, ArticleHierarchy
"""

from backend.app.models.article import Article
from backend.app.models.fact import BudgetFact
from backend.app.models.hierarchy import ArticleHierarchy
from backend.app.models.user import User

__all__ = [
    "User",
    "Article",
    "BudgetFact",
    "ArticleHierarchy",
]
