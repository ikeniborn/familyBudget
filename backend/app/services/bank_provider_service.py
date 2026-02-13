"""
Bank Provider Service

Service layer for managing bank providers (Tinkoff, Alfabank, Sberbank, VTB, Raiffeisen).
Provides CRUD operations for bank provider reference table.

Pattern: Service layer (business logic)
"""
import logging

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.models.bank_provider import BankProvider
from backend.app.models.import_column_mapping import ImportColumnMapping
from backend.app.models.import_file_upload import ImportFileUpload
from backend.app.models.import_staging import ImportStaging

logger = logging.getLogger(__name__)


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
        stmt = select(BankProvider).where(BankProvider.active).order_by(BankProvider.name)
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

    @staticmethod
    async def create_bank(
        session: AsyncSession,
        code: str,
        name: str
    ) -> BankProvider:
        """
        Create new bank provider.

        Validates code uniqueness before creating.

        Args:
            session: AsyncSession for database operations
            code: Unique bank code (e.g., 'my_bank')
            name: Bank display name (e.g., 'Мой Банк')

        Returns:
            Created BankProvider record

        Raises:
            ValueError: If bank with this code already exists

        Examples:
            >>> bank = await BankProviderService.create_bank(
            ...     session, "my_bank", "Мой Банк"
            ... )
            >>> bank.id
            6
        """
        existing = await BankProviderService.get_by_code(session, code)
        if existing:
            raise ValueError(f"Bank with code '{code}' already exists")

        bank = BankProvider(code=code, name=name, active=True)
        session.add(bank)
        await session.commit()
        await session.refresh(bank)
        return bank

    @staticmethod
    async def delete_bank(session: AsyncSession, bank_id: int) -> dict:
        """
        Delete bank with cascade deletion of related records.

        Cascade order (to respect FK constraints):
        1. ImportStaging (by bank_provider_id)
        2. ImportFileUpload (by bank_provider_id)
        3. ImportColumnMapping (by bank_provider_id)
        4. BankProvider

        Args:
            session: AsyncSession for database operations
            bank_id: Bank primary key to delete

        Returns:
            Dict with counts: {
                "deleted_staging": N,
                "deleted_uploads": N,
                "deleted_mappings": N
            }

        Raises:
            ValueError: If bank with this id doesn't exist

        Examples:
            >>> result = await BankProviderService.delete_bank(session, 1)
            >>> result
            {"deleted_staging": 10, "deleted_uploads": 2, "deleted_mappings": 1}
        """
        # Check bank exists
        bank = await session.get(BankProvider, bank_id)
        if not bank:
            raise ValueError(f"Bank with id={bank_id} not found")

        logger.info(f"Deleting bank id={bank_id}, code='{bank.code}'")

        # 1. Delete staging records (by bank_provider_id)
        staging_stmt = select(ImportStaging).where(
            ImportStaging.bank_provider_id == bank_id
        )
        staging_result = await session.execute(staging_stmt)
        staging_records = list(staging_result.scalars().all())
        deleted_staging = len(staging_records)
        for record in staging_records:
            await session.delete(record)

        logger.info(f"Deleted {deleted_staging} staging records")

        # 2. Delete file uploads (by bank_provider_id)
        uploads_stmt = select(ImportFileUpload).where(
            ImportFileUpload.bank_provider_id == bank_id
        )
        uploads_result = await session.execute(uploads_stmt)
        upload_records = list(uploads_result.scalars().all())
        deleted_uploads = len(upload_records)
        for record in upload_records:
            await session.delete(record)

        logger.info(f"Deleted {deleted_uploads} file upload records")

        # 3. Delete column mappings (by bank_provider_id)
        mappings_stmt = select(ImportColumnMapping).where(
            ImportColumnMapping.bank_provider_id == bank_id
        )
        mappings_result = await session.execute(mappings_stmt)
        mapping_records = list(mappings_result.scalars().all())
        deleted_mappings = len(mapping_records)
        for record in mapping_records:
            await session.delete(record)

        logger.info(f"Deleted {deleted_mappings} column mapping records")

        # 4. Delete bank provider
        await session.delete(bank)
        await session.commit()

        logger.info(f"Bank id={bank_id} deleted successfully")

        return {
            "deleted_staging": deleted_staging,
            "deleted_uploads": deleted_uploads,
            "deleted_mappings": deleted_mappings
        }
