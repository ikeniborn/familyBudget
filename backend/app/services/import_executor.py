"""
Import Executor Service

Handles execution of import from staging to BudgetFact.
Converts staging records to budget facts with proper validation and error handling.
"""

import logging
from datetime import datetime
from decimal import Decimal, InvalidOperation

from sqlalchemy.exc import IntegrityError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.models.fact import BudgetFact
from backend.app.models.import_staging import ImportStaging

logger = logging.getLogger(__name__)


class ImportExecutor:
    """
    Service for executing import from staging to BudgetFact.

    Workflow:
    1. Get selected staging records (is_selected=True)
    2. Validate required fields (article_id, financial_center_id)
    3. Convert amount from string to Decimal
    4. Create BudgetFact records
    5. Commit transaction
    6. Return summary (success/failed counts + errors)
    """

    @staticmethod
    def parse_amount(amount_str: str) -> Decimal:
        """
        Parse amount string to Decimal.

        Supports multiple formats (after normalization by GenericCSVParser):
        - Normalized format: "-1234.56" (dot as decimal separator, no thousand separators)
        - Russian format: "+500,00" or "-900,00" (comma as decimal separator) - legacy
        - International: "+500.00" or "-900.00" (dot as decimal separator)
        - With spaces: "-1 234,56" (space as thousand separator) - legacy

        The GenericCSVParser._normalize_amount() should have already converted
        amounts to normalized format (dot decimal, no thousand separators).
        This method handles both normalized and legacy formats for backward compatibility.

        Args:
            amount_str: Amount string from staging (e.g., "-900.00" or "-900,00")

        Returns:
            Decimal with sign preserved

        Raises:
            ValueError: If amount cannot be parsed
        """
        try:
            cleaned = amount_str.strip()

            # Remove spaces (thousand separator for Russian format)
            cleaned = cleaned.replace(" ", "")

            # Count dots and commas to determine format
            dots = cleaned.count('.')
            commas = cleaned.count(',')

            if dots == 1 and commas == 0:
                # Standard format with dot decimal: "1234.56" or "-1234.56"
                return Decimal(cleaned)

            elif dots == 0 and commas == 1:
                # Russian format with comma decimal: "1234,56" or "-1234,56"
                return Decimal(cleaned.replace(",", "."))

            elif dots >= 1 and commas == 1:
                # Check position: if comma is after last dot, it's DE format
                last_dot = cleaned.rfind('.')
                last_comma = cleaned.rfind(',')

                if last_comma > last_dot:
                    # German format: 1.234,56
                    cleaned = cleaned.replace(".", "")
                    cleaned = cleaned.replace(",", ".")
                    return Decimal(cleaned)
                else:
                    # US format with extra dots (unlikely): 1,234.56.78
                    cleaned = cleaned.replace(",", "")
                    return Decimal(cleaned)

            elif commas >= 1 and dots == 1:
                # US format: 1,234.56
                last_dot = cleaned.rfind('.')
                last_comma = cleaned.rfind(',')

                if last_dot > last_comma:
                    # Dot is decimal separator: 1,234.56
                    cleaned = cleaned.replace(",", "")
                    return Decimal(cleaned)
                else:
                    # Comma is decimal separator (unlikely): 1.234,56
                    cleaned = cleaned.replace(".", "")
                    cleaned = cleaned.replace(",", ".")
                    return Decimal(cleaned)

            elif dots == 0 and commas >= 1:
                # Multiple commas as thousands separators: 1,234,567
                cleaned = cleaned.replace(",", "")
                return Decimal(cleaned)

            elif commas == 0 and dots >= 1:
                # Multiple dots as thousands separators: 1.234.567
                cleaned = cleaned.replace(".", "")
                return Decimal(cleaned)

            elif dots == 0 and commas == 0:
                # No separators: "1234" or "-1234"
                return Decimal(cleaned)

            else:
                # Fallback: try as-is
                return Decimal(cleaned)

        except (InvalidOperation, ValueError) as e:
            raise ValueError(f"Invalid amount format: {amount_str}") from e

    @staticmethod
    def validate_staging_record(record: ImportStaging) -> tuple[bool, str]:
        """
        Validate staging record before import.

        Checks:
        - article_id is assigned
        - financial_center_id is assigned
        - amount can be parsed

        Args:
            record: ImportStaging record to validate

        Returns:
            Tuple of (is_valid, error_message)
            - is_valid: True if record is valid
            - error_message: Empty string if valid, error description if invalid
        """
        # Check article_id (required)
        if not record.article_id:
            return False, "Missing article_id (category not assigned)"

        # Check financial_center_id (required)
        if not record.financial_center_id:
            return False, "Missing financial_center_id (CFO not assigned)"

        # Check amount can be parsed
        try:
            ImportExecutor.parse_amount(record.amount_string)
        except ValueError as e:
            return False, f"Invalid amount: {e}"

        return True, ""

    @staticmethod
    async def execute_import(
        session: AsyncSession,
        user_id: int,
        selected_only: bool = True
    ) -> tuple[int, int, list[str]]:
        """
        Execute import from staging to BudgetFact.

        Args:
            session: Async database session
            user_id: User ID who is executing the import
            selected_only: If True, import only records with is_selected=True

        Returns:
            Tuple of (success_count, failed_count, error_messages)
            - success_count: Number of successfully imported records
            - failed_count: Number of failed records
            - error_messages: List of error descriptions

        Note:
            Each record is processed independently. If one fails, others still succeed.
            This is intentional to allow partial imports.
        """
        logger.info(
            f"Starting import execution for user {user_id}, selected_only={selected_only}"
        )

        # Get staging records
        stmt = select(ImportStaging).where(
            ImportStaging.user_id == user_id
        )
        if selected_only:
            stmt = stmt.where(ImportStaging.is_selected == True)  # noqa: E712

        result = await session.execute(stmt)
        staging_records = result.scalars().all()

        if not staging_records:
            logger.info(f"No staging records to import for user {user_id}")
            return 0, 0, []

        logger.info(f"Found {len(staging_records)} staging records to import")

        success_count = 0
        failed_count = 0
        error_messages: list[str] = []

        # Process each record
        for record in staging_records:
            try:
                # Validate record
                is_valid, error_msg = ImportExecutor.validate_staging_record(record)
                if not is_valid:
                    failed_count += 1
                    error_messages.append(
                        f"Staging ID {record.id}: {error_msg}"
                    )
                    logger.warning(
                        f"Validation failed for staging {record.id}: {error_msg}"
                    )
                    continue

                # Parse amount and ensure it's positive
                amount = ImportExecutor.parse_amount(record.amount_string)
                amount = abs(amount)  # Always store as positive

                # Build description: concatenate CSV description + budget_description
                description = record.description or ""
                if record.budget_description:
                    if description:
                        description = f"{description} ({record.budget_description})"
                    else:
                        description = record.budget_description

                # Create BudgetFact
                fact = BudgetFact(
                    user_id=user_id,
                    article_id=record.article_id,
                    financial_center_id=record.financial_center_id,
                    cost_center_id=record.cost_center_id,
                    fact_date=record.fact_date,
                    amount=amount,
                    description=description,
                    record_type="fact",
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                )

                session.add(fact)
                success_count += 1
                logger.debug(f"Created BudgetFact from staging {record.id}")

            except IntegrityError as e:
                failed_count += 1
                error_messages.append(
                    f"Staging ID {record.id}: Database integrity error - {str(e.orig)}"
                )
                logger.error(
                    f"Integrity error for staging {record.id}: {e}",
                    exc_info=True
                )
                await session.rollback()

            except Exception as e:
                failed_count += 1
                error_messages.append(
                    f"Staging ID {record.id}: Unexpected error - {str(e)}"
                )
                logger.error(
                    f"Unexpected error for staging {record.id}: {e}",
                    exc_info=True
                )

        # Commit all successful inserts
        try:
            await session.commit()
            logger.info(
                f"Import completed: {success_count} success, {failed_count} failed"
            )
        except Exception as e:
            await session.rollback()
            logger.error(f"Failed to commit import transaction: {e}", exc_info=True)
            # All records failed
            return 0, len(staging_records), [f"Transaction commit failed: {str(e)}"]

        return success_count, failed_count, error_messages

    @staticmethod
    async def cleanup_staging(
        session: AsyncSession,
        user_id: int,
        selected_only: bool = True
    ) -> int:
        """
        Delete staging records after successful import.

        Args:
            session: Async database session
            user_id: User ID who is cleaning up
            selected_only: If True, delete only records with is_selected=True

        Returns:
            Number of deleted records
        """
        logger.info(
            f"Cleaning up staging for user {user_id}, selected_only={selected_only}"
        )

        # Get staging records to delete
        stmt = select(ImportStaging).where(
            ImportStaging.user_id == user_id
        )
        if selected_only:
            stmt = stmt.where(ImportStaging.is_selected == True)  # noqa: E712

        result = await session.execute(stmt)
        records = result.scalars().all()

        deleted_count = len(records)

        # Delete records
        for record in records:
            await session.delete(record)

        await session.commit()

        logger.info(f"Deleted {deleted_count} staging records for user {user_id}")

        return deleted_count
