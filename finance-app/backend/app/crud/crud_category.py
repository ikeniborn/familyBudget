from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional

from .. import models, schemas


async def get_category(
    db: AsyncSession, category_id: int, user_id: int
) -> Optional[models.Category]:
    """Gets a single category by ID, ensuring it belongs to the user."""
    result = await db.execute(
        select(models.Category).filter(
            models.Category.id == category_id,
            models.Category.user_id == user_id,
        )
    )
    return result.scalars().first()


async def get_category_by_name(
    db: AsyncSession, name: str, user_id: int
) -> Optional[models.Category]:
    """Gets a single category by name for a specific user."""
    result = await db.execute(
        select(models.Category).filter(
            models.Category.name == name, models.Category.user_id == user_id
        )
    )
    return result.scalars().first()


async def get_categories(
    db: AsyncSession, user_id: int, skip: int = 0, limit: int = 100
) -> List[models.Category]:
    """Gets a list of categories for a specific user with pagination."""
    result = await db.execute(
        select(models.Category)
        .filter(models.Category.user_id == user_id)
        .offset(skip)
        .limit(limit)
        .order_by(models.Category.name)  # Order alphabetically
    )
    return result.scalars().all()


async def create_category(
    db: AsyncSession, category: schemas.CategoryCreate, user_id: int
) -> models.Category:
    """Creates a new category for a user."""
    # Optional: Check for existing category with the same name for this user
    existing_category = await get_category_by_name(
        db, name=category.name, user_id=user_id
    )
    if existing_category:
        # Handle duplicate name error (e.g., raise HTTPException in router)
        # For now, just return the existing one or raise a ValueError
        raise ValueError(f"Category '{category.name}' already exists.")

    db_category = models.Category(**category.model_dump(), user_id=user_id)
    db.add(db_category)
    await db.flush()
    await db.refresh(db_category)
    return db_category


async def update_category(
    db: AsyncSession,
    category_id: int,
    user_id: int,
    category_update: schemas.CategoryUpdate,
) -> Optional[models.Category]:
    """Updates an existing category, ensuring it belongs to the user."""
    db_category = await get_category(
        db, category_id=category_id, user_id=user_id
    )
    if not db_category:
        return None

    update_data = category_update.model_dump(exclude_unset=True)

    # Optional: Check for name conflict if name is being updated
    if "name" in update_data and update_data["name"] != db_category.name:
        existing_category = await get_category_by_name(
            db, name=update_data["name"], user_id=user_id
        )
        if existing_category:
            raise ValueError(f"Category '{update_data['name']}' already exists.")  # noqa: E501

    for key, value in update_data.items():
        setattr(db_category, key, value)

    await db.flush()
    await db.refresh(db_category)
    return db_category


async def delete_category(
    db: AsyncSession, category_id: int, user_id: int
) -> Optional[models.Category]:
    """
    Deletes a category, ensuring it belongs to the user.
    Note: Consider implications for linked transactions/budgets.
    Maybe prevent deletion if linked, or set items to null/default.
    """
    db_category = await get_category(
        db, category_id=category_id, user_id=user_id
    )
    if db_category:
        # Add check here: Query for linked transactions/budgets
        # If found, raise error or handle as per app logic.
        # Example check (needs implementation):
        # linked_items = await check_category_linkages(db, category_id)
        # if linked_items:
        #     raise ValueError("Cannot delete category with linked items.")

        await db.delete(db_category)
        await db.flush()
    return db_category