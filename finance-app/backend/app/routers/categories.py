from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from .. import crud, schemas, models
from ..database import get_db
from .auth import get_current_user  # Import the dependency

router = APIRouter()


@router.post(
    "/",
    response_model=schemas.Category,
    status_code=status.HTTP_201_CREATED,
    summary="Create Category",
    description="Create a new spending/income category for the user.",
)
async def create_category(
    category_in: schemas.CategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.Category:
    """
    Creates a new category associated with the current user.
    Raises HTTP 400 if a category with the same name already exists.
    """
    try:
        return await crud.crud_category.create_category(
            db=db, category=category_in, user_id=current_user.id
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
        )


@router.get(
    "/",
    response_model=List[schemas.Category],
    summary="Read Categories",
    description="Retrieve all categories for the logged-in user.",
)
async def read_categories(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> List[models.Category]:
    """
    Retrieves a list of categories belonging to the current user.
    """
    categories = await crud.crud_category.get_categories(
        db=db, user_id=current_user.id, skip=skip, limit=limit
    )
    return categories


@router.get(
    "/{category_id}",
    response_model=schemas.Category,
    summary="Read Category",
    description="Retrieve a specific category by its ID.",
)
async def read_category(
    category_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.Category:
    """
    Retrieves a specific category by ID for the current user.
    """
    db_category = await crud.crud_category.get_category(
        db=db, category_id=category_id, user_id=current_user.id
    )
    if db_category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Category not found"
        )
    return db_category


@router.put(
    "/{category_id}",
    response_model=schemas.Category,
    summary="Update Category",
    description="Update a specific category by its ID.",
)
async def update_category(
    category_id: int,
    category_in: schemas.CategoryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.Category:
    """
    Updates a category by ID for the current user.
    Raises HTTP 400 if the new name conflicts with an existing category.
    """
    try:
        updated_category = await crud.crud_category.update_category(
            db=db,
            category_id=category_id,
            user_id=current_user.id,
            category_update=category_in,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
        )

    if updated_category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Category not found"
        )
    return updated_category


@router.delete(
    "/{category_id}",
    response_model=schemas.Message,
    summary="Delete Category",
    description="Delete a specific category by its ID.",
)
async def delete_category(
    category_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.Message:
    """
    Deletes a category by ID for the current user.
    Note: Might fail if items are linked (depends on CRUD logic).
    """
    try:
        deleted_category = await crud.crud_category.delete_category(
            db=db, category_id=category_id, user_id=current_user.id
        )
    except ValueError as e:  # Catch potential errors from CRUD
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
        )

    if deleted_category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Category not found"
        )
    return {"message": f"Category {category_id} deleted successfully"}