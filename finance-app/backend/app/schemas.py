from pydantic import BaseModel, EmailStr, Field
from datetime import date, datetime
from typing import Optional  # List was unused
from .models import TransactionType  # Import the enum

# ==================
# Base Schemas & Common
# ==================


class TunedModel(BaseModel):
    """ Base model configuration to enable ORM mode """
    model_config = {
        "from_attributes": True  # Enable ORM mode (Pydantic V2)
    }


class Message(BaseModel):
    """ Simple message schema for status responses """
    message: str


# ==================
# Token Schemas (Auth)
# ==================


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    email: Optional[str] = None
    telegram_id: Optional[str] = None


# ==================
# User Schemas
# ==================


class UserBase(TunedModel):
    email: EmailStr


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)  # Require password on creation


class UserUpdate(TunedModel):  # Separate update schema if needed
    email: Optional[EmailStr] = None
    # Password update should likely be a separate endpoint/process


class User(UserBase):  # Schema for reading user data (response)
    id: int
    telegram_id: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


# ==================
# Account Schemas
# ==================


class AccountBase(TunedModel):
    name: str = Field(..., min_length=1, max_length=100)
    type: str = Field(..., min_length=1, max_length=50)  # E.g., Checking, Cash


class AccountCreate(AccountBase):
    pass  # No extra fields needed for creation beyond base


class AccountUpdate(TunedModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    type: Optional[str] = Field(None, min_length=1, max_length=50)


class Account(AccountBase):  # Response schema
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None


# ==================
# Category Schemas
# ==================


class CategoryBase(TunedModel):
    name: str = Field(..., min_length=1, max_length=100)


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(TunedModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)


class Category(CategoryBase):  # Response schema
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None


# ==================
# Transaction Schemas
# ==================


class TransactionBase(TunedModel):
    date: date
    amount: float = Field(..., gt=0)  # Amount must be positive
    type: TransactionType
    description: Optional[str] = Field(None, max_length=500)
    account_id: int
    category_id: Optional[int] = None  # Optional category


class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(TunedModel):
    date: Optional[date] = None
    amount: Optional[float] = Field(None, gt=0)
    type: Optional[TransactionType] = None
    description: Optional[str] = Field(None, max_length=500)
    account_id: Optional[int] = None
    category_id: Optional[int] = None


class Transaction(TransactionBase):  # Response schema
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    # Optionally include related data if needed, requires careful handling
    # account: Account # Example
    # category: Optional[Category] = None # Example


# ==================
# Budget Schemas
# ==================


class BudgetBase(TunedModel):
    month_year: date  # Expecting first day of the month
    allocated_amount: float = Field(..., ge=0)  # Can be zero
    category_id: int


class BudgetCreate(BudgetBase):
    pass


class BudgetUpdate(TunedModel):
    # Usually budgets are set per month, update might mean setting a new value
    # Or maybe only allocated_amount is updatable? Define logic.
    allocated_amount: Optional[float] = Field(None, ge=0)


class Budget(BudgetBase):  # Response schema
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    # category: Category # Example if needed