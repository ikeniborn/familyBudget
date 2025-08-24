"""
Reports and analytics endpoints.
"""
from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, case
from pydantic import BaseModel

from app.db.database import get_db
from app.models.registry import Registry
from app.models.period import Period
from app.models.nomenclature import Nomenclature
from app.models.financial_center import FinancialCenter
from app.models.cost_center import CostCenter
from app.models.row_type import RowType
from app.core.session import get_current_user_from_session

router = APIRouter()


class BudgetVsActualResponse(BaseModel):
    """Budget vs Actual report response."""
    period_id: int
    period_name: str
    nomenclature_id: int
    nomenclature_name: str
    budget_amount: float
    actual_amount: float
    variance: float
    variance_percent: Optional[float]


class PeriodSummaryResponse(BaseModel):
    """Period summary response."""
    period_id: int
    period_name: str
    total_budget: float
    total_actual: float
    variance: float
    variance_percent: Optional[float]
    categories_count: int


class CategoryAnalysisResponse(BaseModel):
    """Category analysis response."""
    nomenclature_id: int
    nomenclature_name: str
    budget_amount: float
    actual_amount: float
    variance: float
    variance_percent: Optional[float]
    transaction_count: int


async def require_auth(request: Request) -> dict:
    """Require authentication."""
    user = await get_current_user_from_session(request)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    return user


@router.get("/budget-vs-actual", response_model=List[BudgetVsActualResponse])
async def get_budget_vs_actual_report(
    request: Request,
    period_id: Optional[int] = None,
    financial_center_id: Optional[int] = None,
    cost_center_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Get budget vs actual report for current user."""
    
    # Build query to get budget (row_type_id = 1) and actual (row_type_id = 2) amounts
    stmt = select(
        Registry.period_id,
        Period.ru_name.label("period_name"),
        Registry.nomenclature_id,
        Nomenclature.name.label("nomenclature_name"),
        func.sum(
            case(
                (Registry.row_type_id == 1, Registry.cost_sum),
                else_=0
            )
        ).label("budget_amount"),
        func.sum(
            case(
                (Registry.row_type_id == 2, Registry.cost_sum),
                else_=0
            )
        ).label("actual_amount")
    ).select_from(
        Registry.__table__.join(Period.__table__).join(Nomenclature.__table__)
    ).where(
        Registry.user_id == current_user["user_id"]
    )
    
    # Apply filters
    if period_id:
        stmt = stmt.where(Registry.period_id == period_id)
    
    if financial_center_id:
        stmt = stmt.where(Registry.financial_center_id == financial_center_id)
    
    if cost_center_id:
        stmt = stmt.where(Registry.cost_center_id == cost_center_id)
    
    stmt = stmt.group_by(
        Registry.period_id,
        Period.ru_name,
        Registry.nomenclature_id,
        Nomenclature.name
    ).order_by(Period.date, Nomenclature.name)
    
    result = await db.execute(stmt)
    rows = result.all()
    
    # Calculate variance for each row
    report_data = []
    for row in rows:
        budget_amount = float(row.budget_amount) if row.budget_amount else 0.0
        actual_amount = float(row.actual_amount) if row.actual_amount else 0.0
        variance = actual_amount - budget_amount
        variance_percent = (variance / budget_amount * 100) if budget_amount != 0 else None
        
        report_data.append(BudgetVsActualResponse(
            period_id=row.period_id,
            period_name=row.period_name,
            nomenclature_id=row.nomenclature_id,
            nomenclature_name=row.nomenclature_name,
            budget_amount=budget_amount,
            actual_amount=actual_amount,
            variance=variance,
            variance_percent=variance_percent
        ))
    
    return report_data


@router.get("/period-summary", response_model=List[PeriodSummaryResponse])
async def get_period_summary_report(
    request: Request,
    financial_center_id: Optional[int] = None,
    cost_center_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Get period summary report for current user."""
    
    stmt = select(
        Registry.period_id,
        Period.ru_name.label("period_name"),
        func.sum(
            case(
                (Registry.row_type_id == 1, Registry.cost_sum),
                else_=0
            )
        ).label("total_budget"),
        func.sum(
            case(
                (Registry.row_type_id == 2, Registry.cost_sum),
                else_=0
            )
        ).label("total_actual"),
        func.count(func.distinct(Registry.nomenclature_id)).label("categories_count")
    ).select_from(
        Registry.__table__.join(Period.__table__)
    ).where(
        Registry.user_id == current_user["user_id"]
    )
    
    # Apply filters
    if financial_center_id:
        stmt = stmt.where(Registry.financial_center_id == financial_center_id)
    
    if cost_center_id:
        stmt = stmt.where(Registry.cost_center_id == cost_center_id)
    
    stmt = stmt.group_by(
        Registry.period_id,
        Period.ru_name
    ).order_by(Period.date.desc())
    
    result = await db.execute(stmt)
    rows = result.all()
    
    # Calculate variance for each period
    summary_data = []
    for row in rows:
        total_budget = float(row.total_budget) if row.total_budget else 0.0
        total_actual = float(row.total_actual) if row.total_actual else 0.0
        variance = total_actual - total_budget
        variance_percent = (variance / total_budget * 100) if total_budget != 0 else None
        
        summary_data.append(PeriodSummaryResponse(
            period_id=row.period_id,
            period_name=row.period_name,
            total_budget=total_budget,
            total_actual=total_actual,
            variance=variance,
            variance_percent=variance_percent,
            categories_count=row.categories_count
        ))
    
    return summary_data


@router.get("/category-analysis", response_model=List[CategoryAnalysisResponse])
async def get_category_analysis_report(
    request: Request,
    period_id: Optional[int] = None,
    financial_center_id: Optional[int] = None,
    cost_center_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Get category analysis report for current user."""
    
    stmt = select(
        Registry.nomenclature_id,
        Nomenclature.name.label("nomenclature_name"),
        func.sum(
            case(
                (Registry.row_type_id == 1, Registry.cost_sum),
                else_=0
            )
        ).label("budget_amount"),
        func.sum(
            case(
                (Registry.row_type_id == 2, Registry.cost_sum),
                else_=0
            )
        ).label("actual_amount"),
        func.count(Registry.id).label("transaction_count")
    ).select_from(
        Registry.__table__.join(Nomenclature.__table__)
    ).where(
        Registry.user_id == current_user["user_id"]
    )
    
    # Apply filters
    if period_id:
        stmt = stmt.where(Registry.period_id == period_id)
    
    if financial_center_id:
        stmt = stmt.where(Registry.financial_center_id == financial_center_id)
    
    if cost_center_id:
        stmt = stmt.where(Registry.cost_center_id == cost_center_id)
    
    stmt = stmt.group_by(
        Registry.nomenclature_id,
        Nomenclature.name
    ).order_by(Nomenclature.name)
    
    result = await db.execute(stmt)
    rows = result.all()
    
    # Calculate variance for each category
    analysis_data = []
    for row in rows:
        budget_amount = float(row.budget_amount) if row.budget_amount else 0.0
        actual_amount = float(row.actual_amount) if row.actual_amount else 0.0
        variance = actual_amount - budget_amount
        variance_percent = (variance / budget_amount * 100) if budget_amount != 0 else None
        
        analysis_data.append(CategoryAnalysisResponse(
            nomenclature_id=row.nomenclature_id,
            nomenclature_name=row.nomenclature_name,
            budget_amount=budget_amount,
            actual_amount=actual_amount,
            variance=variance,
            variance_percent=variance_percent,
            transaction_count=row.transaction_count
        ))
    
    return analysis_data


@router.get("/dashboard-stats")
async def get_dashboard_statistics(
    request: Request,
    period_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Get dashboard statistics for current user."""
    
    # Base query filter
    base_filter = Registry.user_id == current_user["user_id"]
    if period_id:
        base_filter = and_(base_filter, Registry.period_id == period_id)
    
    # Total budget and actual amounts
    budget_stmt = select(func.sum(Registry.cost_sum)).where(
        and_(base_filter, Registry.row_type_id == 1)
    )
    actual_stmt = select(func.sum(Registry.cost_sum)).where(
        and_(base_filter, Registry.row_type_id == 2)
    )
    
    budget_result = await db.execute(budget_stmt)
    actual_result = await db.execute(actual_stmt)
    
    total_budget = float(budget_result.scalar() or 0)
    total_actual = float(actual_result.scalar() or 0)
    
    # Transaction counts
    budget_count_stmt = select(func.count(Registry.id)).where(
        and_(base_filter, Registry.row_type_id == 1)
    )
    actual_count_stmt = select(func.count(Registry.id)).where(
        and_(base_filter, Registry.row_type_id == 2)
    )
    
    budget_count_result = await db.execute(budget_count_stmt)
    actual_count_result = await db.execute(actual_count_stmt)
    
    budget_transactions = budget_count_result.scalar() or 0
    actual_transactions = actual_count_result.scalar() or 0
    
    # Category counts
    categories_stmt = select(func.count(func.distinct(Registry.nomenclature_id))).where(base_filter)
    categories_result = await db.execute(categories_stmt)
    active_categories = categories_result.scalar() or 0
    
    # Calculate variance
    variance = total_actual - total_budget
    variance_percent = (variance / total_budget * 100) if total_budget != 0 else None
    
    return {
        "total_budget": total_budget,
        "total_actual": total_actual,
        "variance": variance,
        "variance_percent": variance_percent,
        "budget_transactions": budget_transactions,
        "actual_transactions": actual_transactions,
        "total_transactions": budget_transactions + actual_transactions,
        "active_categories": active_categories,
        "period_id": period_id
    }


@router.get("/spending-trends")
async def get_spending_trends(
    request: Request,
    months: int = 6,
    nomenclature_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Get spending trends over time for current user."""
    
    stmt = select(
        Registry.period_id,
        Period.ru_name.label("period_name"),
        Period.date.label("period_date"),
        func.sum(
            case(
                (Registry.row_type_id == 1, Registry.cost_sum),
                else_=0
            )
        ).label("budget_amount"),
        func.sum(
            case(
                (Registry.row_type_id == 2, Registry.cost_sum),
                else_=0
            )
        ).label("actual_amount")
    ).select_from(
        Registry.__table__.join(Period.__table__)
    ).where(
        Registry.user_id == current_user["user_id"]
    )
    
    if nomenclature_id:
        stmt = stmt.where(Registry.nomenclature_id == nomenclature_id)
    
    stmt = stmt.group_by(
        Registry.period_id,
        Period.ru_name,
        Period.date
    ).order_by(Period.date.desc()).limit(months)
    
    result = await db.execute(stmt)
    rows = result.all()
    
    trends = []
    for row in rows:
        budget_amount = float(row.budget_amount) if row.budget_amount else 0.0
        actual_amount = float(row.actual_amount) if row.actual_amount else 0.0
        
        trends.append({
            "period_id": row.period_id,
            "period_name": row.period_name,
            "period_date": row.period_date.isoformat() if row.period_date else None,
            "budget_amount": budget_amount,
            "actual_amount": actual_amount,
            "variance": actual_amount - budget_amount
        })
    
    return {"trends": list(reversed(trends))}  # Reverse to show chronological order