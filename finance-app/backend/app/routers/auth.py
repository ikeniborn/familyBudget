from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Any  # For Depends response type hint
from datetime import timedelta

from .. import crud, schemas, models, security
from ..database import get_db

router = APIRouter()

# Define OAuth2 scheme
# tokenUrl should point to the login endpoint
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


@router.post(
    "/register",
    response_model=schemas.User,
    status_code=status.HTTP_201_CREATED,
)
async def register_user(
    user_in: schemas.UserCreate, db: AsyncSession = Depends(get_db)
) -> models.User:
    """
    Register a new user.
    """
    # Check if user already exists
    db_user = await crud.crud_user.get_user_by_email(db, email=user_in.email)
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    # Create user
    try:
        new_user = await crud.crud_user.create_user(db=db, user=user_in)
        return new_user
    except ValueError as e:  # Catch potential errors from CRUD
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/login", response_model=schemas.Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
) -> Any:  # Return type includes Token or raises HTTPException
    """
    Authenticate user with email/password and return JWT token.
    Uses OAuth2PasswordRequestForm for standard form data input.
    """
    # Form uses 'username' field for email
    user = await crud.crud_user.get_user_by_email(db, email=form_data.username)
    if not user or not security.verify_password(
        form_data.password, user.hashed_password
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create JWT token
    access_token_expires = timedelta(minutes=security.settings.ACCESS_TOKEN_EXPIRE_MINUTES)  # noqa: E501
    access_token = security.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


async def get_current_user(
    token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)
) -> models.User:
    """
    Dependency to get the current user from the token.
    Decodes token, validates payload, fetches user from DB.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    token_data = security.decode_access_token(token)
    if token_data is None or token_data.email is None:
        raise credentials_exception
    user = await crud.crud_user.get_user_by_email(db, email=token_data.email)
    if user is None:
        raise credentials_exception
    return user


# Placeholder for /login/telegram endpoint
# @router.post("/login/telegram")
# async def login_telegram(...):
#     pass


@router.get("/me", response_model=schemas.User)
async def read_users_me(
    current_user: models.User = Depends(get_current_user)
) -> models.User:
    """
    Get current logged-in user's details.
    """
    return current_user
#     return current_user