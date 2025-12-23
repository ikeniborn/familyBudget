"""
Recurring Plan Service for scheduled payment management.

Handles CRUD operations for recurring plans and automatic generation
of BudgetFact records based on frequency settings.
"""

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import List, Optional, Tuple

from sqlalchemy import func as sa_func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.logging import get_logger
from backend.app.models.article import Article
from backend.app.models.cost_center import CostCenter
from backend.app.models.fact import BudgetFact
from backend.app.models.financial_center import FinancialCenter
from backend.app.models.recurring_plan import RecurringPlan
from backend.app.schemas.recurring_plan import (
    RecurringPlanCreate,
    RecurringPlanUpdate,
)
from backend.app.utils.timezone import now_local, now_utc

logger = get_logger(__name__)

# Default horizon for fact generation (3 months ahead)
DEFAULT_GENERATION_HORIZON_DAYS = 90

# Maximum iterations to prevent infinite loops
MAX_ITERATIONS = 1000


class RecurringPlanService:
    """Service for recurring plan management and fact generation."""

    # =========================================================================
    # CRUD Operations
    # =========================================================================

    async def create_recurring_plan(
        self,
        session: AsyncSession,
        data: RecurringPlanCreate,
        user_id: int,
    ) -> RecurringPlan:
        """
        Create a recurring plan and generate initial facts.

        Args:
            session: Database session
            data: Plan creation data
            user_id: Owner user ID

        Returns:
            Created RecurringPlan

        Raises:
            ValueError: If referenced entities don't exist
        """
        # Validate article exists
        article = await session.get(Article, data.article_id)
        if not article:
            raise ValueError(f"Article with ID {data.article_id} not found")

        # Validate financial center exists
        fc = await session.get(FinancialCenter, data.financial_center_id)
        if not fc:
            raise ValueError(f"Financial center with ID {data.financial_center_id} not found")

        # Validate cost center if provided
        if data.cost_center_id:
            cc = await session.get(CostCenter, data.cost_center_id)
            if not cc:
                raise ValueError(f"Cost center with ID {data.cost_center_id} not found")

        # Calculate next generation date
        next_date = self._calculate_next_occurrence(
            frequency_type=data.frequency_type,
            frequency_value=data.frequency_value,
            start_date=data.start_date,
            from_date=data.start_date - timedelta(days=1),  # Include start_date
        )

        # Create plan
        now = now_utc().replace(tzinfo=None)
        plan = RecurringPlan(
            user_id=user_id,
            article_id=data.article_id,
            financial_center_id=data.financial_center_id,
            cost_center_id=data.cost_center_id,
            frequency_type=data.frequency_type,
            frequency_value=data.frequency_value,
            start_date=data.start_date,
            end_date=data.end_date,
            occurrences_count=data.occurrences_count,
            occurrences_generated=0,
            amount=data.amount,
            description=data.description,
            record_type=data.record_type,
            is_active=True,
            next_generation_date=next_date,
            last_generated_date=None,
            created_at=now,
            updated_at=now,
        )

        session.add(plan)
        await session.flush()  # Get plan.id

        # Generate initial facts (3 months ahead)
        generated_count = await self._generate_facts_for_plan(
            session=session,
            plan=plan,
            horizon_days=DEFAULT_GENERATION_HORIZON_DAYS,
        )

        await session.commit()
        await session.refresh(plan)

        logger.info(
            f"[RECURRING] Created plan {plan.id} for user {user_id}, "
            f"frequency={data.frequency_type}, generated {generated_count} facts"
        )

        return plan

    async def update_recurring_plan(
        self,
        session: AsyncSession,
        plan_id: int,
        data: RecurringPlanUpdate,
        user_id: int,
        regenerate_future: bool = False,
    ) -> RecurringPlan:
        """
        Update a recurring plan.

        Args:
            session: Database session
            plan_id: Plan ID
            data: Update data
            user_id: User ID (for validation)
            regenerate_future: If True, delete future facts and regenerate

        Returns:
            Updated RecurringPlan

        Raises:
            ValueError: If plan not found or doesn't belong to user
        """
        plan = await session.get(RecurringPlan, plan_id)
        if not plan:
            raise ValueError(f"Recurring plan with ID {plan_id} not found")

        if plan.user_id != user_id:
            raise ValueError("Plan does not belong to current user")

        # Update fields
        if data.amount is not None:
            plan.amount = data.amount

        if data.description is not None:
            plan.description = data.description if data.description else None

        if data.cost_center_id is not None:
            if data.cost_center_id > 0:
                cc = await session.get(CostCenter, data.cost_center_id)
                if not cc:
                    raise ValueError(f"Cost center with ID {data.cost_center_id} not found")
                plan.cost_center_id = data.cost_center_id
            else:
                plan.cost_center_id = None

        if data.end_date is not None:
            if data.end_date < plan.start_date:
                raise ValueError("End date must be on or after start date")
            plan.end_date = data.end_date

        if data.is_active is not None:
            plan.is_active = data.is_active
            if data.is_active:
                # Reactivating - recalculate next generation date
                today = now_local().date()
                plan.next_generation_date = self._calculate_next_occurrence(
                    frequency_type=plan.frequency_type,
                    frequency_value=plan.frequency_value,
                    start_date=plan.start_date,
                    from_date=today,
                )

        plan.updated_at = now_utc().replace(tzinfo=None)

        # Optionally regenerate future facts
        if regenerate_future and plan.is_active:
            await self._delete_future_facts(session, plan_id)
            await self._generate_facts_for_plan(
                session=session,
                plan=plan,
                horizon_days=DEFAULT_GENERATION_HORIZON_DAYS,
            )

        await session.commit()
        await session.refresh(plan)

        logger.info(f"[RECURRING] Updated plan {plan_id}")

        return plan

    async def deactivate_recurring_plan(
        self,
        session: AsyncSession,
        plan_id: int,
        user_id: int,
        delete_future_facts: bool = False,
    ) -> RecurringPlan:
        """
        Deactivate (soft delete) a recurring plan.

        Args:
            session: Database session
            plan_id: Plan ID
            user_id: User ID (for validation)
            delete_future_facts: If True, delete future generated facts

        Returns:
            Deactivated RecurringPlan

        Raises:
            ValueError: If plan not found or doesn't belong to user
        """
        plan = await session.get(RecurringPlan, plan_id)
        if not plan:
            raise ValueError(f"Recurring plan with ID {plan_id} not found")

        if plan.user_id != user_id:
            raise ValueError("Plan does not belong to current user")

        plan.is_active = False
        plan.next_generation_date = None
        plan.updated_at = now_utc().replace(tzinfo=None)

        if delete_future_facts:
            deleted_count = await self._delete_future_facts(session, plan_id)
            logger.info(f"[RECURRING] Deleted {deleted_count} future facts for plan {plan_id}")

        await session.commit()
        await session.refresh(plan)

        logger.info(f"[RECURRING] Deactivated plan {plan_id}")

        return plan

    async def get_recurring_plan(
        self,
        session: AsyncSession,
        plan_id: int,
        user_id: Optional[int] = None,
    ) -> Optional[RecurringPlan]:
        """
        Get recurring plan by ID.

        Args:
            session: Database session
            plan_id: Plan ID
            user_id: Optional user ID for validation

        Returns:
            RecurringPlan or None
        """
        plan = await session.get(RecurringPlan, plan_id)
        if plan and user_id and plan.user_id != user_id:
            return None
        return plan

    async def get_plan_with_details(
        self,
        session: AsyncSession,
        plan_id: int,
        user_id: int,
    ) -> Optional[dict]:
        """
        Get recurring plan with enriched details.

        Args:
            session: Database session
            plan_id: Plan ID
            user_id: User ID (for validation)

        Returns:
            Dict with plan details or None
        """
        plan = await self.get_recurring_plan(session, plan_id, user_id)
        if not plan:
            return None

        # Get related entities
        article = await session.get(Article, plan.article_id)
        fc = await session.get(FinancialCenter, plan.financial_center_id)
        cc = await session.get(CostCenter, plan.cost_center_id) if plan.cost_center_id else None

        return {
            "id": plan.id,
            "user_id": plan.user_id,
            "article_id": plan.article_id,
            "article_name": article.name if article else None,
            "article_type": article.article_type if article else None,
            "financial_center_id": plan.financial_center_id,
            "financial_center_name": fc.name if fc else None,
            "cost_center_id": plan.cost_center_id,
            "cost_center_name": cc.name if cc else None,
            "frequency_type": plan.frequency_type,
            "frequency_value": plan.frequency_value,
            "frequency_display": self._get_frequency_display(
                plan.frequency_type, plan.frequency_value
            ),
            "start_date": plan.start_date,
            "end_date": plan.end_date,
            "occurrences_count": plan.occurrences_count,
            "occurrences_generated": plan.occurrences_generated,
            "amount": plan.amount,
            "description": plan.description,
            "record_type": plan.record_type,
            "is_active": plan.is_active,
            "next_generation_date": plan.next_generation_date,
            "last_generated_date": plan.last_generated_date,
            "created_at": plan.created_at,
            "updated_at": plan.updated_at,
        }

    async def list_recurring_plans(
        self,
        session: AsyncSession,
        user_id: int,
        is_active: Optional[bool] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[dict], int]:
        """
        List recurring plans for a user.

        Args:
            session: Database session
            user_id: User ID
            is_active: Optional filter by active status
            skip: Pagination offset
            limit: Pagination limit

        Returns:
            Tuple of (list of plans with details, total count)
        """
        # Build base query
        base_query = select(RecurringPlan).where(RecurringPlan.user_id == user_id)

        if is_active is not None:
            base_query = base_query.where(RecurringPlan.is_active == is_active)

        # Get total count
        count_query = (
            select(sa_func.count())
            .select_from(RecurringPlan)
            .where(RecurringPlan.user_id == user_id)
        )
        if is_active is not None:
            count_query = count_query.where(RecurringPlan.is_active == is_active)

        count_result = await session.execute(count_query)
        total = count_result.scalar() or 0

        # Get paginated results with joins
        query = (
            select(RecurringPlan, Article, FinancialCenter)
            .outerjoin(Article, RecurringPlan.article_id == Article.id)
            .outerjoin(FinancialCenter, RecurringPlan.financial_center_id == FinancialCenter.id)
            .where(RecurringPlan.user_id == user_id)
        )

        if is_active is not None:
            query = query.where(RecurringPlan.is_active == is_active)

        query = (
            query
            .order_by(RecurringPlan.next_generation_date.asc().nullslast())
            .offset(skip)
            .limit(limit)
        )

        result = await session.execute(query)
        rows = result.all()

        # Build response
        items = []
        for plan, article, fc in rows:
            items.append({
                "id": plan.id,
                "user_id": plan.user_id,
                "article_id": plan.article_id,
                "article_name": article.name if article else None,
                "article_type": article.article_type if article else None,
                "financial_center_id": plan.financial_center_id,
                "financial_center_name": fc.name if fc else None,
                "cost_center_id": plan.cost_center_id,
                "cost_center_name": None,  # Skip extra query for list
                "frequency_type": plan.frequency_type,
                "frequency_value": plan.frequency_value,
                "frequency_display": self._get_frequency_display(
                    plan.frequency_type, plan.frequency_value
                ),
                "start_date": plan.start_date,
                "end_date": plan.end_date,
                "occurrences_count": plan.occurrences_count,
                "occurrences_generated": plan.occurrences_generated,
                "amount": plan.amount,
                "description": plan.description,
                "record_type": plan.record_type,
                "is_active": plan.is_active,
                "next_generation_date": plan.next_generation_date,
                "last_generated_date": plan.last_generated_date,
                "created_at": plan.created_at,
                "updated_at": plan.updated_at,
            })

        return items, total

    # =========================================================================
    # Fact Generation
    # =========================================================================

    async def generate_pending_facts(
        self,
        session: AsyncSession,
        horizon_days: int = DEFAULT_GENERATION_HORIZON_DAYS,
    ) -> int:
        """
        Generate pending facts for all active recurring plans.

        This is called by the scheduler job daily.

        Args:
            session: Database session
            horizon_days: How many days ahead to generate

        Returns:
            Total number of facts generated
        """
        today = now_local().date()

        # Get active plans that need generation
        statement = (
            select(RecurringPlan)
            .where(
                RecurringPlan.is_active == True,
                RecurringPlan.next_generation_date <= today + timedelta(days=horizon_days),
            )
        )

        result = await session.execute(statement)
        plans = list(result.scalars().all())

        total_generated = 0
        for plan in plans:
            try:
                count = await self._generate_facts_for_plan(
                    session=session,
                    plan=plan,
                    horizon_days=horizon_days,
                )
                total_generated += count
            except Exception as e:
                logger.error(f"[RECURRING] Error generating facts for plan {plan.id}: {e}")
                continue

        await session.commit()

        if total_generated > 0:
            logger.info(f"[RECURRING] Generated {total_generated} facts for {len(plans)} plans")

        return total_generated

    async def _generate_facts_for_plan(
        self,
        session: AsyncSession,
        plan: RecurringPlan,
        horizon_days: int,
    ) -> int:
        """
        Generate BudgetFact records for a single plan.

        Generates facts up to the earliest limit:
        - occurrences_count (if specified)
        - end_date (if specified)
        - horizon_date (today + horizon_days)

        Args:
            session: Database session
            plan: RecurringPlan to generate for
            horizon_days: How many days ahead to generate

        Returns:
            Number of facts generated
        """
        today = now_local().date()
        horizon_date = today + timedelta(days=horizon_days)
        generated_count = 0
        iteration = 0

        # Start from next_generation_date or calculate from start
        current_date = plan.next_generation_date or plan.start_date

        logger.info(
            f"[RECURRING] Starting fact generation for plan {plan.id}: "
            f"current_date={current_date}, horizon={horizon_date}, "
            f"end_date={plan.end_date}, occurrences={plan.occurrences_generated}/{plan.occurrences_count}"
        )

        while True:
            # Safety guard against infinite loops
            iteration += 1
            if iteration > MAX_ITERATIONS:
                logger.error(
                    f"[RECURRING] Plan {plan.id}: Hit MAX_ITERATIONS limit ({MAX_ITERATIONS})! "
                    f"Generated {generated_count} facts. Breaking loop."
                )
                break

            # Check end_date limit BEFORE creating fact
            if plan.end_date and current_date > plan.end_date:
                plan.is_active = False
                plan.next_generation_date = None
                logger.info(
                    f"[RECURRING] Plan {plan.id}: Reached end_date after {generated_count} facts"
                )
                break

            # Check occurrences_count limit BEFORE creating fact
            if plan.occurrences_count and plan.occurrences_generated >= plan.occurrences_count:
                plan.is_active = False
                plan.next_generation_date = None
                logger.info(
                    f"[RECURRING] Plan {plan.id}: Reached occurrences_count after {generated_count} facts"
                )
                break

            # Check horizon limit BEFORE creating fact (for ongoing plans)
            if current_date > horizon_date:
                logger.info(
                    f"[RECURRING] Plan {plan.id}: Reached horizon after {generated_count} facts"
                )
                break

            # Check if fact already exists for this date
            existing = await self._check_fact_exists(
                session=session,
                plan_id=plan.id,
                fact_date=current_date,
            )

            if existing:
                logger.debug(
                    f"[RECURRING] Plan {plan.id}: Fact already exists for {current_date}, skipping"
                )
            else:
                # Create fact
                fact = BudgetFact(
                    user_id=plan.user_id,
                    article_id=plan.article_id,
                    financial_center_id=plan.financial_center_id,
                    cost_center_id=plan.cost_center_id,
                    fact_date=current_date,
                    amount=plan.amount,
                    description=plan.description,
                    record_type=plan.record_type,
                    recurring_plan_id=plan.id,
                    is_offline_sync=False,
                    created_at=now_utc().replace(tzinfo=None),
                    updated_at=now_utc().replace(tzinfo=None),
                )
                session.add(fact)
                generated_count += 1
                plan.occurrences_generated += 1
                plan.last_generated_date = current_date

                logger.debug(
                    f"[RECURRING] Plan {plan.id}: Created fact for {current_date} (total: {generated_count})"
                )

            # Calculate next occurrence
            next_date = self._calculate_next_occurrence(
                frequency_type=plan.frequency_type,
                frequency_value=plan.frequency_value,
                start_date=plan.start_date,
                from_date=current_date,
            )

            if next_date is None or next_date <= current_date:
                # No more occurrences possible
                logger.warning(
                    f"[RECURRING] Plan {plan.id}: Cannot calculate next occurrence after {current_date}"
                )
                plan.is_active = False
                plan.next_generation_date = None
                break

            current_date = next_date
            plan.next_generation_date = next_date

        plan.updated_at = now_utc().replace(tzinfo=None)

        logger.info(
            f"[RECURRING] Plan {plan.id}: Generated {generated_count} facts, "
            f"next_generation_date={plan.next_generation_date}, is_active={plan.is_active}"
        )

        return generated_count

    async def _check_fact_exists(
        self,
        session: AsyncSession,
        plan_id: int,
        fact_date: date,
    ) -> bool:
        """Check if a fact already exists for this plan and date."""
        statement = (
            select(sa_func.count())
            .select_from(BudgetFact)
            .where(
                BudgetFact.recurring_plan_id == plan_id,
                BudgetFact.fact_date == fact_date,
            )
        )
        result = await session.execute(statement)
        count = result.scalar() or 0
        return count > 0

    async def _delete_future_facts(
        self,
        session: AsyncSession,
        plan_id: int,
    ) -> int:
        """Delete future generated facts for a plan."""
        today = now_local().date()

        statement = (
            select(BudgetFact)
            .where(
                BudgetFact.recurring_plan_id == plan_id,
                BudgetFact.fact_date > today,
            )
        )

        result = await session.execute(statement)
        facts = list(result.scalars().all())

        for fact in facts:
            await session.delete(fact)

        return len(facts)

    # =========================================================================
    # Date Calculation
    # =========================================================================

    def _calculate_next_occurrence(
        self,
        frequency_type: str,
        frequency_value: Optional[int],
        start_date: date,
        from_date: date,
    ) -> Optional[date]:
        """
        Calculate the next occurrence date after from_date.

        Args:
            frequency_type: daily, weekly, monthly, quarterly
            frequency_value: Day value (weekday 0-6 or monthday 1-28)
            start_date: Plan start date
            from_date: Calculate next date after this

        Returns:
            Next occurrence date or None if not possible
        """
        if frequency_type == "daily":
            return from_date + timedelta(days=1)

        elif frequency_type == "weekly":
            # frequency_value is weekday (0=Mon, 6=Sun)
            target_weekday = frequency_value or 0
            days_ahead = target_weekday - from_date.weekday()
            if days_ahead <= 0:
                days_ahead += 7
            return from_date + timedelta(days=days_ahead)

        elif frequency_type == "monthly":
            # frequency_value is day of month (1-28)
            target_day = frequency_value or 1
            next_month = from_date.replace(day=1) + timedelta(days=32)
            next_month = next_month.replace(day=1)  # First of next month

            # Try target day in next month
            try:
                result = next_month.replace(day=target_day)
            except ValueError:
                # Day doesn't exist (e.g., Feb 30) - use last day
                next_next = next_month + timedelta(days=32)
                next_next = next_next.replace(day=1) - timedelta(days=1)
                result = next_next

            # If from_date is before target day this month, use this month
            if from_date.day < target_day:
                try:
                    this_month = from_date.replace(day=target_day)
                    if this_month > from_date:
                        result = this_month
                except ValueError:
                    pass  # Keep next month result

            return result

        elif frequency_type == "quarterly":
            # frequency_value is day of month (1-28)
            target_day = frequency_value or 1

            # Find next quarter month
            current_month = from_date.month
            current_year = from_date.year

            # Quarter months: 1, 4, 7, 10
            quarter_months = [1, 4, 7, 10]
            next_quarter_month = None

            for qm in quarter_months:
                if qm > current_month or (qm == current_month and from_date.day < target_day):
                    next_quarter_month = qm
                    break

            if next_quarter_month is None:
                # Next year
                next_quarter_month = 1
                current_year += 1

            try:
                return date(current_year, next_quarter_month, target_day)
            except ValueError:
                # Day doesn't exist - use last day of month
                if next_quarter_month == 12:
                    last_day = date(current_year + 1, 1, 1) - timedelta(days=1)
                else:
                    last_day = date(current_year, next_quarter_month + 1, 1) - timedelta(days=1)
                return last_day

        return None

    def _get_frequency_display(
        self,
        frequency_type: str,
        frequency_value: Optional[int],
    ) -> str:
        """Get human-readable frequency description."""
        weekdays = ["понедельник", "вторник", "среду", "четверг", "пятницу", "субботу", "воскресенье"]

        if frequency_type == "daily":
            return "Ежедневно"

        elif frequency_type == "weekly":
            day_name = weekdays[frequency_value or 0]
            return f"Каждую {day_name}"

        elif frequency_type == "monthly":
            day = frequency_value or 1
            return f"Каждое {day}-е число месяца"

        elif frequency_type == "quarterly":
            day = frequency_value or 1
            return f"Каждое {day}-е число квартала"

        return frequency_type

    # =========================================================================
    # Detach Fact from Plan
    # =========================================================================

    async def detach_fact_from_plan(
        self,
        session: AsyncSession,
        fact_id: int,
        fact_date: date,
        user_id: int,
    ) -> BudgetFact:
        """
        Detach a fact from its recurring plan.

        Sets recurring_plan_id to NULL so the fact becomes standalone.

        Args:
            session: Database session
            fact_id: Fact ID
            fact_date: Fact date (for partitioned table)
            user_id: User ID (for validation)

        Returns:
            Updated BudgetFact

        Raises:
            ValueError: If fact not found or doesn't belong to user
        """
        # For partitioned tables, need to query by both id and fact_date
        statement = (
            select(BudgetFact)
            .where(
                BudgetFact.id == fact_id,
                BudgetFact.fact_date == fact_date,
            )
        )
        result = await session.execute(statement)
        fact = result.scalar_one_or_none()

        if not fact:
            raise ValueError(f"Fact with ID {fact_id} not found")

        if fact.user_id != user_id:
            raise ValueError("Fact does not belong to current user")

        if not fact.recurring_plan_id:
            raise ValueError("Fact is not linked to a recurring plan")

        # Detach
        plan_id = fact.recurring_plan_id
        fact.recurring_plan_id = None
        fact.updated_at = now_utc().replace(tzinfo=None)

        # Decrease occurrences_generated in plan
        plan = await session.get(RecurringPlan, plan_id)
        if plan and plan.occurrences_generated > 0:
            plan.occurrences_generated -= 1
            plan.updated_at = now_utc().replace(tzinfo=None)

        await session.commit()
        await session.refresh(fact)

        logger.info(f"[RECURRING] Detached fact {fact_id} from plan {plan_id}")

        return fact

    # =========================================================================
    # Statistics
    # =========================================================================

    async def get_stats(
        self,
        session: AsyncSession,
        user_id: int,
    ) -> dict:
        """
        Get recurring plan statistics for dashboard.

        Args:
            session: Database session
            user_id: User ID

        Returns:
            Dict with statistics
        """
        today = now_local().date()

        # Active count
        active_result = await session.execute(
            select(sa_func.count())
            .select_from(RecurringPlan)
            .where(
                RecurringPlan.user_id == user_id,
                RecurringPlan.is_active == True,
            )
        )
        active_count = active_result.scalar() or 0

        # Paused count
        paused_result = await session.execute(
            select(sa_func.count())
            .select_from(RecurringPlan)
            .where(
                RecurringPlan.user_id == user_id,
                RecurringPlan.is_active == False,
            )
        )
        paused_count = paused_result.scalar() or 0

        # Total monthly amount (approximate for non-monthly frequencies)
        monthly_result = await session.execute(
            select(sa_func.sum(RecurringPlan.amount))
            .where(
                RecurringPlan.user_id == user_id,
                RecurringPlan.is_active == True,
                RecurringPlan.frequency_type == "monthly",
            )
        )
        monthly_sum = monthly_result.scalar() or Decimal("0")

        # Next pending today
        pending_result = await session.execute(
            select(sa_func.count())
            .select_from(RecurringPlan)
            .where(
                RecurringPlan.user_id == user_id,
                RecurringPlan.is_active == True,
                RecurringPlan.next_generation_date <= today,
            )
        )
        next_pending = pending_result.scalar() or 0

        return {
            "active_count": active_count,
            "paused_count": paused_count,
            "total_monthly_amount": monthly_sum,
            "next_pending_count": next_pending,
        }
