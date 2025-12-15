"""Transfer endpoints for managing transfers between financial centers."""

import logging
from datetime import datetime
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.dependencies import get_session, CurrentUser
from backend.app.schemas.transfer import TransferCreate, TransferResponse
from backend.app.models.fact import BudgetFact
from backend.app.models.article import Article
from backend.app.models.financial_center import FinancialCenter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/transfers", tags=["Transfers"])


# Lazy import for SSE broadcast to avoid circular dependencies
_budget_sse_module = None


def _get_budget_sse_broadcast():
    """Get budget SSE module lazily to avoid circular imports."""
    global _budget_sse_module
    if _budget_sse_module is None:
        from backend.app.api.v1.endpoints import budget_sse
        _budget_sse_module = budget_sse
    return _budget_sse_module


async def generate_transfer_id(session: AsyncSession) -> int:
    """Generate unique transfer ID.

    Uses max(transfer_id) + 1 from existing facts.
    Alternative: Use UUID or database sequence.
    """
    from sqlmodel import select, func

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
    from_article = await validate_article_type(
        session,
        transfer.from_article_id,
        expected_type="debit"
    )
    to_article = await validate_article_type(
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
        is_offline_sync=transfer.is_offline_sync,  # Preserve offline sync flag
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
        is_offline_sync=transfer.is_offline_sync,  # Preserve offline sync flag
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

    # 8. SSE broadcast for transfer created (non-blocking)
    try:
        sse = _get_budget_sse_broadcast()
        transfer_data = {
            "id": transfer_id,
            "source_fact_id": expense_fact.id,
            "target_fact_id": income_fact.id,
            "amount": float(transfer.amount),
            "transfer_date": str(transfer.transfer_date),
            "description": transfer.description,
        }
        await sse.broadcast_transfer_created(transfer_data, user_id=current_user.id)
    except Exception as e:
        logger.warning(f"SSE broadcast failed for transfer {transfer_id}: {e}")
        # Don't fail the request if broadcast fails

    # 9. Return response
    return TransferResponse(
        transfer_id=transfer_id,
        expense_fact_id=expense_fact.id,
        income_fact_id=income_fact.id,
        created_at=expense_fact.created_at.isoformat()
    )
