"""
SQLModel models package.

This package contains all database models for the Family Budget application.
All models are defined using SQLModel (SQLAlchemy + Pydantic integration).

Models:
    User: User dimension with SCD Type 1 (current data only)
    Article: Budget category/article dimension with SCD Type 2 and hierarchy
    ArticleUsageStats: Pre-calculated category usage statistics (updated daily)
    FinancialCenter: Financial centers (bank accounts, wallets) with SCD Type 2
    CostCenter: Cost centers (projects, departments) with SCD Type 2
    BudgetFact: Budget transaction fact table
    BudgetFactHistory: Budget fact change history (SCD Type 2)
    ArticleHierarchy: Closure table for article hierarchy
    RefreshToken: Refresh token storage for JWT authentication
    TwoFactorSession: Temporary 2FA session tokens (5-min TTL, single-use)
    Notification: Budget alert notification history (supports broadcast)
    BankProvider: Supported banks reference table for multi-bank import
    ImportFileUpload: Import file upload metadata (multi-bank import)
    ImportColumnMapping: User column mappings per bank (SCD Type 1)
    ImportStaging: Temporary staging table for multi-bank CSV import
    UserConsent: GDPR consent records (append-only audit log)
    PushSubscription: Web Push subscription for notifications
    ScheduledReminder: Scheduled reminders for budget plans
    Store: Store dimension with SCD Type 1 (shopping locations, shared)
    StoreHistory: Store change history (SCD Type 2)
    ProductGroup: Product group dimension with SCD Type 1 and hierarchy (shared)
    ProductGroupHistory: Product group change history (SCD Type 2)
    ProductGroupHierarchy: Closure table for product group hierarchy
    ShoppingList: Shopping list header table (shared, owner delete only)
    ShoppingListItem: Shopping list items table (shared, offline sync support)
    ImportTemplate: User-specific CSV import templates (JSONB config)

Design Patterns:
    - SCD Type 2: Slowly Changing Dimension Type 2 for tracking historical changes
    - SCD Type 1: In-place updates for User, column mappings
    - Closure Table: For efficient hierarchical queries on articles
    - Star Schema: BudgetFact as central fact table with dimension references
    - Append-only: UserConsent for immutable audit trail

Usage:
    from backend.app.models import (
        User, Article, ArticleUsageStats, FinancialCenter, CostCenter,
        BudgetFact, BudgetFactHistory, ArticleHierarchy, RefreshToken,
        TwoFactorSession, Notification, BankProvider, ImportFileUpload,
        ImportColumnMapping, ImportStaging, UserConsent
    )
"""

from backend.app.models.article import Article, ArticleUsageStats
from backend.app.models.article_financial_center import ArticleFinancialCenter
from backend.app.models.bank_provider import BankProvider
from backend.app.models.budget_fact_history import BudgetFactHistory
from backend.app.models.cost_center import CostCenter
from backend.app.models.cost_center_financial_center import CostCenterFinancialCenter
from backend.app.models.fact import BudgetFact
from backend.app.models.financial_center import FinancialCenter
from backend.app.models.financial_center_balance_monthly import FinancialCenterBalanceMonthly
from backend.app.models.hierarchy import ArticleHierarchy
from backend.app.models.import_column_mapping import ImportColumnMapping
from backend.app.models.import_file_upload import ImportFileUpload
from backend.app.models.import_staging import ImportStaging
from backend.app.models.import_template import ImportTemplate
from backend.app.models.notification import Notification
from backend.app.models.product_group import ProductGroup
from backend.app.models.product_group_hierarchy import ProductGroupHierarchy
from backend.app.models.product_group_history import ProductGroupHistory
from backend.app.models.push_subscription import PushSubscription
from backend.app.models.recurring_plan import RecurringPlan
from backend.app.models.refresh_token import RefreshToken
from backend.app.models.scheduled_reminder import ScheduledReminder
from backend.app.models.shopping_list import ShoppingList
from backend.app.models.shopping_list_item import ShoppingListItem
from backend.app.models.store import Store
from backend.app.models.store_history import StoreHistory
from backend.app.models.two_factor_session import TwoFactorSession
from backend.app.models.user import User
from backend.app.models.user_consent import UserConsent

__all__ = [
    "User",
    "Article",
    "ArticleFinancialCenter",
    "CostCenterFinancialCenter",
    "ArticleUsageStats",
    "FinancialCenter",
    "FinancialCenterBalanceMonthly",
    "CostCenter",
    "BudgetFact",
    "BudgetFactHistory",
    "ArticleHierarchy",
    "RefreshToken",
    "TwoFactorSession",
    "Notification",
    "BankProvider",
    "ImportFileUpload",
    "ImportColumnMapping",
    "ImportStaging",
    "ImportTemplate",
    "UserConsent",
    "PushSubscription",
    "RecurringPlan",
    "ScheduledReminder",
    "Store",
    "StoreHistory",
    "ProductGroup",
    "ProductGroupHistory",
    "ProductGroupHierarchy",
    "ShoppingList",
    "ShoppingListItem",
]
