"""
Pydantic schemas package.

This package contains all Pydantic schemas for request/response validation.
Schemas are organized by domain (auth, users, articles, facts, financial centers, cost centers).

Schemas:
    Auth: TelegramAuthData, UserResponse, AuthResponse
    Users: UserUpdate, UserDetailResponse, UserListResponse
    Articles: ArticleCreate, ArticleUpdate, ArticleResponse, ArticleListResponse
    FinancialCenters: FinancialCenterCreate, FinancialCenterUpdate, FinancialCenterResponse, FinancialCenterListResponse
    CostCenters: CostCenterCreate, CostCenterUpdate, CostCenterResponse, CostCenterListResponse
    Facts: FactCreate, FactUpdate, FactResponse, FactListResponse, FactSummary
    Errors: ErrorResponse, ValidationErrorResponse, get_common_responses
"""

from backend.app.schemas.auth import AuthResponse, TelegramAuthData, UserResponse
from backend.app.schemas.article import (
    ArticleCreate,
    ArticleHierarchyInfo,
    ArticleListResponse,
    ArticleResponse,
    ArticleUpdate,
)
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
    # Error schemas
    "ErrorResponse",
    "ValidationErrorResponse",
    "get_common_responses",
]
