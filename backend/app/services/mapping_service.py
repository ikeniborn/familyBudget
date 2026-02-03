"""
Mapping Service

Service for managing column mappings (CSV column → budget field).
Mappings are per-user per-bank (one mapping per user per bank).
Supports SCD Type 1 (in-place updates) and default mappings for known banks.

Pattern: Service layer (business logic)
"""
from typing import Optional

from datetime import datetime

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.models.import_column_mapping import ImportColumnMapping


class MappingService:
    """
    Service for managing column mappings (per-user per-bank).

    Provides:
    - Get saved mapping for user+bank (per-user isolation)
    - Save/update mapping (SCD Type 1 - in-place update per user)
    - Get default mapping for known banks

    NOTE: Mappings are per-user per-bank. Each user has their own mapping
    which doesn't affect other users' mappings.

    Examples:
        # Get saved mapping for specific user
        >>> mapping = await MappingService.get_mapping(session, bank_provider_id=1, user_id=123)
        >>> mapping.mapping
        {'fact_date': 'Дата операции', 'amount': 'Сумма операции'}

        # Save new mapping (per-user, doesn't affect other users)
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
        bank_provider_id: int,
        user_id: int
    ) -> Optional[ImportColumnMapping]:
        """
        Get saved mapping for user+bank (per-user).

        Args:
            session: AsyncSession for database operations
            bank_provider_id: Bank provider ID
            user_id: User ID (owner of mapping)

        Returns:
            ImportColumnMapping record or None if not found

        Examples:
            >>> mapping = await MappingService.get_mapping(session, 1, 123)
            >>> mapping.mapping
            {'fact_date': 'Дата операции', 'amount': 'Сумма операции'}
        """
        stmt = select(ImportColumnMapping).where(
            ImportColumnMapping.bank_provider_id == bank_provider_id,
            ImportColumnMapping.user_id == user_id
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def save_mapping(
        session: AsyncSession,
        bank_provider_id: int,
        user_id: int,
        mapping: dict,
        transformations: Optional[dict] = None
    ) -> ImportColumnMapping:
        """
        Save or update mapping (SCD Type 1, per-user per-bank).

        If mapping exists for this (user, bank) → UPDATE in-place
        If mapping doesn't exist → INSERT new record

        Args:
            session: AsyncSession for database operations
            bank_provider_id: Bank provider ID
            user_id: User ID (owner of mapping)
            mapping: Column mapping dict (CSV column → budget field)
            transformations: Optional transformations dict (date format, etc.)

        Returns:
            Saved/updated ImportColumnMapping record

        Examples:
            # User 123 creates mapping
            >>> mapping1 = await MappingService.save_mapping(
            ...     session, 1, 123,
            ...     mapping={'fact_date': 'Date1', 'amount': 'Amount1'}
            ... )
            >>> mapping1.id
            1

            # User 456 creates different mapping (does NOT overwrite user 123)
            >>> mapping2 = await MappingService.save_mapping(
            ...     session, 1, 456,  # Different user, same bank
            ...     mapping={'fact_date': 'Date2', 'amount': 'Amount2'}
            ... )
            >>> mapping2.id  # Different ID (separate mapping)
            2
            >>> mapping1.id != mapping2.id  # Each user has their own
            True
        """
        existing = await MappingService.get_mapping(session, bank_provider_id, user_id)

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
