"""
PGlite Sync Handlers

Handles initial sync requests from frontend PGlite integration.
Sends reference data (articles, financial centers, cost centers, hierarchy).
"""

import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models import Article, FinancialCenter, CostCenter, ArticleHierarchy

logger = logging.getLogger(__name__)


async def handle_sync_initial(session: AsyncSession, user_id: int) -> dict[str, Any]:
    """
    Handle sync_initial request - send all reference data to client.

    Args:
        session: Database session
        user_id: User ID requesting sync

    Returns:
        dict: Sync response with articles, financial_centers, cost_centers, hierarchy
    """
    logger.info(f"[SYNC] Handling initial sync for user {user_id}")

    # Query articles
    articles_result = await session.execute(
        select(Article).where(Article.user_id == user_id)
    )
    articles = articles_result.scalars().all()

    # Query financial centers
    fc_result = await session.execute(
        select(FinancialCenter).where(FinancialCenter.user_id == user_id)
    )
    financial_centers = fc_result.scalars().all()

    # Query cost centers
    cc_result = await session.execute(
        select(CostCenter).where(CostCenter.user_id == user_id)
    )
    cost_centers = cc_result.scalars().all()

    # Query article hierarchy (all entries for user's articles)
    article_ids = [a.id for a in articles]
    if article_ids:
        from sqlalchemy import and_
        hierarchy_result = await session.execute(
            select(ArticleHierarchy).where(
                and_(
                    ArticleHierarchy.ancestor_id.in_(article_ids),
                    ArticleHierarchy.descendant_id.in_(article_ids)
                )
            )
        )
        hierarchy = hierarchy_result.scalars().all()
    else:
        hierarchy = []

    # Format response
    response_data = {
        "articles": [
            {
                "id": a.id,
                "user_id": a.user_id,
                "parent_id": a.parent_id,
                "name": a.name,
                "type": a.type,
                "is_active": a.is_active,
                "created_at": a.created_at.isoformat() if a.created_at else None,
                "updated_at": a.updated_at.isoformat() if a.updated_at else None,
            }
            for a in articles
        ],
        "financial_centers": [
            {
                "id": fc.id,
                "user_id": fc.user_id,
                "name": fc.name,
                "type": fc.type,
                "currency": fc.currency,
                "is_active": fc.is_active,
                "created_at": fc.created_at.isoformat() if fc.created_at else None,
            }
            for fc in financial_centers
        ],
        "cost_centers": [
            {
                "id": cc.id,
                "user_id": cc.user_id,
                "name": cc.name,
                "is_active": cc.is_active,
                "created_at": cc.created_at.isoformat() if cc.created_at else None,
            }
            for cc in cost_centers
        ],
        "hierarchy": [
            {
                "ancestor_id": h.ancestor_id,
                "descendant_id": h.descendant_id,
                "depth": h.depth,
            }
            for h in hierarchy
        ],
        "total_records": len(articles) + len(financial_centers) + len(cost_centers) + len(hierarchy),
    }

    logger.info(
        f"[SYNC] Initial sync prepared: articles={len(articles)}, "
        f"financial_centers={len(financial_centers)}, cost_centers={len(cost_centers)}, "
        f"hierarchy={len(hierarchy)}, total={response_data['total_records']}"
    )

    return response_data
