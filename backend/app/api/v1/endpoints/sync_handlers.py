"""
PGlite Sync Handlers

Handles initial sync requests from frontend PGlite integration.
Sends reference data (articles, financial centers, cost centers, hierarchy).
Also handles incremental sync for budget facts (delta updates).
"""

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models import (
    Article,
    FinancialCenter,
    CostCenter,
    ArticleHierarchy,
    BudgetFact,
    BudgetFactHistory,
)

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


async def _fetch_facts_created_after(
    session: AsyncSession, user_id: int, timestamp: datetime
) -> list[BudgetFact]:
    """
    Fetch facts created after given timestamp.

    Args:
        session: Database session
        user_id: User ID filter
        timestamp: Last sync timestamp

    Returns:
        List of newly created BudgetFact records
    """
    result = await session.execute(
        select(BudgetFact)
        .where(
            and_(
                BudgetFact.user_id == user_id,
                BudgetFact.created_at > timestamp,
            )
        )
        .order_by(BudgetFact.created_at)
    )
    return list(result.scalars().all())


async def _fetch_facts_updated_after(
    session: AsyncSession, user_id: int, timestamp: datetime
) -> list[BudgetFact]:
    """
    Fetch facts updated after given timestamp (but created before).

    Args:
        session: Database session
        user_id: User ID filter
        timestamp: Last sync timestamp

    Returns:
        List of updated BudgetFact records
    """
    result = await session.execute(
        select(BudgetFact)
        .where(
            and_(
                BudgetFact.user_id == user_id,
                BudgetFact.updated_at > timestamp,
                BudgetFact.created_at <= timestamp,
            )
        )
        .order_by(BudgetFact.updated_at)
    )
    return list(result.scalars().all())


async def _fetch_facts_deleted_after(
    session: AsyncSession, user_id: int, timestamp: datetime
) -> list[int]:
    """
    Fetch fact IDs deleted after given timestamp using history table.

    Queries t_f_budget_fact_history for DELETE change_type records
    with valid_from > timestamp.

    Args:
        session: Database session
        user_id: User ID filter
        timestamp: Last sync timestamp

    Returns:
        List of deleted fact IDs
    """
    result = await session.execute(
        select(BudgetFactHistory.fact_id)
        .where(
            and_(
                BudgetFactHistory.user_id == user_id,
                BudgetFactHistory.change_type == "DELETE",
                BudgetFactHistory.valid_from > timestamp,
            )
        )
        .order_by(BudgetFactHistory.valid_from)
    )
    return list(result.scalars().all())


async def handle_sync_incremental_request(
    session: AsyncSession, user_id: int, last_sync_timestamp: datetime
) -> dict[str, Any]:
    """
    Handle incremental sync request - send delta updates since last sync.

    Queries three types of changes:
    1. Created facts (created_at > timestamp)
    2. Updated facts (updated_at > timestamp AND created_at <= timestamp)
    3. Deleted facts (from history table where change_type='DELETE' AND valid_from > timestamp)

    Args:
        session: Database session
        user_id: User ID requesting sync
        last_sync_timestamp: Timestamp of last successful sync

    Returns:
        dict: Delta updates with created, updated, deleted fact IDs
    """
    logger.info(
        f"[SYNC] Handling incremental sync for user {user_id} "
        f"since {last_sync_timestamp.isoformat()}"
    )

    # Query delta changes in parallel
    created_facts = await _fetch_facts_created_after(session, user_id, last_sync_timestamp)
    updated_facts = await _fetch_facts_updated_after(session, user_id, last_sync_timestamp)
    deleted_fact_ids = await _fetch_facts_deleted_after(session, user_id, last_sync_timestamp)

    # Format created facts (map to LocalBudgetFact structure)
    created_data = [
        {
            "id": fact.id,
            "user_id": fact.user_id,
            "article_id": fact.article_id,
            "financial_center_id": fact.financial_center_id,
            "cost_center_id": fact.cost_center_id,
            "date": fact.fact_date.isoformat(),  # fact_date → date
            "amount": float(fact.amount),
            "comment": fact.description,  # description → comment
            "record_type": fact.record_type,
            "transfer_group_id": str(fact.transfer_id) if fact.transfer_id else None,  # transfer_id → transfer_group_id
            "is_transfer": fact.transfer_id is not None,  # added
            "recurring_plan_id": fact.recurring_plan_id,
            "is_offline_sync": fact.is_offline_sync,
            "content_hash": fact.content_hash,
            "sync_hash": fact.sync_hash,
            "created_at": fact.created_at.isoformat(),
            "updated_at": fact.updated_at.isoformat(),
        }
        for fact in created_facts
    ]

    # Format updated facts (map to LocalBudgetFact structure)
    updated_data = [
        {
            "id": fact.id,
            "user_id": fact.user_id,
            "article_id": fact.article_id,
            "financial_center_id": fact.financial_center_id,
            "cost_center_id": fact.cost_center_id,
            "date": fact.fact_date.isoformat(),  # fact_date → date
            "amount": float(fact.amount),
            "comment": fact.description,  # description → comment
            "record_type": fact.record_type,
            "transfer_group_id": str(fact.transfer_id) if fact.transfer_id else None,  # transfer_id → transfer_group_id
            "is_transfer": fact.transfer_id is not None,  # added
            "recurring_plan_id": fact.recurring_plan_id,
            "is_offline_sync": fact.is_offline_sync,
            "content_hash": fact.content_hash,
            "sync_hash": fact.sync_hash,
            "created_at": fact.created_at.isoformat(),
            "updated_at": fact.updated_at.isoformat(),
        }
        for fact in updated_facts
    ]

    # Prepare response
    response_data = {
        "created": created_data,
        "updated": updated_data,
        "deleted": deleted_fact_ids,
        "sync_timestamp": datetime.now(timezone.utc).isoformat(),
    }

    logger.info(
        f"[SYNC] Incremental sync prepared: "
        f"created={len(created_data)}, updated={len(updated_data)}, "
        f"deleted={len(deleted_fact_ids)}"
    )

    return response_data
