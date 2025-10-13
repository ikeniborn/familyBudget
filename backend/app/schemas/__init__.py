"""
Pydantic schemas package.

This package contains all Pydantic schemas for request/response validation.
Schemas are organized by domain (auth, users, articles, facts).

Schemas:
    Auth: TelegramAuthData, UserResponse, AuthResponse
    Articles: ArticleCreate, ArticleUpdate, ArticleResponse, ArticleListResponse
"""

from backend.app.schemas.auth import AuthResponse, TelegramAuthData, UserResponse
from backend.app.schemas.article import (
    ArticleCreate,
    ArticleHierarchyInfo,
    ArticleListResponse,
    ArticleResponse,
    ArticleUpdate,
)

__all__ = [
    # Auth schemas
    "TelegramAuthData",
    "UserResponse",
    "AuthResponse",
    # Article schemas
    "ArticleCreate",
    "ArticleUpdate",
    "ArticleResponse",
    "ArticleHierarchyInfo",
    "ArticleListResponse",
]
