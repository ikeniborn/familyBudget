"""
Bank Provider Service

Service layer for managing bank providers (Tinkoff, Alfabank, Sberbank, VTB, Raiffeisen).
Provides CRUD operations for bank provider reference table.

Pattern: Service layer (business logic)
"""

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.models.bank_provider import BankProvider


class BankProviderService:
    """
    Service for managing bank providers.

    Provides read-only operations for bank provider reference table.
    Banks are seeded during migration and rarely change.

    Examples:
        # List all active banks
        >>> banks = await BankProviderService.list_active_banks(session)
        >>> len(banks)
        5

        # Get bank by code
        >>> tinkoff = await BankProviderService.get_by_code(session, "tinkoff")
        >>> tinkoff.name
        'Тинькофф Банк'
    """

    @staticmethod
    async def list_active_banks(session: AsyncSession) -> list[BankProvider]:
        """
        Get all active banks.

        Returns list of active banks ordered by name.
        Used for bank selection dropdown in import UI.

        Args:
            session: AsyncSession for database operations

        Returns:
            List of active BankProvider records

        Examples:
            >>> banks = await BankProviderService.list_active_banks(session)
            >>> [b.code for b in banks]
            ['alfabank', 'raiffeisen', 'sberbank', 'tinkoff', 'vtb']
        """
        stmt = select(BankProvider).where(BankProvider.active == True).order_by(BankProvider.name)
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def get_by_code(session: AsyncSession, code: str) -> BankProvider | None:
        """
        Get bank by code.

        Args:
            session: AsyncSession for database operations
            code: Bank code (e.g., 'tinkoff', 'alfabank')

        Returns:
            BankProvider record or None if not found

        Examples:
            >>> tinkoff = await BankProviderService.get_by_code(session, "tinkoff")
            >>> tinkoff.name
            'Тинькофф Банк'

            >>> unknown = await BankProviderService.get_by_code(session, "unknown")
            >>> unknown is None
            True
        """
        stmt = select(BankProvider).where(BankProvider.code == code)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_id(session: AsyncSession, bank_id: int) -> BankProvider | None:
        """
        Get bank by ID.

        Args:
            session: AsyncSession for database operations
            bank_id: Bank primary key

        Returns:
            BankProvider record or None if not found

        Examples:
            >>> bank = await BankProviderService.get_by_id(session, 1)
            >>> bank.code
            'tinkoff'
        """
        return await session.get(BankProvider, bank_id)
