"""
Pydantic schemas package.

This package contains all Pydantic schemas for request/response validation.
Schemas are organized by domain (auth, users, articles, facts, financial centers, cost centers).

Schemas:
    Auth: TelegramAuthData, UserResponse, AuthResponse
    Users: UserUpdate, UserDetailResponse, UserListResponse
    Admin: SystemStatsResponse, UserStatsResponse
    Articles: ArticleCreate, ArticleUpdate, ArticleResponse, ArticleListResponse
    FinancialCenters: FinancialCenterCreate, FinancialCenterUpdate, FinancialCenterResponse, FinancialCenterListResponse
    CostCenters: CostCenterCreate, CostCenterUpdate, CostCenterResponse, CostCenterListResponse
    Facts: FactCreate, FactUpdate, FactResponse, FactListResponse, FactSummary
    Notifications: NotificationCreate, NotificationRead, NotificationList
    Import: ImportUploadResponse, ImportStagingResponse, ImportStagingListResponse, ImportStagingUpdate, ImportStagingBulkUpdate, ImportExecuteResponse, ImportCleanupResponse
    Errors: ErrorResponse, ValidationErrorResponse, get_common_responses
"""

from backend.app.schemas.admin import SystemStatsResponse, UserStatsResponse
from backend.app.schemas.article import (
    ArticleCreate,
    ArticleHierarchyInfo,
    ArticleListResponse,
    ArticleResponse,
    ArticleUpdate,
)
from backend.app.schemas.auth import AuthResponse, TelegramAuthData, UserResponse
from backend.app.schemas.cost_center import (
    CostCenterCreate,
    CostCenterListResponse,
    CostCenterResponse,
    CostCenterUpdate,
)
from backend.app.schemas.errors import (
    ErrorResponse,
    ValidationErrorResponse,
    get_common_responses,
)
from backend.app.schemas.fact import (
    FactCreate,
    FactListResponse,
    FactResponse,
    FactSummary,
    FactUpdate,
)
from backend.app.schemas.financial_center import (
    FinancialCenterCreate,
    FinancialCenterListResponse,
    FinancialCenterResponse,
    FinancialCenterUpdate,
)
from backend.app.schemas.import_schema import (
    ImportCleanupResponse,
    ImportExecuteResponse,
    ImportStagingBulkUpdate,
    ImportStagingBulkUpdateResponse,
    ImportStagingListResponse,
    ImportStagingResponse,
    ImportStagingUpdate,
    ImportUploadResponse,
)
from backend.app.schemas.notification import (
    NotificationCreate,
    NotificationList,
    NotificationRead,
)
from backend.app.schemas.recurring_plan import (
    RecurringPlanCreate,
    RecurringPlanListResponse,
    RecurringPlanResponse,
    RecurringPlanStats,
    RecurringPlanUpdate,
)
from backend.app.schemas.scheduled_reminder import (
    ReminderCreate,
    ReminderListResponse,
    ReminderResponse,
    ReminderUpdate,
    ReminderWithPlanInfo,
)
from backend.app.schemas.user import (
    UserDetailResponse,
    UserListResponse,
    UserUpdate,
)

__all__ = [
    # Auth schemas
    "TelegramAuthData",
    "UserResponse",
    "AuthResponse",
    # User schemas
    "UserUpdate",
    "UserDetailResponse",
    "UserListResponse",
    # Admin schemas
    "SystemStatsResponse",
    "UserStatsResponse",
    # Article schemas
    "ArticleCreate",
    "ArticleUpdate",
    "ArticleResponse",
    "ArticleHierarchyInfo",
    "ArticleListResponse",
    # Financial Center schemas
    "FinancialCenterCreate",
    "FinancialCenterUpdate",
    "FinancialCenterResponse",
    "FinancialCenterListResponse",
    # Cost Center schemas
    "CostCenterCreate",
    "CostCenterUpdate",
    "CostCenterResponse",
    "CostCenterListResponse",
    # Fact schemas
    "FactCreate",
    "FactUpdate",
    "FactResponse",
    "FactListResponse",
    "FactSummary",
    # Notification schemas
    "NotificationCreate",
    "NotificationRead",
    "NotificationList",
    # Reminder schemas
    "ReminderCreate",
    "ReminderUpdate",
    "ReminderResponse",
    "ReminderWithPlanInfo",
    "ReminderListResponse",
    # Recurring Plan schemas
    "RecurringPlanCreate",
    "RecurringPlanUpdate",
    "RecurringPlanResponse",
    "RecurringPlanListResponse",
    "RecurringPlanStats",
    # Import schemas
    "ImportUploadResponse",
    "ImportStagingResponse",
    "ImportStagingListResponse",
    "ImportStagingUpdate",
    "ImportStagingBulkUpdate",
    "ImportStagingBulkUpdateResponse",
    "ImportExecuteResponse",
    "ImportCleanupResponse",
    # Error schemas
    "ErrorResponse",
    "ValidationErrorResponse",
    "get_common_responses",
]
