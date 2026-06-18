"""When a medicine runs out, add it to a 'докупить' shopping list (reuses shopping infrastructure)."""
import logging

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from backend.app.models.medicine import Medicine
from backend.app.models.shopping_list import ShoppingList
from backend.app.models.shopping_list_item import ShoppingListItem
from backend.app.services.csv_validator import get_or_create_product_group, get_or_create_store

logger = logging.getLogger(__name__)

PHARMACY_STORE = "Аптека"
MEDICINE_GROUP = "Лекарства"
RESTOCK_LIST = "Аптечка — докупить"


async def _get_or_create_restock_list(session: AsyncSession, user_id: int) -> int:
    existing = (await session.execute(
        select(ShoppingList).where(
            ShoppingList.name == RESTOCK_LIST, ShoppingList.is_active == True)  # noqa: E712
    )).scalars().first()
    if existing:
        return existing.id
    lst = ShoppingList(creator_id=user_id, name=RESTOCK_LIST, is_active=True)
    session.add(lst)
    await session.flush()
    return lst.id


async def add_to_shopping_list(session: AsyncSession, medicine: Medicine, user_id: int) -> None:
    """Idempotent-ish add: skips if an active (non-completed, non-deleted) item already exists."""
    list_id = await _get_or_create_restock_list(session, user_id)
    store_id = await get_or_create_store(session, PHARMACY_STORE, user_id, {})
    group_id = await get_or_create_product_group(session, MEDICINE_GROUP, user_id, {})

    dup = (await session.execute(
        select(ShoppingListItem).where(
            ShoppingListItem.shopping_list_id == list_id,
            ShoppingListItem.product_name == medicine.name,
            ShoppingListItem.is_completed == False,  # noqa: E712
            ShoppingListItem.deleted_at.is_(None),
        )
    )).scalars().first()
    if dup:
        return

    session.add(ShoppingListItem(
        creator_id=user_id, shopping_list_id=list_id, store_id=store_id,
        product_group_id=group_id, product_name=medicine.name, quantity=1, unit="шт",
        comment="Закончилось — автодобавление из аптечки"))
    logger.info("[MED_RESTOCK] added '%s' to shopping list %s", medicine.name, list_id)
    # caller commits
