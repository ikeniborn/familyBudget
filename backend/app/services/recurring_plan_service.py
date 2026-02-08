"""
Recurring Plan Service for scheduled payment management.

Handles CRUD operations for recurring plans and automatic generation
of BudgetFact records based on frequency settings.
"""
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import and_, case, or_
from sqlalchemy import func as sa_func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.logging import get_logger
from backend.app.models.article import Article
from backend.app.models.cost_center import CostCenter
from backend.app.models.fact import BudgetFact
from backend.app.models.financial_center import FinancialCenter
from backend.app.models.recurring_plan import RecurringPlan
from backend.app.models.scheduled_reminder import ScheduledReminder
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


def _parse_date_safe(date_str: str, field_name: str) -> date:
    """
    Safely parse date string to date object with validation.

    Args:
        date_str: Date string in YYYY-MM-DD format
        field_name: Field name for error message (e.g., "from_date", "to_date")

    Returns:
        date: Parsed date object

    Raises:
        HTTPException: 422 if date format is invalid
    """
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError as e:
        logger.warning(
            f"[RECURRING_PLAN] Invalid {field_name} format: {date_str}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=422,
            detail=f"Invalid {field_name} format. Use YYYY-MM-DD (e.g., 2025-11-09)",
        ) from e


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
            enable_reminder=data.enable_reminder,
            reminder_hour=data.reminder_hour,
            reminder_minute=data.reminder_minute,
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

        # Create reminders for generated facts (if enabled)
        reminders_created = 0
        if generated_count > 0:
            # Get IDs of newly generated facts
            facts_stmt = select(BudgetFact.id).where(
                BudgetFact.recurring_plan_id == plan.id
            ).order_by(BudgetFact.fact_date)
            facts_result = await session.execute(facts_stmt)
            fact_ids = list(facts_result.scalars().all())

            reminders_created = await self._create_reminders_for_facts(
                session=session,
                recurring_plan=plan,
                fact_ids=fact_ids,
            )

        await session.commit()
        await session.refresh(plan)

        logger.info(
            f"[RECURRING] Created plan {plan.id} for user {user_id}, "
            f"frequency={data.frequency_type}, generated {generated_count} facts, "
            f"created {reminders_created} reminders"
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
        user_id: int | None = None,
    ) -> RecurringPlan | None:
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
    ) -> dict | None:
        """
        Get recurring plan with enriched details (optimized with JOIN).

        **Optimization (v6.6.0):** Uses single JOIN query instead of 4 separate queries.
        Performance: 4 queries → 1 query (75% reduction).

        Args:
            session: Database session
            plan_id: Plan ID
            user_id: User ID (for validation)

        Returns:
            Dict with plan details or None
        """
        # ✅ OPTIMIZATION: Single JOIN query instead of 4 separate queries
        stmt = (
            select(
                RecurringPlan,
                Article.name.label("article_name"),
                Article.type.label("article_type"),
                FinancialCenter.name.label("fc_name"),
                CostCenter.name.label("cc_name"),
            )
            .join(Article, RecurringPlan.article_id == Article.id)
            .join(FinancialCenter, RecurringPlan.financial_center_id == FinancialCenter.id)
            .outerjoin(CostCenter, RecurringPlan.cost_center_id == CostCenter.id)  # nullable
            .where(RecurringPlan.id == plan_id, RecurringPlan.user_id == user_id)
        )

        result = await session.execute(stmt)
        row = result.one_or_none()

        if not row:
            logger.debug(f"[QUERY_OPT] get_plan_with_details: plan_id={plan_id} not found or access denied")
            return None

        plan = row[0]
        logger.info(f"[QUERY_OPT] get_plan_with_details: plan_id={plan_id}, single JOIN (4→1 queries)")

        return {
            "id": plan.id,
            "user_id": plan.user_id,
            "article_id": plan.article_id,
            "article_name": row.article_name,
            "article_type": row.article_type,
            "financial_center_id": plan.financial_center_id,
            "financial_center_name": row.fc_name,
            "cost_center_id": plan.cost_center_id,
            "cost_center_name": row.cc_name,
            "frequency_type": plan.frequency_type,
            "frequency_value": plan.frequency_value,
            "frequency_display": self._get_frequency_display(
                plan.frequency_type, plan.frequency_value
            ),
            "start_date": plan.start_date,
            "end_date": plan.end_date,
            "occurrences_count": plan.occurrences_count,
            "occurrences_generated": plan.occurrences_generated,
            "amount": float(plan.amount),
            "description": plan.description,
            "record_type": plan.record_type,
            "is_active": plan.is_active,
            "next_generation_date": plan.next_generation_date,
            "last_generated_date": plan.last_generated_date,
            "created_at": plan.created_at,
            "updated_at": plan.updated_at,
            "enable_reminder": plan.enable_reminder,
            "reminder_hour": plan.reminder_hour,
            "reminder_minute": plan.reminder_minute,
        }

    async def list_recurring_plans(
        self,
        session: AsyncSession,
        user_id: int,
        is_active: bool | None = None,
        from_date: str | None = None,
        to_date: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[dict], int]:
        """
        List recurring plans for a user.

        Args:
            session: Database session
            user_id: User ID
            is_active: Optional filter by active status
            from_date: Filter by next_generation_date >= from_date (YYYY-MM-DD)
            to_date: Filter by next_generation_date <= to_date (YYYY-MM-DD)
            skip: Pagination offset
            limit: Pagination limit

        Returns:
            Tuple of (list of plans with details, total count)
        """
        # Build base query
        base_query = select(RecurringPlan).where(RecurringPlan.user_id == user_id)

        if is_active is not None:
            base_query = base_query.where(RecurringPlan.is_active == is_active)

        # Date filtering (v11.4.12+) - include NULL for completed/inactive plans
        if from_date:
            from_date_obj = _parse_date_safe(from_date, "from_date")
            base_query = base_query.where(
                or_(
                    RecurringPlan.next_generation_date >= from_date_obj,
                    RecurringPlan.next_generation_date.is_(None)
                )
            )
        if to_date:
            to_date_obj = _parse_date_safe(to_date, "to_date")
            base_query = base_query.where(
                or_(
                    RecurringPlan.next_generation_date <= to_date_obj,
                    RecurringPlan.next_generation_date.is_(None)
                )
            )

        # Get total count
        count_query = (
            select(sa_func.count())
            .select_from(RecurringPlan)
            .where(RecurringPlan.user_id == user_id)
        )
        if is_active is not None:
            count_query = count_query.where(RecurringPlan.is_active == is_active)
        if from_date:
            from_date_obj = _parse_date_safe(from_date, "from_date")
            count_query = count_query.where(
                or_(
                    RecurringPlan.next_generation_date >= from_date_obj,
                    RecurringPlan.next_generation_date.is_(None)
                )
            )
        if to_date:
            to_date_obj = _parse_date_safe(to_date, "to_date")
            count_query = count_query.where(
                or_(
                    RecurringPlan.next_generation_date <= to_date_obj,
                    RecurringPlan.next_generation_date.is_(None)
                )
            )

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
        if from_date:
            from_date_obj = _parse_date_safe(from_date, "from_date")
            query = query.where(
                or_(
                    RecurringPlan.next_generation_date >= from_date_obj,
                    RecurringPlan.next_generation_date.is_(None)
                )
            )
        if to_date:
            to_date_obj = _parse_date_safe(to_date, "to_date")
            query = query.where(
                or_(
                    RecurringPlan.next_generation_date <= to_date_obj,
                    RecurringPlan.next_generation_date.is_(None)
                )
            )

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
                "article_type": article.type if article else None,
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
                "amount": float(plan.amount),
                "description": plan.description,
                "record_type": plan.record_type,
                "is_active": plan.is_active,
                "enable_reminder": plan.enable_reminder,
                "reminder_hour": plan.reminder_hour,
                "reminder_minute": plan.reminder_minute,
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
    ) -> dict:
        """
        Generate pending facts for all active recurring plans.

        This is called by the scheduler job daily.

        Args:
            session: Database session
            horizon_days: How many days ahead to generate

        Returns:
            Dict with metadata:
            - facts_created: Total number of facts generated
            - plans_processed: Number of plans that were processed
            - reminders_created: Number of reminders created
        """
        today = now_local().date()

        # Get active plans that need generation
        statement = (
            select(RecurringPlan)
            .where(
                RecurringPlan.is_active,
                RecurringPlan.next_generation_date <= today + timedelta(days=horizon_days),
            )
        )

        result = await session.execute(statement)
        plans = list(result.scalars().all())

        total_generated = 0
        total_reminders_created = 0
        for plan in plans:
            try:
                new_generated = await self._generate_facts_for_plan(
                    session=session,
                    plan=plan,
                    horizon_days=horizon_days,
                )
                total_generated += new_generated

                # Create reminders for newly generated facts (if enabled)
                if new_generated > 0:
                    # Get IDs of facts generated in this iteration
                    # Use last_generated_date as reference (facts >= last_generated_date are new)
                    facts_stmt = select(BudgetFact.id).where(
                        BudgetFact.recurring_plan_id == plan.id,
                        BudgetFact.fact_date >= plan.last_generated_date  # Only new facts
                    ).order_by(BudgetFact.fact_date)
                    facts_result = await session.execute(facts_stmt)
                    new_fact_ids = list(facts_result.scalars().all())

                    reminders_created = await self._create_reminders_for_facts(
                        session=session,
                        recurring_plan=plan,
                        fact_ids=new_fact_ids,
                    )
                    total_reminders_created += reminders_created

                    logger.info(
                        f"[SCHEDULER] Plan {plan.id}: generated {new_generated} facts, "
                        f"created {reminders_created} reminders"
                    )

            except Exception as e:
                logger.error(f"[RECURRING] Error generating facts for plan {plan.id}: {e}")
                continue

        await session.commit()

        if total_generated > 0:
            logger.info(
                f"[RECURRING] Generated {total_generated} facts for {len(plans)} plans, "
                f"created {total_reminders_created} reminders"
            )

        return {
            "facts_created": total_generated,
            "plans_processed": len(plans),
            "reminders_created": total_reminders_created,
        }

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

            # Check horizon limit ONLY for unbounded plans (no end_date and no occurrences_count)
            # Bounded plans should generate ALL facts regardless of horizon
            is_unbounded = (plan.end_date is None and plan.occurrences_count is None)
            if is_unbounded and current_date > horizon_date:
                logger.info(
                    f"[RECURRING] Plan {plan.id}: Reached horizon after {generated_count} facts (unbounded plan)"
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

    async def _create_reminders_for_facts(
        self,
        session: AsyncSession,
        recurring_plan: RecurringPlan,
        fact_ids: list[int],
    ) -> int:
        """
        Create scheduled reminders for generated facts (if enable_reminder=true).

        **Optimization (v6.6.0):** Uses batch existence check (1 query) instead of
        checking each fact individually (N queries). Performance: N queries → 1 query
        (99% reduction for 100 facts).

        Args:
            session: Database session
            recurring_plan: Recurring plan with reminder settings
            fact_ids: List of BudgetFact IDs to create reminders for

        Returns:
            Number of reminders created

        Notes:
            - Skips facts in the past (fact_date < today)
            - Skips if reminder datetime <= now (already passed)
            - Idempotent: skips if reminder already exists for fact
            - Reminder datetime = fact_date + reminder_hour:minute
        """
        if not recurring_plan.enable_reminder:
            logger.info(f"[RECURRING_REMINDER] Plan {recurring_plan.id}: enable_reminder=false, skipping")
            return 0

        if recurring_plan.reminder_hour is None or recurring_plan.reminder_minute is None:
            logger.warning(
                f"[RECURRING_REMINDER] Plan {recurring_plan.id} has enable_reminder=true "
                f"but no time set (hour={recurring_plan.reminder_hour}, minute={recurring_plan.reminder_minute})"
            )
            return 0

        # Get facts
        facts_stmt = select(BudgetFact).where(BudgetFact.id.in_(fact_ids))
        facts_result = await session.execute(facts_stmt)
        facts = list(facts_result.scalars().all())

        # ✅ OPTIMIZATION: Batch check existing reminders (1 query instead of N)
        existing_stmt = select(ScheduledReminder.fact_id).where(
            ScheduledReminder.fact_id.in_(fact_ids)
        )
        existing_result = await session.execute(existing_stmt)
        existing_fact_ids = set(existing_result.scalars().all())

        logger.info(
            f"[QUERY_OPT] _create_reminders_for_facts: "
            f"batched existence check for {len(fact_ids)} facts, found {len(existing_fact_ids)} existing"
        )

        logger.info(
            f"[RECURRING_REMINDER] Plan {recurring_plan.id}: Processing {len(facts)} facts "
            f"for reminder creation (time: {recurring_plan.reminder_hour:02d}:{recurring_plan.reminder_minute:02d})"
        )

        created_count = 0
        skipped_past = 0
        skipped_existing = 0
        skipped_passed = 0
        now_date = now_local().date()
        now_datetime = now_local().replace(tzinfo=None)

        for fact in facts:
            # Skip past facts
            if fact.fact_date < now_date:
                skipped_past += 1
                continue

            # Calculate reminder datetime (naive, in SYSTEM_TIMEZONE)
            reminder_datetime = datetime.combine(
                fact.fact_date,
                time(hour=recurring_plan.reminder_hour, minute=recurring_plan.reminder_minute)
            )

            # Skip if reminder already passed
            if reminder_datetime <= now_datetime:
                skipped_passed += 1
                logger.debug(
                    f"[RECURRING_REMINDER] Fact {fact.id}: reminder {reminder_datetime} already passed, skipping"
                )
                continue

            # Check if reminder already exists (idempotency - pre-fetched set)
            if fact.id in existing_fact_ids:
                skipped_existing += 1
                logger.debug(f"[RECURRING_REMINDER] Fact {fact.id}: reminder already exists, skipping")
                continue

            # Create reminder
            reminder = ScheduledReminder(
                fact_id=fact.id,
                reminder_datetime=reminder_datetime,
                status="pending",
                created_at=now_utc().replace(tzinfo=None),
                updated_at=now_utc().replace(tzinfo=None),
            )
            session.add(reminder)
            created_count += 1

            logger.info(
                f"[RECURRING_REMINDER] Created reminder for fact {fact.id} "
                f"(fact_date={fact.fact_date}, reminder_datetime={reminder_datetime})"
            )

        await session.flush()

        logger.info(
            f"[RECURRING_REMINDER] Plan {recurring_plan.id}: Created {created_count} reminders "
            f"(skipped: {skipped_past} past, {skipped_existing} existing, {skipped_passed} passed)"
        )

        return created_count

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
        frequency_value: int | None,
        start_date: date,
        from_date: date,
    ) -> date | None:
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

        elif frequency_type == "yearly":
            # frequency_value is MMDD format (e.g., 315 = March 15)
            # Decode month and day
            target_month = frequency_value // 100
            target_day = frequency_value % 100

            logger.info(
                f"[CALC_NEXT] Yearly: decoded frequency_value={frequency_value} → "
                f"month={target_month}, day={target_day}, from_date={from_date}"
            )

            # Calculate next occurrence
            next_year = from_date.year

            # If we already passed this date this year, use next year
            if (from_date.month, from_date.day) >= (target_month, target_day):
                next_year += 1

            next_date = date(next_year, target_month, target_day)

            logger.info(f"[CALC_NEXT] Yearly: {from_date} → {next_date}")
            return next_date

        return None

    def _get_frequency_display(
        self,
        frequency_type: str,
        frequency_value: int | None,
    ) -> str:
        """Get human-readable frequency description."""
        if frequency_type == "monthly":
            day = frequency_value or 1
            return f"Каждое {day}-е число месяца"

        elif frequency_type == "quarterly":
            day = frequency_value or 1
            return f"Каждое {day}-е число квартала"

        elif frequency_type == "yearly":
            if not frequency_value:
                return "Ежегодно"

            # Decode MMDD format
            month = frequency_value // 100
            day = frequency_value % 100

            month_names = ["января", "февраля", "марта", "апреля", "мая", "июня",
                           "июля", "августа", "сентября", "октября", "ноября", "декабря"]
            month_name = month_names[month - 1] if 1 <= month <= 12 else str(month)

            return f"Ежегодно, {day} {month_name}"

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

        **Optimization (v6.6.0):** Uses single aggregation query with conditional filters
        instead of 4 separate queries. Performance: 4 queries → 1 query (75% reduction).

        Args:
            session: Database session
            user_id: User ID

        Returns:
            Dict with statistics:
            - active_count: Number of active plans
            - paused_count: Number of paused plans
            - total_monthly_amount: Sum of monthly plan amounts
            - next_pending_count: Number of plans ready for generation
        """
        today = now_local().date()

        # ✅ OPTIMIZATION: Single aggregation query with conditional filters (4→1 queries)
        stmt = select(
            sa_func.count().filter(RecurringPlan.is_active).label("active_count"),
            sa_func.count().filter(not RecurringPlan.is_active).label("paused_count"),
            sa_func.sum(
                case(
                    (
                        and_(
                            RecurringPlan.frequency_type == "monthly",
                            RecurringPlan.is_active
                        ),
                        RecurringPlan.amount
                    ),
                    else_=Decimal("0")
                )
            ).label("monthly_sum"),
            sa_func.count().filter(
                and_(
                    RecurringPlan.is_active,
                    RecurringPlan.next_generation_date <= today
                )
            ).label("pending_count"),
        ).where(RecurringPlan.user_id == user_id)

        result = await session.execute(stmt)
        row = result.one()

        logger.info(
            f"[QUERY_OPT] get_stats: user_id={user_id}, single aggregation "
            f"(4→1 queries), active={row.active_count}, paused={row.paused_count}, "
            f"monthly_sum={row.monthly_sum}, pending={row.pending_count}"
        )

        return {
            "active_count": row.active_count or 0,
            "paused_count": row.paused_count or 0,
            "total_monthly_amount": row.monthly_sum or Decimal("0"),
            "next_pending_count": row.pending_count or 0,
        }
