"""
Pydantic schemas package.

This package contains all Pydantic schemas for request/response validation.
Schemas are organized by domain (auth, users, articles, facts).

Schemas:
    Auth: TelegramAuthData, UserResponse, AuthResponse
    Users: UserUpdate, UserDetailResponse, UserListResponse
    Articles: ArticleCreate, ArticleUpdate, ArticleResponse, ArticleListResponse
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
