from fastapi import APIRouter, Depends, Query, HTTPException  # status unused
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional, Dict, Any
from datetime import date

from .. import schemas, models  # Assuming schemas needed later
from ..database import get_db
from .auth import get_current_user  # Import the dependency

router = APIRouter()

# Placeholder schema for report responses - Define more specific ones later


class ReportDataBase(schemas.TunedModel):
    pass


class SpendingByCategoryReport(ReportDataBase):
    category_name: str
    total_spent: float


class IncomeExpenseReport(ReportDataBase):
    period: str  # e.g., 'YYYY-MM' or 'YYYY'
    total_income: float
    total_expense: float


class BudgetActualReport(ReportDataBase):
    category_name: str
    month_year: date  # First day of month
    allocated_amount: float
    actual_spent: float
    difference: float


@router.get(
    "/spending-by-category",
    # response_model=List[SpendingByCategoryReport], # Define later
    summary="Spending by Category Report",
    description="Get aggregated spending per category over a selected period.",
)
async def get_spending_by_category(
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),  # noqa: E501
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),  # noqa: E501
    account_ids: Optional[List[int]] = Query(None, description="Filter by account IDs"),  # noqa: E501
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> List[Dict[str, Any]]:  # Return generic list/dict for now
    """
    Generates report: total spending per category within date range.
    Requires complex aggregation query.
    """
    # TODO: Implement complex query using SQLAlchemy core/ORM aggregations
    # Query transactions (filter user, date range, accounts, type='Expense')
    # Group by category_id, sum amount
    # Join categories table for names
    # Return list like [{"category": "Groceries", "total": 123.45}, ...]
    print(f"User {current_user.id} spending report: {start_date} to {end_date}, accounts: {account_ids}")  # noqa: E501
    # Placeholder response
    return [  # noqa: E501
        {"category_name": "Groceries", "total_spent": 150.75},
        {"category_name": "Rent", "total_spent": 800.00},
    ]


@router.get(
    "/income-vs-expense",
    # response_model=List[IncomeExpenseReport], # Define later
    summary="Income vs. Expense Report",
    description="Get aggregated income/expense totals over time.",
)
async def get_income_vs_expense(
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),  # noqa: E501
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),  # noqa: E501
    group_by: str = Query("month", description="Group by 'month' or 'year'"),  # noqa: E501
    account_ids: Optional[List[int]] = Query(None, description="Filter by account IDs"),  # noqa: E501
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> List[Dict[str, Any]]:  # Return generic list/dict for now
    """
    Generates report comparing income and expenses over time periods.
    Requires complex aggregation query.
    """
    # TODO: Implement complex query
    # Query transactions (filter user, date range, accounts)
    # Group by period (month/year from date) and transaction type
    # Sum amounts for Income/Expense per period
    # Return list like [{"period": "2025-04", "income": 2k, "expense": 1.5k}]
    print(f"User {current_user.id} income/expense report: {start_date} to {end_date}, group: {group_by}, accounts: {account_ids}")  # noqa: E501
    # Placeholder response
    return [{"period": "2025-04", "total_income": 2100.00, "total_expense": 1450.50}]  # noqa: E501


@router.get(
    "/budget-vs-actual",
    # response_model=List[BudgetActualReport], # Define later
    summary="Budget vs. Actual Spending Report",
    description="Compare budget vs actual spending per category for months.",
)
async def get_budget_vs_actual(
    start_month: date = Query(..., description="Start month (YYYY-MM-01)"),  # Required  # noqa: E501
    end_month: date = Query(..., description="End month (YYYY-MM-01)"),  # Required  # noqa: E501
    category_ids: Optional[List[int]] = Query(None, description="Filter by category IDs"),  # noqa: E501
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> List[Dict[str, Any]]:  # Return generic list/dict for now
    """
    Generates report comparing budgeted amounts vs actual spending.
    Requires joining/querying budgets and aggregated transactions.
    """
    if start_month.day != 1 or end_month.day != 1:
        raise HTTPException(status_code=400, detail="Start/End month must be YYYY-MM-01")  # noqa: E501
    # TODO: Implement complex query
    # 1. Get relevant budgets (filter user, month range, categories)
    # 2. Get aggregated spending (filter user, date range, type='Expense', group by category/month) # noqa: E501
    # 3. Join/Combine results
    # 4. Calculate difference
    # Return list like [{"cat": "Groceries", "month": "2025-04-01", "alloc": 200, "actual": 150, "diff": 50}] # noqa: E501
    print(f"User {current_user.id} budget/actual report: {start_month} to {end_month}, categories: {category_ids}")  # noqa: E501
    # Placeholder response
    return [{"category_name": "Groceries", "month_year": "2025-04-01", "allocated_amount": 200.00, "actual_spent": 150.75, "difference": 49.25}]  # noqa: E501