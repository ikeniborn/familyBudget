"""
Balance Aggregation Service - Monthly balance snapshot management.

This service manages the FinancialCenterBalanceMonthly aggregate table to optimize
balance queries by pre-calculating monthly closing balances.

Key Features:
- Calculate and save monthly closing balances for all financial centers
- Retrieve opening balance from aggregate (with fallback to full scan)
- Support incremental updates (only missing/changed months)
- Admin API integration for manual refresh

Usage:
    # Refresh all aggregates for all financial centers
    await refresh_monthly_balances(session)

    # Refresh for specific year/month
    await refresh_monthly_balances(session, year=2025, month=11)

    # Get opening balance (uses aggregate if available, fallback to full scan)
    opening_balance = await get_opening_balance(session, fc_id=1, year=2025, month=12)
"""

from calendar import monthrange
from datetime import date, datetime
from decimal import Decimal

from sqlmodel import case, func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.models.article import Article
from backend.app.models.fact import BudgetFact
from backend.app.models.financial_center import FinancialCenter
from backend.app.models.financial_center_balance_monthly import FinancialCenterBalanceMonthly


async def refresh_monthly_balances(
    session: AsyncSession,
    year: int | None = None,
    month: int | None = None,
    financial_center_id: int | None = None,
) -> dict[str, int]:
    """
    Calculate and save monthly balance snapshots for financial centers.

    This function calculates closing balances for each financial center at the end
    of each month and stores them in t_agg_financial_center_balance_monthly.

    Logic:
    - For each financial center, for each month (or specific month if provided):
      - Calculate cumulative balance up to end of that month
      - Count transactions in that month
      - Upsert into aggregate table (INSERT ON CONFLICT UPDATE)

    Args:
        session: AsyncSession for database operations
        year: Optional year to refresh (e.g., 2025). If None, refresh all historical data.
        month: Optional month to refresh (1-12). Requires year. If None, refresh all months in year.
        financial_center_id: Optional FC ID to refresh. If None, refresh all financial centers.

    Returns:
        Dict with statistics:
        {
            "updated_count": int,  # Number of aggregate records updated/created
            "financial_centers": int,  # Number of financial centers processed
            "months_processed": int,  # Number of months processed
        }

    Example:
        # Refresh all aggregates for all time
        >>> result = await refresh_monthly_balances(session)
        >>> print(f"Updated {result['updated_count']} aggregate records")

        # Refresh only November 2025
        >>> result = await refresh_monthly_balances(session, year=2025, month=11)

        # Refresh all data for specific financial center
        >>> result = await refresh_monthly_balances(session, financial_center_id=1)

    Notes:
        - Uses UPSERT (INSERT ON CONFLICT UPDATE) to handle existing records
        - Safe to call multiple times (idempotent)
        - For current month, aggregate stores balance as of last day of month
        - Heavy operation for full refresh - consider running as background job
    """
    updated_count = 0
    processed_fcs = set()
    processed_months = set()

    # Step 1: Get list of financial centers to process
    fc_query = select(FinancialCenter).where(FinancialCenter.is_active == True)
    if financial_center_id is not None:
        fc_query = fc_query.where(FinancialCenter.id == financial_center_id)

    fc_result = await session.execute(fc_query)
    financial_centers = fc_result.scalars().all()

    if not financial_centers:
        return {
            "updated_count": 0,
            "financial_centers": 0,
            "months_processed": 0,
        }

    # Step 2: Determine date range to process
    # Get earliest transaction date from database
    earliest_date_query = select(func.min(BudgetFact.fact_date)).where(
        BudgetFact.record_type == "fact"
    )
    if financial_center_id is not None:
        earliest_date_query = earliest_date_query.where(
            BudgetFact.financial_center_id == financial_center_id
        )

    earliest_result = await session.execute(earliest_date_query)
    earliest_date = earliest_result.scalar()

    if not earliest_date:
        # No transactions found
        return {
            "updated_count": 0,
            "financial_centers": len(financial_centers),
            "months_processed": 0,
        }

    # Determine start/end dates for processing
    if year and month:
        # Process specific month only
        start_year, start_month = year, month
        end_year, end_month = year, month
    elif year:
        # Process all months in specific year
        start_year, start_month = year, 1
        end_year, end_month = year, 12
    else:
        # Process all months from earliest transaction to current month
        start_year, start_month = earliest_date.year, earliest_date.month
        today = date.today()
        end_year, end_month = today.year, today.month

    # Step 3: Iterate through each financial center and each month
    for fc in financial_centers:
        processed_fcs.add(fc.id)

        # Iterate through months in range
        current_year = start_year
        current_month = start_month

        while (current_year < end_year) or (current_year == end_year and current_month <= end_month):
            # Calculate last day of this month
            _, last_day = monthrange(current_year, current_month)
            month_end = date(current_year, current_month, last_day)

            # Calculate cumulative balance up to end of this month
            balance_query = select(
                (
                    func.sum(case((Article.type.in_(["income", "credit"]), BudgetFact.amount), else_=0)) -
                    func.sum(case((Article.type.in_(["expense", "debit"]), BudgetFact.amount), else_=0))
                ).label("balance")
            ).select_from(BudgetFact).join(
                Article, BudgetFact.article_id == Article.id
            ).where(
                BudgetFact.financial_center_id == fc.id,
                BudgetFact.fact_date <= month_end,
                BudgetFact.record_type == "fact"
            )

            balance_result = await session.execute(balance_query)
            closing_balance = balance_result.scalar()

            # Handle None (no transactions)
            if closing_balance is None:
                closing_balance = Decimal("0.00")
            else:
                closing_balance = Decimal(str(closing_balance))

            # Count transactions in this month only
            month_start = date(current_year, current_month, 1)
            count_query = select(func.count(BudgetFact.id)).where(
                BudgetFact.financial_center_id == fc.id,
                BudgetFact.fact_date >= month_start,
                BudgetFact.fact_date <= month_end,
                BudgetFact.record_type == "fact"
            )
            count_result = await session.execute(count_query)
            transaction_count = count_result.scalar() or 0

            # Check if aggregate already exists
            existing_query = select(FinancialCenterBalanceMonthly).where(
                FinancialCenterBalanceMonthly.financial_center_id == fc.id,
                FinancialCenterBalanceMonthly.year == current_year,
                FinancialCenterBalanceMonthly.month == current_month
            )
            existing_result = await session.execute(existing_query)
            existing_aggregate = existing_result.scalar_one_or_none()

            if existing_aggregate:
                # Update existing aggregate
                existing_aggregate.closing_balance = closing_balance
                existing_aggregate.transaction_count = transaction_count
                existing_aggregate.updated_at = datetime.utcnow()
                session.add(existing_aggregate)
            else:
                # Create new aggregate
                new_aggregate = FinancialCenterBalanceMonthly(
                    financial_center_id=fc.id,
                    year=current_year,
                    month=current_month,
                    closing_balance=closing_balance,
                    transaction_count=transaction_count,
                )
                session.add(new_aggregate)

            updated_count += 1
            processed_months.add((current_year, current_month))

            # Move to next month
            if current_month == 12:
                current_year += 1
                current_month = 1
            else:
                current_month += 1

    # Step 4: Commit all changes
    await session.commit()

    return {
        "updated_count": updated_count,
        "financial_centers": len(processed_fcs),
        "months_processed": len(processed_months),
    }


async def get_opening_balance(
    session: AsyncSession,
    financial_center_id: int,
    year: int,
    month: int,
) -> Decimal:
    """
    Get opening balance for a financial center for a specific month.

    Opening Balance = closing balance of previous month (from aggregate table if available).

    Logic:
    1. Try to get closing balance for previous month from aggregate table
    2. If aggregate exists → return it (fast path)
    3. If aggregate missing → calculate from full transaction history (slow path fallback)

    Args:
        session: AsyncSession for database operations
        financial_center_id: Financial center ID
        year: Year (YYYY, e.g., 2025)
        month: Month (1-12)

    Returns:
        Opening balance as Decimal

    Example:
        >>> # Get opening balance for December 2025 (= closing balance of November 2025)
        >>> opening = await get_opening_balance(session, fc_id=1, year=2025, month=12)
        >>> print(f"Opening balance: {opening}")

    Notes:
        - For January, previous month is December of previous year
        - If aggregate missing, falls back to full scan (expensive)
        - Returns Decimal("0.00") if no transactions found
    """
    # Determine previous month
    if month == 1:
        prev_year, prev_month = year - 1, 12
    else:
        prev_year, prev_month = year, month - 1

    # Try to get aggregate for previous month
    aggregate_query = select(FinancialCenterBalanceMonthly).where(
        FinancialCenterBalanceMonthly.financial_center_id == financial_center_id,
        FinancialCenterBalanceMonthly.year == prev_year,
        FinancialCenterBalanceMonthly.month == prev_month
    )
    aggregate_result = await session.execute(aggregate_query)
    aggregate = aggregate_result.scalar_one_or_none()

    if aggregate:
        # Fast path: use pre-calculated aggregate
        return aggregate.closing_balance

    # Slow path: calculate from full transaction history
    # Calculate cumulative balance up to end of previous month
    _, last_day = monthrange(prev_year, prev_month)
    prev_month_end = date(prev_year, prev_month, last_day)

    balance_query = select(
        (
            func.sum(case((Article.type.in_(["income", "credit"]), BudgetFact.amount), else_=0)) -
            func.sum(case((Article.type.in_(["expense", "debit"]), BudgetFact.amount), else_=0))
        ).label("balance")
    ).select_from(BudgetFact).join(
        Article, BudgetFact.article_id == Article.id
    ).where(
        BudgetFact.financial_center_id == financial_center_id,
        BudgetFact.fact_date <= prev_month_end,
        BudgetFact.record_type == "fact"
    )

    balance_result = await session.execute(balance_query)
    balance = balance_result.scalar()

    if balance is None:
        return Decimal("0.00")

    return Decimal(str(balance))


async def get_opening_balances_bulk(
    session: AsyncSession,
    year: int,
    month: int,
    financial_center_ids: list[int] | None = None,
) -> dict[int, Decimal]:
    """
    Get opening balances for multiple financial centers at once (optimized).

    This is a bulk version of get_opening_balance() - fetches aggregates for all
    financial centers in a single query, then falls back to full scan only for missing ones.

    Args:
        session: AsyncSession for database operations
        year: Year (YYYY)
        month: Month (1-12)
        financial_center_ids: Optional list of FC IDs to fetch. If None, fetch all active FCs.

    Returns:
        Dict mapping financial_center_id -> opening_balance (Decimal)

    Example:
        >>> # Get opening balances for all FCs for December 2025
        >>> balances = await get_opening_balances_bulk(session, year=2025, month=12)
        >>> for fc_id, opening_balance in balances.items():
        ...     print(f"FC {fc_id}: {opening_balance}")

    Notes:
        - Much faster than calling get_opening_balance() in a loop
        - Uses aggregate table where available, falls back to full scan only for missing
    """
    # Determine previous month
    if month == 1:
        prev_year, prev_month = year - 1, 12
    else:
        prev_year, prev_month = year, month - 1

    # Step 1: Get all active financial centers if not specified
    if financial_center_ids is None:
        fc_query = select(FinancialCenter.id).where(FinancialCenter.is_active == True)
        fc_result = await session.execute(fc_query)
        financial_center_ids = [fc_id for fc_id, in fc_result.all()]

    if not financial_center_ids:
        return {}

    # Step 2: Fetch all available aggregates for previous month
    aggregate_query = select(FinancialCenterBalanceMonthly).where(
        FinancialCenterBalanceMonthly.financial_center_id.in_(financial_center_ids),
        FinancialCenterBalanceMonthly.year == prev_year,
        FinancialCenterBalanceMonthly.month == prev_month
    )
    aggregate_result = await session.execute(aggregate_query)
    aggregates = aggregate_result.scalars().all()

    # Build result dict from aggregates
    result = {agg.financial_center_id: agg.closing_balance for agg in aggregates}

    # Step 3: For FCs without aggregate, calculate from full history
    missing_fc_ids = set(financial_center_ids) - set(result.keys())

    if missing_fc_ids:
        # Calculate cumulative balance up to end of previous month for missing FCs
        _, last_day = monthrange(prev_year, prev_month)
        prev_month_end = date(prev_year, prev_month, last_day)

        fallback_query = select(
            BudgetFact.financial_center_id,
            (
                func.sum(case((Article.type.in_(["income", "credit"]), BudgetFact.amount), else_=0)) -
                func.sum(case((Article.type.in_(["expense", "debit"]), BudgetFact.amount), else_=0))
            ).label("balance")
        ).select_from(BudgetFact).join(
            Article, BudgetFact.article_id == Article.id
        ).where(
            BudgetFact.financial_center_id.in_(list(missing_fc_ids)),
            BudgetFact.fact_date <= prev_month_end,
            BudgetFact.record_type == "fact"
        ).group_by(BudgetFact.financial_center_id)

        fallback_result = await session.execute(fallback_query)
        fallback_balances = {row.financial_center_id: Decimal(str(row.balance)) for row in fallback_result.all()}

        # Add fallback balances to result
        for fc_id in missing_fc_ids:
            result[fc_id] = fallback_balances.get(fc_id, Decimal("0.00"))

    return result
