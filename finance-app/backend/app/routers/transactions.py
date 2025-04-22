from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import date

from .. import crud, schemas, models
from ..database import get_db
from .auth import get_current_user  # Import the dependency
from ..models import TransactionType  # Import enum

router = APIRouter()


@router.post(
    "/",
    response_model=schemas.Transaction,
    status_code=status.HTTP_201_CREATED,
    summary="Create Transaction",
    description="Create a new transaction (income or expense) for the user.",
)
async def create_transaction(
    transaction_in: schemas.TransactionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.Transaction:
    """
    Creates a new transaction associated with the current user.
    Requires valid `account_id` and optional `category_id`.
    """
    # TODO: Add validation for account/category ownership
    return await crud.crud_transaction.create_transaction(
        db=db, transaction=transaction_in, user_id=current_user.id
    )


@router.get(
    "/",
    response_model=List[schemas.Transaction],
    summary="Read Transactions",
    description="Retrieve transactions with filtering and pagination.",
)
async def read_transactions(
    skip: int = 0,
    limit: int = 100,
    start_date: Optional[date] = Query(None, description="Start date (YYYY-MM-DD)"),  # noqa: E501
    end_date: Optional[date] = Query(None, description="End date (YYYY-MM-DD)"),  # noqa: E501
    category_id: Optional[int] = Query(None, description="Category ID"),  # noqa: E501
    account_id: Optional[int] = Query(None, description="Account ID"),  # noqa: E501
    transaction_type: Optional[TransactionType] = Query(None, description="Type (Income/Expense)"),  # noqa: E501
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> List[models.Transaction]:
    """
    Retrieves transactions for the current user, with optional filters.
    """
    transactions = await crud.crud_transaction.get_transactions(
        db=db,
        user_id=current_user.id,
        skip=skip,
        limit=limit,
        start_date=start_date,
        end_date=end_date,
        category_id=category_id,
        account_id=account_id,
        transaction_type=transaction_type,
    )
    return transactions


@router.get(
    "/{transaction_id}",
    response_model=schemas.Transaction,
    summary="Read Transaction",
    description="Retrieve a specific transaction by its ID.",
)
async def read_transaction(
    transaction_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.Transaction:
    """
    Retrieves a specific transaction by ID for the current user.
    """
    db_transaction = await crud.crud_transaction.get_transaction(
        db=db, transaction_id=transaction_id, user_id=current_user.id
    )
    if db_transaction is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found"  # noqa: E501
        )
    return db_transaction


@router.put(
    "/{transaction_id}",
    response_model=schemas.Transaction,
    summary="Update Transaction",
    description="Update a specific transaction by its ID.",
)
async def update_transaction(
    transaction_id: int,
    transaction_in: schemas.TransactionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.Transaction:
    """
    Updates a transaction by ID for the current user.
    """
    # TODO: Add validation for updated account/category ownership
    updated_transaction = await crud.crud_transaction.update_transaction(
        db=db,
        transaction_id=transaction_id,
        user_id=current_user.id,
        transaction_update=transaction_in,
    )
    if updated_transaction is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found"  # noqa: E501
        )
    return updated_transaction


@router.delete(
    "/{transaction_id}",
    response_model=schemas.Message,
    summary="Delete Transaction",
    description="Delete a specific transaction by its ID.",
)
async def delete_transaction(
    transaction_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.Message:
    """
    Deletes a transaction by ID for the current user.
    """
    deleted_transaction = await crud.crud_transaction.delete_transaction(
        db=db, transaction_id=transaction_id, user_id=current_user.id
    )
    if deleted_transaction is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found"  # noqa: E501
        )
    return {"message": f"Transaction {transaction_id} deleted successfully"}