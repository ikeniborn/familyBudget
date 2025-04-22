from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Optional

from .. import models, schemas
from ..security import get_password_hash


async def get_user(db: AsyncSession, user_id: int) -> Optional[models.User]:
    """Gets a single user by their ID."""
    result = await db.execute(
        select(models.User).filter(models.User.id == user_id)
    )
    return result.scalars().first()


async def get_user_by_email(db: AsyncSession, email: str) -> Optional[models.User]:  # noqa: E501
    """Gets a single user by their email address."""
    result = await db.execute(
        select(models.User).filter(models.User.email == email)
    )
    return result.scalars().first()


async def get_user_by_telegram_id(db: AsyncSession, telegram_id: str) -> Optional[models.User]:  # noqa: E501
    """Gets a single user by their Telegram ID."""
    result = await db.execute(
        select(models.User).filter(models.User.telegram_id == telegram_id)
    )
    return result.scalars().first()


async def create_user(db: AsyncSession, user: schemas.UserCreate) -> models.User:  # noqa: E501
    """Creates a new user in the database."""
    hashed_password = get_password_hash(user.password)
    db_user = models.User(
        email=user.email,
        hashed_password=hashed_password
        # telegram_id can be added later via an update or during Telegram auth
    )
    db.add(db_user)
    await db.flush()  # Use flush to get ID before commit (if needed)
    await db.refresh(db_user)
    return db_user

# Placeholder for update_user function
# async def update_user(db: AsyncSession, user_id: int, user_update: schemas.UserUpdate) -> Optional[models.User]:  # noqa: E501
#     db_user = await get_user(db, user_id)
#     if not db_user:
#         return None
#     update_data = user_update.model_dump(exclude_unset=True)
#     if "email" in update_data:
#         db_user.email = update_data["email"]
#     # Add other fields to update as needed
#     # Password updates should be handled separately for security
#     await db.flush()
#     await db.refresh(db_user)
#     return db_user

# Placeholder for delete_user function
# async def delete_user(db: AsyncSession, user_id: int) -> Optional[models.User]:  # noqa: E501
#     db_user = await get_user(db, user_id)
#     if db_user:
#         await db.delete(db_user)
#         await db.flush()
#     return db_user