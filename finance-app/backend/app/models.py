import enum
# from datetime import date, datetime  # SQLAlchemy types handle this
from sqlalchemy import (
    Column, Integer, String, ForeignKey, Date, Numeric, Enum, DateTime,
    UniqueConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func  # For server-side default timestamps
from .database import Base  # Import the Base from database.py

# Enum for Transaction Type


class TransactionType(str, enum.Enum):
    INCOME = "Income"
    EXPENSE = "Expense"

# User Model


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    telegram_id = Column(String, unique=True, index=True, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    accounts = relationship("Account", back_populates="owner")
    categories = relationship("Category", back_populates="owner")
    transactions = relationship("Transaction", back_populates="owner")
    budgets = relationship("Budget", back_populates="owner")

# Account Model


class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # E.g., Checking, Savings, etc.
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    owner = relationship("User", back_populates="accounts")
    transactions = relationship("Transaction", back_populates="account")

# Category Model


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    owner = relationship("User", back_populates="categories")
    transactions = relationship("Transaction", back_populates="category")
    budgets = relationship("Budget", back_populates="category")

# Transaction Model


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)  # Optional  # noqa: E501
    date = Column(Date, nullable=False, index=True)
    amount = Column(Numeric(10, 2), nullable=False)  # Example: 12345678.99
    type = Column(Enum(TransactionType), nullable=False)
    description = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    owner = relationship("User", back_populates="transactions")
    account = relationship("Account", back_populates="transactions")
    category = relationship("Category", back_populates="transactions")

# Budget Model


class Budget(Base):
    __tablename__ = "budgets"
    # Ensure a user can only have one budget per category per month
    __table_args__ = (UniqueConstraint('user_id', 'category_id', 'month_year', name='uq_user_category_month'),)  # noqa: E501

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    month_year = Column(Date, nullable=False, index=True)  # Use first day of month  # noqa: E501
    allocated_amount = Column(Numeric(10, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    owner = relationship("User", back_populates="budgets")
    category = relationship("Category", back_populates="budgets")