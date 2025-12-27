"""
ID Generator Service for pre-generating PostgreSQL sequence IDs.

This module provides functionality to pre-generate IDs from PostgreSQL sequences,
enabling the Write-Behind pattern to return IDs immediately to clients while
the actual database write happens asynchronously.

Usage:
    from backend.app.services.id_generator import get_next_fact_id

    # In endpoint:
    fact_id = await get_next_fact_id(session)
    # Now queue the write operation with this ID
    await write_behind_service.queue_fact_create(pre_generated_id=fact_id, ...)
    # Return the ID immediately to client

Benefits:
    - Immediate ID return to client (no waiting for async write)
    - API contract preserved (response always has ID)
    - Sequence gaps are acceptable (normal PostgreSQL behavior)
"""

from sqlalchemy import text
from sqlmodel.ext.asyncio.session import AsyncSession


async def get_next_fact_id(session: AsyncSession) -> int:
    """
    Pre-generate ID from PostgreSQL sequence for t_f_budget_fact table.

    Uses PostgreSQL's nextval() to get the next sequence value, which is
    atomic and safe for concurrent access. The sequence is automatically
    created by PostgreSQL for BIGSERIAL columns.

    Args:
        session: AsyncSession connected to the database.

    Returns:
        int: The next available ID from the sequence.

    Raises:
        sqlalchemy.exc.ProgrammingError: If sequence doesn't exist.

    Note:
        - Sequence gaps are normal and expected (rollbacks, pre-generation)
        - Each call increments the sequence permanently (no rollback)
        - Safe for multi-worker concurrent access
    """
    result = await session.execute(
        text("SELECT nextval('t_f_budget_fact_id_seq')")
    )
    return result.scalar_one()


async def get_next_transfer_id(session: AsyncSession) -> int:
    """
    Pre-generate transfer_id for linking paired facts in transfers.

    Transfers consist of two facts (debit and credit) linked by transfer_id.
    This generates a unique transfer_id before creating the paired facts.

    Args:
        session: AsyncSession connected to the database.

    Returns:
        int: The next available transfer ID.

    Note:
        Uses a dedicated sequence or can use fact sequence + timestamp.
        For simplicity, we use a separate counter based on max transfer_id.
    """
    # Use a simple approach: get max transfer_id + 1
    # In production, consider a dedicated sequence
    result = await session.execute(
        text("""
            SELECT COALESCE(MAX(transfer_id), 0) + 1
            FROM t_f_budget_fact
            WHERE transfer_id IS NOT NULL
        """)
    )
    return result.scalar_one()
