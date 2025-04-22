from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from .. import crud, schemas, models
from ..database import get_db
from .auth import get_current_user  # Import the dependency

router = APIRouter()


@router.post(
    "/",
    response_model=schemas.Account,
    status_code=status.HTTP_201_CREATED,
    summary="Create Account",
    description="Create a new financial account for the logged-in user.",
)
async def create_account(
    account_in: schemas.AccountCreate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.Account:
    """
    Creates a new account associated with the current user.
    """
    return await crud.crud_account.create_account(
        db=db, account=account_in, user_id=current_user.id
    )


@router.get(
    "/",
    response_model=List[schemas.Account],
    summary="Read Accounts",
    description="Retrieve all financial accounts for the logged-in user.",
)
async def read_accounts(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> List[models.Account]:
    """
    Retrieves a list of accounts belonging to the current user.
    """
    accounts = await crud.crud_account.get_accounts(
        db=db, user_id=current_user.id, skip=skip, limit=limit
    )
    return accounts


@router.get(
    "/{account_id}",
    response_model=schemas.Account,
    summary="Read Account",
    description="Retrieve a specific financial account by its ID.",
)
async def read_account(
    account_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.Account:
    """
    Retrieves a specific account by ID for the current user.
    """
    db_account = await crud.crud_account.get_account(
        db=db, account_id=account_id, user_id=current_user.id
    )
    if db_account is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Account not found"
        )
    return db_account


@router.put(
    "/{account_id}",
    response_model=schemas.Account,
    summary="Update Account",
    description="Update a specific financial account by its ID.",
)
async def update_account(
    account_id: int,
    account_in: schemas.AccountUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.Account:
    """
    Updates an account by ID, ensuring it belongs to the current user.
    """
    updated_account = await crud.crud_account.update_account(
        db=db,
        account_id=account_id,
        user_id=current_user.id,
        account_update=account_in,
    )
    if updated_account is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Account not found"
        )
    return updated_account


@router.delete(
    "/{account_id}",
    response_model=schemas.Message,  # Or return deleted: schemas.Account
    summary="Delete Account",
    description="Delete a specific financial account by its ID.",
)
async def delete_account(
    account_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.Message:
    """
    Deletes an account by ID, ensuring it belongs to the current user.
    Note: Consider implications for linked transactions before deleting.
    """
    deleted_account = await crud.crud_account.delete_account(
        db=db, account_id=account_id, user_id=current_user.id
    )
    if deleted_account is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Account not found"
        )
    return {"message": f"Account {account_id} deleted successfully"}