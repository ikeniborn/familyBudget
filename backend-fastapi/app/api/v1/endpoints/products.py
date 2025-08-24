"""
Product management endpoints.
"""
from typing import List, Optional
from datetime import datetime
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from pydantic import BaseModel

from app.db.database import get_db
from app.models.product import Product
from app.models.product_price import ProductPrice
from app.models.product_nomenclature import ProductNomenclature
from app.core.session import get_current_user_from_session
from app.core.config import settings

router = APIRouter()


class ProductCreate(BaseModel):
    """Product creation schema."""
    name: str
    category: Optional[str] = None
    unit: Optional[str] = None
    barcode: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True


class ProductUpdate(BaseModel):
    """Product update schema."""
    name: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    barcode: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class ProductResponse(BaseModel):
    """Product response schema."""
    id: int
    name: str
    category: Optional[str]
    unit: Optional[str]
    barcode: Optional[str]
    description: Optional[str]
    is_active: bool
    created_at: Optional[datetime]
    updated_at: Optional[datetime]


class ProductPriceCreate(BaseModel):
    """Product price creation schema."""
    product_id: int
    supplier_name: Optional[str] = None
    price_value: Decimal
    price_date: datetime


class ProductPriceResponse(BaseModel):
    """Product price response schema."""
    id: int
    product_id: int
    supplier_name: Optional[str]
    price_value: Decimal
    price_date: datetime
    user_id: int
    created_at: Optional[datetime]


async def require_auth(request: Request) -> dict:
    """Require authentication."""
    user = await get_current_user_from_session(request)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    return user


@router.get("/", response_model=List[ProductResponse])
async def get_products(
    request: Request,
    skip: int = 0,
    limit: int = Query(default=50, le=settings.MAX_PAGE_SIZE),
    category: Optional[str] = None,
    is_active: Optional[bool] = True,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Get products with filtering and search."""
    stmt = select(Product)
    
    # Apply filters
    if category:
        stmt = stmt.where(Product.category == category)
    
    if is_active is not None:
        stmt = stmt.where(Product.is_active == is_active)
    
    if search:
        stmt = stmt.where(
            Product.name.ilike(f"%{search}%") |
            Product.description.ilike(f"%{search}%") |
            Product.barcode.ilike(f"%{search}%")
        )
    
    stmt = stmt.offset(skip).limit(limit).order_by(Product.name)
    result = await db.execute(stmt)
    products = result.scalars().all()
    
    return [ProductResponse(**product.to_dict()) for product in products]


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Get product by ID."""
    stmt = select(Product).where(Product.id == product_id)
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    return ProductResponse(**product.to_dict())


@router.post("/", response_model=ProductResponse)
async def create_product(
    product_data: ProductCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Create new product."""
    product = Product(**product_data.dict())
    db.add(product)
    await db.commit()
    await db.refresh(product)
    
    return ProductResponse(**product.to_dict())


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: int,
    product_data: ProductUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Update product."""
    stmt = select(Product).where(Product.id == product_id)
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    # Update product fields
    update_data = product_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)
    
    await db.commit()
    await db.refresh(product)
    
    return ProductResponse(**product.to_dict())


@router.delete("/{product_id}")
async def delete_product(
    product_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Delete product (soft delete by setting is_active=False)."""
    stmt = select(Product).where(Product.id == product_id)
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    product.is_active = False
    await db.commit()
    
    return {"message": "Product deactivated successfully"}


# Product Price endpoints
@router.get("/{product_id}/prices", response_model=List[ProductPriceResponse])
async def get_product_prices(
    product_id: int,
    request: Request,
    skip: int = 0,
    limit: int = Query(default=50, le=settings.MAX_PAGE_SIZE),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Get price history for a product."""
    stmt = select(ProductPrice).where(
        ProductPrice.product_id == product_id
    ).offset(skip).limit(limit).order_by(ProductPrice.price_date.desc())
    
    result = await db.execute(stmt)
    prices = result.scalars().all()
    
    return [ProductPriceResponse(**price.to_dict()) for price in prices]


@router.post("/{product_id}/prices", response_model=ProductPriceResponse)
async def create_product_price(
    product_id: int,
    price_data: ProductPriceCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Add price for a product."""
    # Verify product exists
    stmt = select(Product).where(Product.id == product_id)
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    # Create price entry
    price_dict = price_data.dict()
    price_dict["user_id"] = current_user["user_id"]
    
    price = ProductPrice(**price_dict)
    db.add(price)
    await db.commit()
    await db.refresh(price)
    
    return ProductPriceResponse(**price.to_dict())


@router.get("/{product_id}/prices/latest")
async def get_latest_product_price(
    product_id: int,
    request: Request,
    supplier_name: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Get latest price for a product, optionally filtered by supplier."""
    stmt = select(ProductPrice).where(ProductPrice.product_id == product_id)
    
    if supplier_name:
        stmt = stmt.where(ProductPrice.supplier_name == supplier_name)
    
    stmt = stmt.order_by(ProductPrice.price_date.desc()).limit(1)
    
    result = await db.execute(stmt)
    price = result.scalar_one_or_none()
    
    if not price:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No prices found for this product"
        )
    
    return ProductPriceResponse(**price.to_dict())


@router.get("/categories")
async def get_product_categories(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Get list of all product categories."""
    stmt = select(Product.category).distinct().where(
        and_(
            Product.category.isnot(None),
            Product.is_active == True
        )
    )
    
    result = await db.execute(stmt)
    categories = result.scalars().all()
    
    return {"categories": [cat for cat in categories if cat]}


@router.get("/search/barcode/{barcode}")
async def search_product_by_barcode(
    barcode: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Search product by barcode."""
    stmt = select(Product).where(
        and_(
            Product.barcode == barcode,
            Product.is_active == True
        )
    )
    
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product with this barcode not found"
        )
    
    return ProductResponse(**product.to_dict())