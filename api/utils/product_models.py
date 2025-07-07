from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal


class ProductBase(BaseModel):
    """Base model for product data"""
    product_name: str = Field(..., max_length=255, description="Product name")
    category_name: Optional[str] = Field(None, max_length=100, description="Product category")
    unit_measure: Optional[str] = Field(None, max_length=50, description="Unit of measure (kg, l, pcs)")
    barcode: Optional[str] = Field(None, max_length=50, description="Product barcode")
    description: Optional[str] = Field(None, description="Product description")
    is_active: bool = Field(True, description="Is product active")


class ProductCreate(ProductBase):
    """Model for creating a new product"""
    pass


class ProductUpdate(BaseModel):
    """Model for updating a product (all fields optional)"""
    product_name: Optional[str] = Field(None, max_length=255)
    category_name: Optional[str] = Field(None, max_length=100)
    unit_measure: Optional[str] = Field(None, max_length=50)
    barcode: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    is_active: Optional[bool] = None


class Product(ProductBase):
    """Model for product with all fields"""
    product_id: int
    created_dttm: datetime
    updated_dttm: datetime

    class Config:
        orm_mode = True


class ProductPriceBase(BaseModel):
    """Base model for product price"""
    product_id: int = Field(..., description="Product ID")
    supplier_name: Optional[str] = Field(None, max_length=255, description="Supplier name")
    price_value: Decimal = Field(..., gt=0, decimal_places=2, description="Price value")
    price_date: date = Field(default_factory=date.today, description="Price date")

    @validator('price_value')
    def validate_price(cls, v):
        if v <= 0:
            raise ValueError('Price must be positive')
        return round(v, 2)


class ProductPriceCreate(ProductPriceBase):
    """Model for creating a new price entry"""
    pass


class ProductPrice(ProductPriceBase):
    """Model for price with all fields"""
    price_id: int
    user_id: int
    created_dttm: datetime

    class Config:
        orm_mode = True


class ProductWithLatestPrice(Product):
    """Model for product with latest price information"""
    latest_price: Optional[Decimal] = None
    latest_price_date: Optional[date] = None
    latest_supplier: Optional[str] = None
    price_count: int = 0


class ProductPriceHistory(BaseModel):
    """Model for price history response"""
    product_id: int
    product_name: str
    prices: List[ProductPrice]
    average_price: Optional[Decimal] = None
    min_price: Optional[Decimal] = None
    max_price: Optional[Decimal] = None


class ProductNomenclatureLink(BaseModel):
    """Model for linking product to nomenclature"""
    product_id: int
    nomenclature_id: int


class ProductImportCSV(BaseModel):
    """Model for CSV import data"""
    product_name: str
    category: Optional[str] = None
    unit: Optional[str] = None
    price: Optional[Decimal] = None
    supplier: Optional[str] = None
    barcode: Optional[str] = None


class ProductImportResult(BaseModel):
    """Model for import operation result"""
    total_rows: int
    imported: int
    skipped: int
    errors: List[str] = []
    imported_products: List[int] = []


class ProductSearchParams(BaseModel):
    """Model for product search parameters"""
    search: Optional[str] = Field(None, description="Search in name, category, barcode")
    category: Optional[str] = Field(None, description="Filter by category")
    is_active: Optional[bool] = Field(None, description="Filter by active status")
    has_price: Optional[bool] = Field(None, description="Filter by price availability")
    min_price: Optional[Decimal] = Field(None, ge=0, description="Minimum price filter")
    max_price: Optional[Decimal] = Field(None, ge=0, description="Maximum price filter")
    supplier: Optional[str] = Field(None, description="Filter by supplier")
    page: int = Field(1, ge=1, description="Page number")
    limit: int = Field(20, ge=1, le=100, description="Items per page")
    sort_by: str = Field("product_name", description="Sort field")
    sort_order: str = Field("asc", regex="^(asc|desc)$", description="Sort order")


class ProductSearchResult(BaseModel):
    """Model for search results"""
    items: List[ProductWithLatestPrice]
    total: int
    page: int
    pages: int
    limit: int