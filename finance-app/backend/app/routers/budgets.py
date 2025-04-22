from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import date

from .. import crud, schemas, models
from ..database import get_db
from .auth import get_current_user  # Import the dependency

router = APIRouter()


@router.post(
    "/",
    response_model=schemas.Budget,
    status_code=status.HTTP_201_CREATED,  # Or 200 if updating
    summary="Create or Update Budget",
    description="Set or update the budget for a specific category and month.",
)
async def create_or_update_budget(
    budget_in: schemas.BudgetCreate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.Budget:
    """
    Creates a new budget or updates an existing one for the given
    user, category, and month (YYYY-MM-01 format expected for month_year).
    """
    # Ensure month_year is the first day of the month if not already validated
    if budget_in.month_year.day != 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="month_year must be the first day of the month (YYYY-MM-01)",  # noqa: E501
        )
    # TODO: Add validation to ensure category_id belongs to the user
    return await crud.crud_budget.create_or_update_budget(
        db=db, budget=budget_in, user_id=current_user.id
    )


@router.get(
    "/",
    response_model=List[schemas.Budget],
    summary="Read Budgets",
    description="Retrieve budgets filtered by month range/categories.",
)
async def read_budgets(
    skip: int = 0,
    limit: int = 1000,
    start_month: Optional[date] = Query(None, description="Start month (YYYY-MM-01)"),  # noqa: E501
    end_month: Optional[date] = Query(None, description="End month (YYYY-MM-01)"),  # noqa: E501
    category_ids: Optional[List[int]] = Query(None, description="Category IDs"),  # noqa: E501
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> List[models.Budget]:
    """
    Retrieves budgets for the current user, optionally filtered.
    Requires start/end month dates to be the first day of the month.
    """
    if start_month and start_month.day != 1:
        raise HTTPException(status_code=400, detail="start_month must be YYYY-MM-01")  # noqa: E501
    if end_month and end_month.day != 1:
        raise HTTPException(status_code=400, detail="end_month must be YYYY-MM-01")  # noqa: E501

    budgets = await crud.crud_budget.get_budgets(
        db=db,
        user_id=current_user.id,
        skip=skip,
        limit=limit,
        start_month=start_month,
        end_month=end_month,
        category_ids=category_ids,
    )
    return budgets


@router.delete(
    "/{budget_id}",
    response_model=schemas.Message,
    summary="Delete Budget",
    description="Delete a specific budget entry by its ID.",
)
async def delete_budget(
    budget_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.Message:
    """
    Deletes a budget entry by ID for the current user.
    """
    deleted_budget = await crud.crud_budget.delete_budget(
        db=db, budget_id=budget_id, user_id=current_user.id
    )
    if deleted_budget is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found"
        )
    return {"message": f"Budget {budget_id} deleted successfully"}

# Note: GET /{id} and PUT /{id} might not be needed if budgets are always
# managed via POST (create/update) based on category/month.
# If needed, they can be added similar to other routers.