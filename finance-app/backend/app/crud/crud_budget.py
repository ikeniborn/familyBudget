from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from datetime import date

from .. import models, schemas


async def get_budget(
    db: AsyncSession, budget_id: int, user_id: int
) -> Optional[models.Budget]:
    """Gets a single budget by ID, ensuring it belongs to the user."""
    result = await db.execute(
        select(models.Budget).filter(
            models.Budget.id == budget_id, models.Budget.user_id == user_id
        )
    )
    return result.scalars().first()


async def get_budget_by_category_month(
    db: AsyncSession, category_id: int, month_year: date, user_id: int
) -> Optional[models.Budget]:
    """Gets a budget for a specific category and month for a user."""
    result = await db.execute(
        select(models.Budget).filter(
            models.Budget.category_id == category_id,
            models.Budget.month_year == month_year,
            models.Budget.user_id == user_id,
        )
    )
    return result.scalars().first()


async def get_budgets(
    db: AsyncSession,
    user_id: int,
    skip: int = 0,
    limit: int = 1000,  # Often fetch more budgets at once
    start_month: Optional[date] = None,  # Expecting first day of month
    end_month: Optional[date] = None,    # Expecting first day of month
    category_ids: Optional[List[int]] = None,
) -> List[models.Budget]:
    """Gets budgets for a user, filtered by month range/categories."""
    query = select(models.Budget).filter(models.Budget.user_id == user_id)

    if start_month:
        query = query.filter(models.Budget.month_year >= start_month)
    if end_month:
        # Ensure end_month comparison is inclusive if needed
        query = query.filter(models.Budget.month_year <= end_month)
    if category_ids:
        query = query.filter(models.Budget.category_id.in_(category_ids))

    query = query.order_by(
        models.Budget.month_year.desc(), models.Budget.category_id
    )
    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    return result.scalars().all()


async def create_or_update_budget(
    db: AsyncSession, budget: schemas.BudgetCreate, user_id: int
) -> models.Budget:
    """
    Creates a new budget or updates an existing one for the given
    user, category, and month.
    """
    # Check category ownership (optional, depends on FK constraints)

    # Check if budget already exists for this user/category/month
    db_budget = await get_budget_by_category_month(
        db,
        category_id=budget.category_id,
        month_year=budget.month_year,
        user_id=user_id,
    )

    if db_budget:
        # Update existing budget
        db_budget.allocated_amount = budget.allocated_amount
    else:
        # Create new budget
        db_budget = models.Budget(**budget.model_dump(), user_id=user_id)
        db.add(db_budget)

    await db.flush()
    await db.refresh(db_budget)
    return db_budget


async def delete_budget(
    db: AsyncSession, budget_id: int, user_id: int
) -> Optional[models.Budget]:
    """Deletes a budget entry by its ID, ensuring it belongs to the user."""
    db_budget = await get_budget(db, budget_id=budget_id, user_id=user_id)
    if db_budget:
        await db.delete(db_budget)
        await db.flush()
    return db_budget

# Could also add delete_budget_by_category_month if needed