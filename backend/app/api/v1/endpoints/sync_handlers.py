"""
Offline Database Sync Handlers

Handles initial sync requests from frontend offline database (Dexie.js).
Sends reference data (articles, financial centers, cost centers, hierarchy).
Also handles incremental sync for budget facts (delta updates).
"""

import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models import (
    Article,
    ArticleHierarchy,
    BudgetFact,
    BudgetFactHistory,
    CostCenter,
    FinancialCenter,
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


# ============================================================================
# Helper functions for client upload operations (Task-008 refactoring)
# ============================================================================


async def _handle_create_fact(
    session: AsyncSession,
    user_id: int,
    temp_id: str,
    payload: dict,
    content_hash: str
) -> tuple[int | None, str | None]:
    """
    Handle create fact operation with deduplication.

    Args:
        session: Database session
        user_id: User ID from JWT
        temp_id: Client-generated temp_id
        payload: Fact data
        content_hash: SHA-256 hash for deduplication

    Returns:
        Tuple of (server_id, error_message)
        - (fact_id, None) on success
        - (None, error_string) on failure
    """
    # Check deduplication (content_hash exists?)
    existing_stmt = select(BudgetFact).where(
        BudgetFact.content_hash == content_hash
    )
    existing_result = await session.execute(existing_stmt)
    existing_fact = existing_result.scalar_one_or_none()

    if existing_fact:
        logger.info(
            f"[SYNC] Duplicate fact detected (content_hash={content_hash}), "
            f"returning existing ID {existing_fact.id}"
        )
        return (existing_fact.id, None)

    # Create new fact
    fact = BudgetFact(
        user_id=user_id,
        article_id=payload["article_id"],
        financial_center_id=payload.get("financial_center_id"),
        cost_center_id=payload.get("cost_center_id"),
        fact_date=datetime.fromisoformat(payload["date"]),
        amount=Decimal(str(payload["amount"])),
        description=payload.get("comment"),
        record_type=payload.get("record_type", "fact"),
        transfer_id=payload.get("transfer_group_id"),
        is_offline_sync=True,  # Mark as offline-created
        content_hash=content_hash,
        sync_hash=payload.get("sync_hash"),
    )

    session.add(fact)
    await session.flush()  # Get server_id
    await session.refresh(fact)

    logger.info(f"[SYNC] Created fact {fact.id} from temp_id {temp_id}")
    return (fact.id, None)


async def _handle_update_fact(
    session: AsyncSession,
    user_id: int,
    temp_id: str,
    payload: dict
) -> tuple[int | None, str | None]:
    """
    Handle update fact operation with partial updates.

    Args:
        session: Database session
        user_id: User ID from JWT
        temp_id: Client-generated temp_id
        payload: Update data (must include 'id')

    Returns:
        Tuple of (server_id, error_message)
        - (fact_id, None) on success
        - (None, error_string) on failure
    """
    fact_id = payload.get("id")
    if not fact_id:
        return (None, "Missing fact ID for update operation")

    stmt = select(BudgetFact).where(BudgetFact.id == fact_id)
    result_query = await session.execute(stmt)
    fact = result_query.scalar_one_or_none()

    if not fact:
        return (None, f"Fact {fact_id} not found")

    # Update fields (partial update)
    if "amount" in payload:
        fact.amount = Decimal(str(payload["amount"]))
    if "comment" in payload:
        fact.description = payload["comment"]
    if "date" in payload:
        fact.fact_date = datetime.fromisoformat(payload["date"])
    if "article_id" in payload:
        fact.article_id = payload["article_id"]
    if "financial_center_id" in payload:
        fact.financial_center_id = payload["financial_center_id"]
    if "cost_center_id" in payload:
        fact.cost_center_id = payload["cost_center_id"]

    fact.updated_at = datetime.now(timezone.utc)

    logger.info(f"[SYNC] Updated fact {fact.id} from temp_id {temp_id}")
    return (fact.id, None)


async def _handle_delete_fact(
    session: AsyncSession,
    user_id: int,
    temp_id: str,
    payload: dict
) -> tuple[int | None, str | None]:
    """
    Handle delete fact operation with history tracking.

    Args:
        session: Database session
        user_id: User ID from JWT
        temp_id: Client-generated temp_id
        payload: Delete data (must include 'id')

    Returns:
        Tuple of (server_id, error_message)
        - (fact_id, None) on success
        - (None, error_string) on failure
    """
    fact_id = payload.get("id")
    if not fact_id:
        return (None, "Missing fact ID for delete operation")

    stmt = select(BudgetFact).where(BudgetFact.id == fact_id)
    result_query = await session.execute(stmt)
    fact = result_query.scalar_one_or_none()

    if not fact:
        # Fact not found - may already be deleted, treat as success
        logger.warning(f"[SYNC] Fact {fact_id} not found for deletion (may be already deleted)")
        return (fact_id, None)

    # Create history record before delete
    delete_history = BudgetFactHistory(
        fact_id=fact.id,
        user_id=fact.user_id,
        article_id=fact.article_id,
        financial_center_id=fact.financial_center_id,
        cost_center_id=fact.cost_center_id,
        fact_date=fact.fact_date,
        amount=fact.amount,
        description=fact.description,
        record_type=fact.record_type,
        transfer_id=fact.transfer_id,
        change_type="DELETE",
        valid_from=datetime.now(timezone.utc),
        valid_to=datetime(9999, 12, 31),
        is_current=False,
        changed_by_user_id=user_id,
    )
    session.add(delete_history)

    await session.delete(fact)

    logger.info(f"[SYNC] Deleted fact {fact_id} from temp_id {temp_id}")
    return (fact_id, None)


async def handle_sync_client_changes(
    session: AsyncSession,
    user_id: int,
    operations: list[dict],
) -> dict[str, Any]:
    """
    Process client upload operations (create/update/delete)

    Task-008: Client upload changes

    Args:
        session: Database session
        user_id: User ID from JWT
        operations: List of pending operations from client
            Format: [
                {
                    "temp_id": "uuid-v4",
                    "operation": "create|update|delete",
                    "entity_type": "fact",
                    "payload": {...},
                    "content_hash": "sha256-hash"
                }
            ]

    Returns:
        {
            "results": [
                {"temp_id": "...", "server_id": 123, "status": "success"},
                {"temp_id": "...", "status": "error", "error": "..."}
            ],
            "total_processed": 10,
            "success_count": 9,
            "error_count": 1
        }
    """
    results = []
    success_count = 0
    error_count = 0

    logger.info(f"[SYNC] Processing {len(operations)} client operations for user {user_id}")

    for op in operations:
        temp_id = op.get("temp_id")
        operation = op.get("operation")
        entity_type = op.get("entity_type")
        payload = op.get("payload", {})
        content_hash = op.get("content_hash")

        try:
            # Validate required fields
            if not temp_id:
                raise ValueError("Missing temp_id in operation")

            server_id = None
            error = None

            # Dispatch to appropriate handler
            if operation == "create" and entity_type == "fact":
                if not content_hash:
                    raise ValueError("Missing content_hash for create operation")
                server_id, error = await _handle_create_fact(
                    session, user_id, temp_id, payload, content_hash
                )
            elif operation == "update" and entity_type == "fact":
                server_id, error = await _handle_update_fact(
                    session, user_id, temp_id, payload
                )
            elif operation == "delete" and entity_type == "fact":
                server_id, error = await _handle_delete_fact(
                    session, user_id, temp_id, payload
                )
            else:
                error = f"Unsupported operation: {operation} for {entity_type}"

            # Collect result
            if error:
                raise ValueError(error)

            results.append({
                "temp_id": temp_id,
                "server_id": server_id,
                "status": "success"
            })
            success_count += 1

        except Exception as e:
            logger.error(f"[SYNC] Failed to process operation {temp_id}: {e}")
            results.append({
                "temp_id": temp_id,
                "server_id": None,
                "status": "error",
                "error": str(e)
            })
            error_count += 1

    # Commit all changes
    try:
        await session.commit()
        logger.info(f"[SYNC] Upload committed: {success_count} success, {error_count} errors")
    except Exception as e:
        logger.error(f"[SYNC] Commit failed: {e}")
        await session.rollback()
        # Mark all pending as errors
        for result in results:
            if result["status"] == "success":
                result["status"] = "error"
                result["error"] = "Database commit failed"
                success_count -= 1
                error_count += 1

    return {
        "results": results,
        "total_processed": len(operations),
        "success_count": success_count,
        "error_count": error_count
    }
