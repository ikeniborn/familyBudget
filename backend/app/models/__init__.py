"""
SQLModel models package.

This package contains all database models for the Family Budget application.
All models are defined using SQLModel (SQLAlchemy + Pydantic integration).

Models:
    User: User dimension with SCD Type 2
    Article: Budget category/article dimension with SCD Type 2 and hierarchy
    FinancialCenter: Financial centers (bank accounts, wallets) with SCD Type 2
    CostCenter: Cost centers (projects, departments) with SCD Type 2
    BudgetFact: Budget transaction fact table
    ArticleHierarchy: Closure table for article hierarchy
    RefreshToken: Refresh token storage for JWT authentication

Design Patterns:
    - SCD Type 2: Slowly Changing Dimension Type 2 for tracking historical changes
    - Closure Table: For efficient hierarchical queries on articles
    - Star Schema: BudgetFact as central fact table with dimension references

Usage:
    from backend.app.models import (
        User, Article, FinancialCenter, CostCenter,
        BudgetFact, ArticleHierarchy, RefreshToken
    )
"""

from backend.app.models.article import Article
from backend.app.models.cost_center import CostCenter
from backend.app.models.fact import BudgetFact
from backend.app.models.financial_center import FinancialCenter
from backend.app.models.hierarchy import ArticleHierarchy
from backend.app.models.refresh_token import RefreshToken
from backend.app.models.user import User

__all__ = [
    "User",
    "Article",
    "FinancialCenter",
    "CostCenter",
    "BudgetFact",
    "ArticleHierarchy",
    "RefreshToken",
]
