from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from datetime import date

from .. import models, schemas
from ..models import TransactionType


async def get_transaction(
    db: AsyncSession, transaction_id: int, user_id: int
) -> Optional[models.Transaction]:
    """Gets a single transaction by ID, ensuring it belongs to the user."""
    result = await db.execute(
        select(models.Transaction).filter(
            models.Transaction.id == transaction_id,
            models.Transaction.user_id == user_id,
        )
    )
    return result.scalars().first()


async def get_transactions(
    db: AsyncSession,
    user_id: int,
    skip: int = 0,
    limit: int = 100,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    category_id: Optional[int] = None,
    account_id: Optional[int] = None,
    transaction_type: Optional[TransactionType] = None,
) -> List[models.Transaction]:
    """
    Gets transactions for a user with filtering and pagination.
    """
    query = select(models.Transaction).filter(
        models.Transaction.user_id == user_id
    )

    # Apply filters
    if start_date:
        query = query.filter(models.Transaction.date >= start_date)
    if end_date:
        query = query.filter(models.Transaction.date <= end_date)
    if category_id is not None:  # Check for None explicitly if 0 is valid
        query = query.filter(models.Transaction.category_id == category_id)
    if account_id is not None:
        query = query.filter(models.Transaction.account_id == account_id)
    if transaction_type:
        query = query.filter(models.Transaction.type == transaction_type)

    # Apply ordering, pagination
    query = query.order_by(
        models.Transaction.date.desc(), models.Transaction.created_at.desc()
    )
    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    return result.scalars().all()


async def create_transaction(
    db: AsyncSession, transaction: schemas.TransactionCreate, user_id: int
) -> models.Transaction:
    """Creates a new transaction for a user."""
    # Add validation if needed (e.g., check account/category ownership)
    db_transaction = models.Transaction(
        **transaction.model_dump(), user_id=user_id
    )
    db.add(db_transaction)
    await db.flush()
    await db.refresh(db_transaction)
    return db_transaction


async def update_transaction(
    db: AsyncSession,
    transaction_id: int,
    user_id: int,
    transaction_update: schemas.TransactionUpdate,
) -> Optional[models.Transaction]:
    """Updates an existing transaction, ensuring it belongs to the user."""
    db_transaction = await get_transaction(
        db, transaction_id=transaction_id, user_id=user_id
    )
    if not db_transaction:
        return None

    update_data = transaction_update.model_dump(exclude_unset=True)
    # Add validation if needed (e.g., check new account/category ownership)
    for key, value in update_data.items():
        setattr(db_transaction, key, value)

    await db.flush()
    await db.refresh(db_transaction)
    return db_transaction


async def delete_transaction(
    db: AsyncSession, transaction_id: int, user_id: int
) -> Optional[models.Transaction]:
    """Deletes a transaction, ensuring it belongs to the user."""
    db_transaction = await get_transaction(
        db, transaction_id=transaction_id, user_id=user_id
    )
    if db_transaction:
        await db.delete(db_transaction)
        await db.flush()
    return db_transaction