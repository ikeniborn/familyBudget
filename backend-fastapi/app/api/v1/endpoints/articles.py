"""
Article management endpoints.
"""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request, Body
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError

from app.db.database import get_db
from app.models.article import Article
from app.schemas.article import (
    ArticleCreate,
    ArticleUpdate,
    ArticlePublic,
    ArticleStats
)
from app.api.deps import get_current_user
from app.core.security import require_admin_access
from app.core.response import (
    success_response,
    error_response,
    error_not_found,
    error_bad_request,
    error_conflict
)

router = APIRouter()


@router.get("/", response_model=List[ArticlePublic])
async def get_articles(
    request: Request,
    skip: int = 0,
    limit: int = 100,
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get all articles for current user with optional filtering."""
    user_id = current_user.get('user_id')

    # Show only user's own articles
    stmt = (
        select(Article)
        .where(Article.user_id == user_id)
        .offset(skip)
        .limit(limit)
        .order_by(Article.name.asc())
    )

    if is_active is not None:
        stmt = stmt.where(Article.is_active == is_active)

    result = await db.execute(stmt)
    articles = result.scalars().all()

    articles_data = []
    for article in articles:
        article_dict = {
            'id': article.id,
            'code': article.code,
            'name': article.name,
            'description': article.description,
            'is_active': article.is_active,
            'user_id': article.user_id,
            'created_by': getattr(article, 'created_by', None),
            'managed_by': getattr(article, 'managed_by', None),
            'created_at': getattr(article, 'created_at', None),
            'updated_at': getattr(article, 'updated_at', None),
            'is_shared': False,
            'is_editable': True
        }
        articles_data.append(article_dict)

    return success_response(data=articles_data, total=len(articles_data))


@router.get("/stats")
async def get_articles_stats(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get articles statistics for current user."""
    user_id = current_user.get('user_id')

    # Count all articles for current user
    total_stmt = select(func.count(Article.id)).where(Article.user_id == user_id)

    # Count active articles
    active_stmt = select(func.count(Article.id)).where(
        (Article.user_id == user_id) & (Article.is_active == True)
    )

    # Count inactive articles
    inactive_stmt = select(func.count(Article.id)).where(
        (Article.user_id == user_id) & (Article.is_active == False)
    )

    total_result = await db.execute(total_stmt)
    active_result = await db.execute(active_stmt)
    inactive_result = await db.execute(inactive_stmt)

    # Store scalar values to avoid ResourceClosedError
    total_count = total_result.scalar() or 0
    active_count = active_result.scalar() or 0
    inactive_count = inactive_result.scalar() or 0

    stats = ArticleStats(
        total=total_count,
        active=active_count,
        inactive=inactive_count,
        shared=0,  # No shared articles in simplified model
        user_specific=total_count
    )

    return success_response(data=stats.dict())


@router.get("/{article_id}", response_model=ArticlePublic)
async def get_article(
    article_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get article by ID for current user."""
    user_id = current_user.get('user_id')

    # Show article if it belongs to current user
    stmt = select(Article).where(
        Article.id == article_id,
        Article.user_id == user_id
    )
    result = await db.execute(stmt)
    article = result.scalar_one_or_none()

    if not article:
        return error_not_found("Article not found")

    article_dict = {
        'id': article.id,
        'code': article.code,
        'name': article.name,
        'description': article.description,
        'is_active': article.is_active,
        'user_id': article.user_id,
        'created_by': getattr(article, 'created_by', None),
        'managed_by': getattr(article, 'managed_by', None),
        'created_at': getattr(article, 'created_at', None),
        'updated_at': getattr(article, 'updated_at', None),
        'is_shared': False,
        'is_editable': True
    }

    return success_response(data=article_dict)


@router.post("/", response_model=ArticlePublic)
async def create_article(
    article_data: ArticleCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create a new article for current user."""
    user_id = current_user.get('user_id')

    try:
        article = Article(
            code=article_data.code,
            name=article_data.name,
            description=article_data.description,
            is_active=article_data.is_active,
            user_id=user_id,
            created_by=user_id,
            managed_by=article_data.managed_by or user_id
        )

        db.add(article)
        await db.commit()
        await db.refresh(article)

        article_dict = {
            'id': article.id,
            'code': article.code,
            'name': article.name,
            'description': article.description,
            'is_active': article.is_active,
            'user_id': article.user_id,
            'created_by': article.created_by,
            'managed_by': article.managed_by,
            'created_at': article.created_at,
            'updated_at': article.updated_at,
            'is_shared': False,
            'is_editable': True
        }

        return success_response(data=article_dict)

    except IntegrityError as e:
        await db.rollback()
        if "uq_t_d_article_article_code" in str(e.orig) or "article_code" in str(e.orig):
            return error_conflict(f"Article with code '{article_data.code}' already exists")
        return error_bad_request("Failed to create article due to database constraint")
    except Exception as e:
        await db.rollback()
        return error_bad_request(f"Failed to create article: {str(e)}")


@router.put("/{article_id}", response_model=ArticlePublic)
async def update_article(
    article_id: int,
    article_data: ArticleUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update an existing article for current user."""
    user_id = current_user.get('user_id')

    # Find article for current user
    stmt = select(Article).where(
        Article.id == article_id,
        Article.user_id == user_id
    )
    result = await db.execute(stmt)
    article = result.scalar_one_or_none()

    if not article:
        return error_not_found("Article not found")

    try:
        # Update only provided fields
        update_data = article_data.dict(exclude_unset=True)

        for field, value in update_data.items():
            if hasattr(article, field):
                setattr(article, field, value)

        # Always update managed_by to current user if not specified
        if 'managed_by' not in update_data:
            article.managed_by = user_id

        await db.commit()
        await db.refresh(article)

        article_dict = {
            'id': article.id,
            'code': article.code,
            'name': article.name,
            'description': article.description,
            'is_active': article.is_active,
            'user_id': article.user_id,
            'created_by': article.created_by,
            'managed_by': article.managed_by,
            'created_at': article.created_at,
            'updated_at': article.updated_at,
            'is_shared': False,
            'is_editable': True
        }

        return success_response(data=article_dict)

    except IntegrityError as e:
        await db.rollback()
        if "uq_t_d_article_article_code" in str(e.orig) or "article_code" in str(e.orig):
            return error_conflict(f"Article with code '{article_data.code}' already exists")
        return error_bad_request("Failed to update article due to database constraint")
    except Exception as e:
        await db.rollback()
        return error_bad_request(f"Failed to update article: {str(e)}")


@router.delete("/{article_id}")
async def delete_article(
    article_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete an article for current user."""
    user_id = current_user.get('user_id')

    # Find article for current user
    stmt = select(Article).where(
        Article.id == article_id,
        Article.user_id == user_id
    )
    result = await db.execute(stmt)
    article = result.scalar_one_or_none()

    if not article:
        return error_not_found("Article not found")

    try:
        await db.delete(article)
        await db.commit()
        return success_response(data={"message": "Article deleted successfully"})
    except Exception as e:
        await db.rollback()
        return error_bad_request(f"Failed to delete article: {str(e)}")


@router.post("/bulk-delete")
async def bulk_delete_articles(
    article_ids: List[int] = Body(..., embed=True),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Bulk delete articles for current user."""
    user_id = current_user.get('user_id')

    if not article_ids:
        return error_bad_request("No article IDs provided")

    try:
        # Find all articles to delete for current user
        stmt = select(Article).where(
            Article.id.in_(article_ids),
            Article.user_id == user_id
        )
        result = await db.execute(stmt)
        articles = result.scalars().all()

        if not articles:
            return error_not_found("No articles found")

        # Delete all articles
        for article in articles:
            await db.delete(article)

        await db.commit()

        return success_response(data={
            "message": f"Successfully deleted {len(articles)} articles",
            "deleted_count": len(articles)
        })

    except Exception as e:
        await db.rollback()
        return error_bad_request(f"Failed to delete articles: {str(e)}")