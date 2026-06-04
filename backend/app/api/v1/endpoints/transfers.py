"""Transfer endpoints for managing transfers between financial centers."""

import logging
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.dependencies import CurrentUser, get_session
from backend.app.models.article import Article
from backend.app.models.budget_fact_history import BudgetFactHistory
from backend.app.models.fact import BudgetFact
from backend.app.models.financial_center import FinancialCenter
from backend.app.schemas.transfer import TransferCreate, TransferResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/transfers", tags=["Transfers"])


# Lazy import for WebSocket broadcast to avoid circular dependencies
_budget_ws_module = None


def _get_budget_ws_broadcast():
    """Get budget WebSocket module lazily to avoid circular imports."""
    global _budget_ws_module
    if _budget_ws_module is None:
        from backend.app.api.v1.endpoints import budget_ws
        _budget_ws_module = budget_ws
    return _budget_ws_module


async def generate_transfer_id(session: AsyncSession) -> int:
    """Generate unique transfer ID.

    Uses max(transfer_id) + 1 from existing facts.
    Alternative: Use UUID or database sequence.
    """
    from sqlmodel import func, select

    result = await session.exec(
        select(func.max(BudgetFact.transfer_id))
    )
    max_id = result.one_or_none()

    if max_id is None:
        return 1  # First transfer
    else:
        return max_id + 1


async def validate_article_type(
    session: AsyncSession,
    article_id: int,
    expected_type: str
) -> Article:
    """Validate article exists and has correct type.

    Args:
        article_id: Article ID to validate
        expected_type: Expected type ('income', 'expense', 'debit', 'credit')

    Returns:
        Article instance if valid

    Raises:
        HTTPException: If article not found or wrong type
    """
    from sqlmodel import select

    result = await session.exec(
        select(Article)
        .where(Article.id == article_id)
    )
    article = result.one_or_none()

    if not article:
        raise HTTPException(
            status_code=404,
            detail=f"Article with ID {article_id} not found"
        )

    if article.type != expected_type:
        raise HTTPException(
            status_code=400,
            detail=f"Article '{article.name}' must be type '{expected_type}', got '{article.type}'"
        )

    return article


async def validate_financial_center(
    session: AsyncSession,
    cfo_id: int
) -> FinancialCenter:
    """Validate financial center exists.

    Args:
        cfo_id: Financial center ID

    Returns:
        FinancialCenter instance if valid

    Raises:
        HTTPException: If CFO not found
    """
    from sqlmodel import select

    result = await session.exec(
        select(FinancialCenter)
        .where(FinancialCenter.id == cfo_id)
    )
    cfo = result.one_or_none()

    if not cfo:
        raise HTTPException(
            status_code=404,
            detail=f"Financial center with ID {cfo_id} not found"
        )

    return cfo


@router.post(
    "",
    response_model=TransferResponse,
    status_code=201,
    summary="Create transfer between financial centers",
    description=(
        "Creates a transfer by creating two linked transactions:\n"
        "1. Expense transaction (списание from source CFO)\n"
        "2. Income transaction (пополнение to destination CFO)\n\n"
        "Both transactions share the same transfer_id for tracking."
    )
)
async def create_transfer(
    transfer: TransferCreate,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: CurrentUser
):
    """Create a transfer between financial centers.

    Args:
        transfer: Transfer data (date, amount, from/to CFOs, etc.)
        session: Database session
        current_user: Current authenticated user

    Returns:
        TransferResponse with transfer_id and fact IDs

    Raises:
        HTTPException: If validation fails or database error
    """
    # 1. Validate articles
    await validate_article_type(
        session,
        transfer.from_article_id,
        expected_type="debit"
    )
    await validate_article_type(
        session,
        transfer.to_article_id,
        expected_type="credit"
    )

    # 2. Validate financial centers
    from_cfo = await validate_financial_center(
        session,
        transfer.from_financial_center_id
    )
    to_cfo = await validate_financial_center(
        session,
        transfer.to_financial_center_id
    )

    # 3. Generate unique transfer ID
    transfer_id = await generate_transfer_id(session)

    # 4. Build descriptions
    base_description = transfer.description or "Внутренний перевод"
    expense_description = f"Перевод в {to_cfo.name} - {base_description}"
    income_description = f"Получено из {from_cfo.name} - {base_description}"

    # 5. Create expense fact (списание)
    expense_fact = BudgetFact(
        user_id=current_user.id,
        article_id=transfer.from_article_id,
        financial_center_id=transfer.from_financial_center_id,
        cost_center_id=transfer.from_cost_center_id,
        fact_date=transfer.transfer_date,
        amount=abs(transfer.amount),  # Always positive (sign determined by article_type)
        description=expense_description,
        transfer_id=transfer_id,
        record_type=transfer.record_type,  # Use record_type from request
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )

    # 6. Create income fact (пополнение)
    income_fact = BudgetFact(
        user_id=current_user.id,
        article_id=transfer.to_article_id,
        financial_center_id=transfer.to_financial_center_id,
        cost_center_id=transfer.to_cost_center_id,
        fact_date=transfer.transfer_date,
        amount=abs(transfer.amount),  # Positive for income
        description=income_description,
        transfer_id=transfer_id,
        record_type=transfer.record_type,  # Use record_type from request
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )

    # 7. Save both facts in a single transaction (atomic)
    try:
        session.add(expense_fact)
        session.add(income_fact)
        await session.commit()
        await session.refresh(expense_fact)
        await session.refresh(income_fact)
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create transfer: {str(e)}"
        )

    # 8. SSE broadcast for transfer created (notify all connected clients)
    try:
        ws = _get_budget_ws_broadcast()
        transfer_data = {
            "id": transfer_id,
            "expense_fact_id": expense_fact.id,
            "income_fact_id": income_fact.id,
            "amount": float(transfer.amount),
            "transfer_date": str(transfer.transfer_date),
            "description": transfer.description,
        }
        await ws.broadcast_transfer_created(transfer_data)
    except Exception as e:
        logger.warning("SSE broadcast failed for transfer %s: %s", transfer_id, e)
        # Don't fail the request if broadcast fails

    # 9. Return response
    return TransferResponse(
        transfer_id=transfer_id,
        expense_fact_id=expense_fact.id,
        income_fact_id=income_fact.id,
        created_at=expense_fact.created_at.isoformat()
    )


@router.delete(
    "/{transfer_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete transfer",
    description=(
        "Delete a transfer by deleting both linked facts (debit and credit).\n"
        "Creates DELETE history records for audit trail.\n"
        "Broadcasts SSE event to all connected clients."
    ),
)
async def delete_transfer(
    transfer_id: int,
    session: Annotated[AsyncSession, Depends(get_session)],
    current_user: CurrentUser,
) -> None:
    """Delete transfer by transfer_id.

    Finds and deletes both linked facts (debit and credit).
    Creates DELETE history records for audit trail.

    Args:
        transfer_id: Transfer ID to delete
        session: Database session
        current_user: Current authenticated user

    Raises:
        HTTPException: If transfer not found or database error
    """
    from sqlmodel import select

    # Find all facts with this transfer_id
    stmt = select(BudgetFact).where(BudgetFact.transfer_id == transfer_id)
    result = await session.exec(stmt)
    facts = result.all()

    if not facts:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transfer {transfer_id} not found",
        )

    # Create DELETE history for each fact and delete
    now = datetime.utcnow()
    for fact in facts:
        # Create history record (SCD Type 2)
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
            valid_from=now,
            is_current=False,
            change_type="DELETE",
            changed_by_user_id=current_user.id,
        )
        session.add(delete_history)
        await session.delete(fact)

    await session.commit()

    logger.info(
        "Deleted transfer %s (%s facts) by user %s", transfer_id, len(facts), current_user.id
    )

    # SSE broadcast for transfer deleted (notify all connected clients)
    try:
        ws = _get_budget_ws_broadcast()
        await ws.broadcast_transfer_deleted(transfer_id)
    except Exception as e:
        logger.warning("SSE broadcast failed for deleted transfer %s: %s", transfer_id, e)
        # Don't fail the request if broadcast fails

    return None
