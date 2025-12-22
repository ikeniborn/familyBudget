"""
Mapping Service

Service for managing column mappings (CSV column → budget field).
Mappings are shared per bank (one mapping per bank, used by all users).
Supports SCD Type 1 (in-place updates) and default mappings for known banks.

Pattern: Service layer (business logic)
"""

from datetime import datetime

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.models.import_column_mapping import ImportColumnMapping


class MappingService:
    """
    Service for managing column mappings (shared per bank).

    Provides:
    - Get saved mapping for bank (shared across all users)
    - Save/update mapping (SCD Type 1 - in-place update)
    - Get default mapping for known banks

    NOTE: Mappings are shared per bank, not per user. user_id is only used
    to track who last updated the mapping (informational).

    Examples:
        # Get saved mapping (shared for all users)
        >>> mapping = await MappingService.get_mapping(session, bank_provider_id=1)
        >>> mapping.mapping
        {'fact_date': 'Дата операции', 'amount': 'Сумма операции'}

        # Save new mapping (updates shared mapping, records who updated)
        >>> mapping = await MappingService.save_mapping(
        ...     session, bank_provider_id=1, user_id=123,
        ...     mapping={'fact_date': 'Date', 'amount': 'Amount'}
        ... )

        # Get default mapping
        >>> default = MappingService.get_default_mapping('tinkoff')
        >>> default['fact_date']
        'Дата операции'
    """

    @staticmethod
    async def get_mapping(
        session: AsyncSession,
        bank_provider_id: int
    ) -> ImportColumnMapping | None:
        """
        Get saved mapping for bank (shared across all users).

        Args:
            session: AsyncSession for database operations
            bank_provider_id: Bank provider ID

        Returns:
            ImportColumnMapping record or None if not found

        Examples:
            >>> mapping = await MappingService.get_mapping(session, 1)
            >>> mapping.mapping
            {'fact_date': 'Дата операции', 'amount': 'Сумма операции'}
        """
        stmt = select(ImportColumnMapping).where(
            ImportColumnMapping.bank_provider_id == bank_provider_id
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def save_mapping(
        session: AsyncSession,
        bank_provider_id: int,
        user_id: int,
        mapping: dict,
        transformations: dict | None = None
    ) -> ImportColumnMapping:
        """
        Save or update mapping (SCD Type 1, shared per bank).

        If mapping exists for this bank → UPDATE in-place (update user_id to track who updated)
        If mapping doesn't exist → INSERT new record

        Args:
            session: AsyncSession for database operations
            bank_provider_id: Bank provider ID
            user_id: User ID (who is saving/updating - informational only)
            mapping: Column mapping dict (CSV column → budget field)
            transformations: Optional transformations dict (date format, etc.)

        Returns:
            Saved/updated ImportColumnMapping record

        Examples:
            # Create new mapping (shared for all users)
            >>> mapping = await MappingService.save_mapping(
            ...     session, 1, 123,
            ...     mapping={'fact_date': 'Date', 'amount': 'Amount'}
            ... )
            >>> mapping.id
            1

            # Update existing mapping by another user (SCD1)
            >>> mapping = await MappingService.save_mapping(
            ...     session, 1, 456,  # Different user
            ...     mapping={'fact_date': 'Date2', 'amount': 'Amount2'}
            ... )
            >>> mapping.id  # Same ID (shared mapping)
            1
            >>> mapping.user_id  # Updated to show who last changed
            456
        """
        existing = await MappingService.get_mapping(session, bank_provider_id)

        if existing:
            # Update (SCD Type 1)
            existing.mapping = mapping
            existing.transformations = transformations
            existing.user_id = user_id  # Update who last modified
            existing.updated_at = datetime.utcnow()
            await session.commit()
            await session.refresh(existing)
            return existing
        else:
            # Create
            new_mapping = ImportColumnMapping(
                bank_provider_id=bank_provider_id,
                user_id=user_id,
                mapping=mapping,
                transformations=transformations
            )
            session.add(new_mapping)
            await session.commit()
            await session.refresh(new_mapping)
            return new_mapping

    @staticmethod
    def get_default_mapping(bank_code: str) -> dict:
        """
        Get default mapping for known banks.

        Returns pre-configured column mapping for common Russian banks.
        Used when user has no saved mapping.

        Args:
            bank_code: Bank code (e.g., 'tinkoff', 'alfabank')

        Returns:
            Default mapping dict or empty dict if bank unknown

        Examples:
            >>> mapping = MappingService.get_default_mapping('tinkoff')
            >>> mapping['fact_date']
            'Дата операции'
            >>> mapping['amount']
            'Сумма операции'

            >>> mapping = MappingService.get_default_mapping('alfabank')
            >>> mapping['fact_date']
            'Дата'

            >>> mapping = MappingService.get_default_mapping('unknown')
            >>> mapping
            {}
        """
        defaults = {
            "tinkoff": {
                "fact_date": "Дата операции",
                "amount": "Сумма операции",
                "description": "Описание",
                "csv_category": "Категория",
                "csv_mcc": "MCC",
                "csv_card": "Номер карты"
            },
            "alfabank": {
                "fact_date": "Дата",
                "amount": "Сумма",
                "description": "Назначение платежа",
                "csv_category": "Категория",
                "csv_card": "Карта"
            },
            "sberbank": {
                "fact_date": "Дата операции",
                "amount": "Сумма операции",
                "description": "Описание операции",
                "csv_category": "Категория",
                "csv_mcc": "MCC"
            },
            "vtb": {
                "fact_date": "Дата",
                "amount": "Сумма",
                "description": "Описание",
                "csv_category": "Категория"
            },
            "raiffeisen": {
                "fact_date": "Дата транзакции",
                "amount": "Сумма",
                "description": "Назначение платежа",
                "csv_category": "Категория"
            }
        }
        return defaults.get(bank_code, {})
