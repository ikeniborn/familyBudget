"""
Product and Product Price schemas.
"""
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel, Field


# Product schemas
class ProductBase(BaseModel):
    """Base product schema."""
    name: str = Field(..., min_length=1, max_length=255, description="Product name")
    category: Optional[str] = Field(None, max_length=100, description="Product category")
    unit: Optional[str] = Field(None, max_length=50, description="Unit of measure")
    barcode: Optional[str] = Field(None, max_length=50, description="Product barcode")
    description: Optional[str] = Field(None, description="Product description")
    is_active: bool = Field(True, description="Is product active")


class ProductCreate(ProductBase):
    """Product creation schema."""
    pass


class ProductUpdate(BaseModel):
    """Product update schema."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    category: Optional[str] = Field(None, max_length=100)
    unit: Optional[str] = Field(None, max_length=50)
    barcode: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    is_active: Optional[bool] = None


class ProductInDB(ProductBase):
    """Product schema for database operations."""
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProductPublic(ProductInDB):
    """Public product schema."""
    pass


# Product Price schemas
class ProductPriceBase(BaseModel):
    """Base product price schema."""
    product_id: int = Field(..., description="Product ID")
    supplier_name: Optional[str] = Field(None, max_length=255, description="Supplier name")
    price_value: Decimal = Field(..., description="Price value")
    price_date: date = Field(..., description="Price date")


class ProductPriceCreate(ProductPriceBase):
    """Product price creation schema."""
    pass


class ProductPriceUpdate(BaseModel):
    """Product price update schema."""
    supplier_name: Optional[str] = Field(None, max_length=255)
    price_value: Optional[Decimal] = None
    price_date: Optional[date] = None


class ProductPriceInDB(ProductPriceBase):
    """Product price schema for database operations."""
    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ProductPricePublic(ProductPriceInDB):
    """Public product price schema."""
    pass


class ProductWithPrices(ProductPublic):
    """Product schema with price history."""
    prices: List[ProductPricePublic] = []


# Product list response
class ProductListResponse(BaseModel):
    """Product list response with pagination."""
    products: List[ProductPublic]
    total: int
    page: int
    limit: int
    total_pages: int


# Category response
class ProductCategoriesResponse(BaseModel):
    """Product categories response."""
    categories: List[str]