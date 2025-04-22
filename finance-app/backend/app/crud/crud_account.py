from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional

from .. import models, schemas


async def get_account(
    db: AsyncSession, account_id: int, user_id: int
) -> Optional[models.Account]:
    """Gets a single account by ID, ensuring it belongs to the user."""
    result = await db.execute(
        select(models.Account).filter(
            models.Account.id == account_id, models.Account.user_id == user_id
        )
    )
    return result.scalars().first()


async def get_accounts(
    db: AsyncSession, user_id: int, skip: int = 0, limit: int = 100
) -> List[models.Account]:
    """Gets a list of accounts for a specific user with pagination."""
    result = await db.execute(
        select(models.Account)
        .filter(models.Account.user_id == user_id)
        .offset(skip)
        .limit(limit)
        .order_by(models.Account.name)  # Optional: order by name
    )
    return result.scalars().all()


async def create_account(
    db: AsyncSession, account: schemas.AccountCreate, user_id: int
) -> models.Account:
    """Creates a new account for a user."""
    db_account = models.Account(
        **account.model_dump(),  # Unpack validated data from schema
        user_id=user_id
    )
    db.add(db_account)
    await db.flush()
    await db.refresh(db_account)
    return db_account


async def update_account(
    db: AsyncSession,
    account_id: int,
    user_id: int,
    account_update: schemas.AccountUpdate,
) -> Optional[models.Account]:
    """Updates an existing account, ensuring it belongs to the user."""
    db_account = await get_account(db, account_id=account_id, user_id=user_id)
    if not db_account:
        return None

    update_data = account_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_account, key, value)

    await db.flush()
    await db.refresh(db_account)
    return db_account


async def delete_account(
    db: AsyncSession, account_id: int, user_id: int
) -> Optional[models.Account]:
    """Deletes an account, ensuring it belongs to the user."""
    db_account = await get_account(db, account_id=account_id, user_id=user_id)
    if db_account:
        await db.delete(db_account)
        await db.flush()
    return db_account