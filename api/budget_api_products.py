"""
Product management endpoints for Budget API
Secure implementation with parameterized queries
"""

from fastapi import APIRouter, HTTPException, Depends, Query, File, UploadFile
from typing import List, Optional
from datetime import date
import csv
import io
import json
from decimal import Decimal

from utils.postgres_secure import PostgresSecure
from utils.product_models import (
    Product, ProductCreate, ProductUpdate, ProductWithLatestPrice,
    ProductPrice, ProductPriceCreate, ProductPriceHistory,
    ProductNomenclatureLink, ProductImportCSV, ProductImportResult,
    ProductSearchParams, ProductSearchResult
)
from budget_api_secure import get_user_id, db


router = APIRouter(prefix="/products", tags=["products"])


@router.get("/", response_model=ProductSearchResult)
async def search_products(
    params: ProductSearchParams = Depends(),
    user_id: str = Depends(get_user_id)
):
    """Search products with filters and pagination"""
    
    # Build WHERE clause
    where_conditions = ["1=1"]
    query_params = []
    param_count = 0
    
    if params.search:
        param_count += 1
        where_conditions.append(f"""
            (LOWER(p.product_name) LIKE LOWER($%{param_count}) 
            OR LOWER(p.category_name) LIKE LOWER($%{param_count})
            OR p.barcode LIKE $%{param_count})
        """)
        query_params.append(f"%{params.search}%")
    
    if params.category:
        param_count += 1
        where_conditions.append(f"p.category_name = ${param_count}")
        query_params.append(params.category)
    
    if params.is_active is not None:
        param_count += 1
        where_conditions.append(f"p.is_active = ${param_count}")
        query_params.append(params.is_active)
    
    # Count total items
    count_query = f"""
        SELECT COUNT(DISTINCT p.product_id) 
        FROM t_d_product p
        WHERE {' AND '.join(where_conditions)}
    """
    total = await db.fetchval(count_query, *query_params)
    
    # Calculate pagination
    offset = (params.page - 1) * params.limit
    pages = (total + params.limit - 1) // params.limit
    
    # Main query with latest prices
    param_count += 1
    query_params.append(int(user_id))
    param_count += 1
    query_params.append(params.limit)
    param_count += 1
    query_params.append(offset)
    
    query = f"""
        WITH latest_prices AS (
            SELECT DISTINCT ON (product_id) 
                product_id,
                price_value,
                price_date,
                supplier_name
            FROM t_f_product_price
            WHERE user_id = ${param_count - 2}
            ORDER BY product_id, price_date DESC, price_id DESC
        ),
        price_counts AS (
            SELECT 
                product_id,
                COUNT(*) as price_count
            FROM t_f_product_price
            WHERE user_id = ${param_count - 2}
            GROUP BY product_id
        )
        SELECT 
            p.product_id,
            p.product_name,
            p.category_name,
            p.unit_measure,
            p.barcode,
            p.description,
            p.is_active,
            p.created_dttm,
            p.updated_dttm,
            lp.price_value as latest_price,
            lp.price_date as latest_price_date,
            lp.supplier_name as latest_supplier,
            COALESCE(pc.price_count, 0) as price_count
        FROM t_d_product p
        LEFT JOIN latest_prices lp ON p.product_id = lp.product_id
        LEFT JOIN price_counts pc ON p.product_id = pc.product_id
        WHERE {' AND '.join(where_conditions)}
        ORDER BY {params.sort_by} {params.sort_order}
        LIMIT ${param_count - 1} OFFSET ${param_count}
    """
    
    rows = await db.fetchall(query, *query_params)
    
    items = [
        ProductWithLatestPrice(
            product_id=row['product_id'],
            product_name=row['product_name'],
            category_name=row['category_name'],
            unit_measure=row['unit_measure'],
            barcode=row['barcode'],
            description=row['description'],
            is_active=row['is_active'],
            created_dttm=row['created_dttm'],
            updated_dttm=row['updated_dttm'],
            latest_price=row['latest_price'],
            latest_price_date=row['latest_price_date'],
            latest_supplier=row['latest_supplier'],
            price_count=row['price_count']
        )
        for row in rows
    ]
    
    return ProductSearchResult(
        items=items,
        total=total,
        page=params.page,
        pages=pages,
        limit=params.limit
    )


@router.get("/{product_id}", response_model=ProductWithLatestPrice)
async def get_product(product_id: int, user_id: str = Depends(get_user_id)):
    """Get single product by ID with latest price"""
    
    query = """
        WITH latest_price AS (
            SELECT 
                price_value,
                price_date,
                supplier_name
            FROM t_f_product_price
            WHERE product_id = $1 AND user_id = $2
            ORDER BY price_date DESC, price_id DESC
            LIMIT 1
        ),
        price_count AS (
            SELECT COUNT(*) as cnt
            FROM t_f_product_price
            WHERE product_id = $1 AND user_id = $2
        )
        SELECT 
            p.*,
            lp.price_value as latest_price,
            lp.price_date as latest_price_date,
            lp.supplier_name as latest_supplier,
            COALESCE(pc.cnt, 0) as price_count
        FROM t_d_product p
        LEFT JOIN latest_price lp ON true
        LEFT JOIN price_count pc ON true
        WHERE p.product_id = $1
    """
    
    row = await db.fetchone(query, product_id, int(user_id))
    
    if not row:
        raise HTTPException(status_code=404, detail="Product not found")
    
    return ProductWithLatestPrice(
        product_id=row['product_id'],
        product_name=row['product_name'],
        category_name=row['category_name'],
        unit_measure=row['unit_measure'],
        barcode=row['barcode'],
        description=row['description'],
        is_active=row['is_active'],
        created_dttm=row['created_dttm'],
        updated_dttm=row['updated_dttm'],
        latest_price=row['latest_price'],
        latest_price_date=row['latest_price_date'],
        latest_supplier=row['latest_supplier'],
        price_count=row['price_count']
    )


@router.post("/", response_model=Product)
async def create_product(
    product: ProductCreate,
    user_id: str = Depends(get_user_id)
):
    """Create a new product"""
    
    # Check if product with same name already exists
    existing = await db.fetchone(
        "SELECT product_id FROM t_d_product WHERE LOWER(product_name) = LOWER($1)",
        product.product_name
    )
    
    if existing:
        raise HTTPException(
            status_code=400, 
            detail="Product with this name already exists"
        )
    
    # Insert new product
    query = """
        INSERT INTO t_d_product (
            product_name, category_name, unit_measure, 
            barcode, description, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
    """
    
    row = await db.fetchone(
        query,
        product.product_name,
        product.category_name,
        product.unit_measure,
        product.barcode,
        product.description,
        product.is_active
    )
    
    return Product(**dict(row))


@router.put("/{product_id}", response_model=Product)
async def update_product(
    product_id: int,
    product: ProductUpdate,
    user_id: str = Depends(get_user_id)
):
    """Update an existing product"""
    
    # Check if product exists
    existing = await db.fetchone(
        "SELECT product_id FROM t_d_product WHERE product_id = $1",
        product_id
    )
    
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Build UPDATE query dynamically
    update_fields = []
    params = []
    param_count = 0
    
    if product.product_name is not None:
        param_count += 1
        update_fields.append(f"product_name = ${param_count}")
        params.append(product.product_name)
    
    if product.category_name is not None:
        param_count += 1
        update_fields.append(f"category_name = ${param_count}")
        params.append(product.category_name)
    
    if product.unit_measure is not None:
        param_count += 1
        update_fields.append(f"unit_measure = ${param_count}")
        params.append(product.unit_measure)
    
    if product.barcode is not None:
        param_count += 1
        update_fields.append(f"barcode = ${param_count}")
        params.append(product.barcode)
    
    if product.description is not None:
        param_count += 1
        update_fields.append(f"description = ${param_count}")
        params.append(product.description)
    
    if product.is_active is not None:
        param_count += 1
        update_fields.append(f"is_active = ${param_count}")
        params.append(product.is_active)
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    param_count += 1
    params.append(product_id)
    
    query = f"""
        UPDATE t_d_product 
        SET {', '.join(update_fields)}
        WHERE product_id = ${param_count}
        RETURNING *
    """
    
    row = await db.fetchone(query, *params)
    return Product(**dict(row))


@router.delete("/{product_id}")
async def delete_product(
    product_id: int,
    user_id: str = Depends(get_user_id)
):
    """Delete a product (soft delete by setting is_active = false)"""
    
    result = await db.execute(
        """
        UPDATE t_d_product 
        SET is_active = false 
        WHERE product_id = $1 AND is_active = true
        """,
        product_id
    )
    
    if "0" in result:
        raise HTTPException(status_code=404, detail="Product not found or already deleted")
    
    return {"status": "success", "message": "Product deleted"}


# Product Price endpoints
@router.get("/{product_id}/prices", response_model=ProductPriceHistory)
async def get_product_price_history(
    product_id: int,
    user_id: str = Depends(get_user_id)
):
    """Get price history for a product"""
    
    # Get product info
    product = await db.fetchone(
        "SELECT product_name FROM t_d_product WHERE product_id = $1",
        product_id
    )
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Get price history
    prices = await db.fetchall(
        """
        SELECT * FROM t_f_product_price
        WHERE product_id = $1 AND user_id = $2
        ORDER BY price_date DESC, price_id DESC
        """,
        product_id,
        int(user_id)
    )
    
    # Calculate statistics
    if prices:
        price_values = [float(p['price_value']) for p in prices]
        avg_price = sum(price_values) / len(price_values)
        min_price = min(price_values)
        max_price = max(price_values)
    else:
        avg_price = min_price = max_price = None
    
    return ProductPriceHistory(
        product_id=product_id,
        product_name=product['product_name'],
        prices=[ProductPrice(**dict(p)) for p in prices],
        average_price=avg_price,
        min_price=min_price,
        max_price=max_price
    )


@router.post("/{product_id}/prices", response_model=ProductPrice)
async def add_product_price(
    product_id: int,
    price: ProductPriceCreate,
    user_id: str = Depends(get_user_id)
):
    """Add a new price for a product"""
    
    # Verify product exists
    product = await db.fetchone(
        "SELECT product_id FROM t_d_product WHERE product_id = $1",
        product_id
    )
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Ensure product_id matches
    if price.product_id != product_id:
        raise HTTPException(status_code=400, detail="Product ID mismatch")
    
    # Insert price
    query = """
        INSERT INTO t_f_product_price (
            product_id, supplier_name, price_value, price_date, user_id
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    """
    
    row = await db.fetchone(
        query,
        product_id,
        price.supplier_name,
        price.price_value,
        price.price_date,
        int(user_id)
    )
    
    return ProductPrice(**dict(row))


# Product-Nomenclature linking
@router.post("/{product_id}/nomenclatures/{nomenclature_id}")
async def link_product_to_nomenclature(
    product_id: int,
    nomenclature_id: int,
    user_id: str = Depends(get_user_id)
):
    """Link product to nomenclature category"""
    
    # Check if link already exists
    existing = await db.fetchone(
        """
        SELECT 1 FROM t_l_product_nomenclature 
        WHERE product_id = $1 AND nomenclature_id = $2
        """,
        product_id,
        nomenclature_id
    )
    
    if existing:
        raise HTTPException(status_code=400, detail="Link already exists")
    
    # Create link
    await db.execute(
        """
        INSERT INTO t_l_product_nomenclature (product_id, nomenclature_id)
        VALUES ($1, $2)
        """,
        product_id,
        nomenclature_id
    )
    
    return {"status": "success", "message": "Product linked to nomenclature"}


@router.delete("/{product_id}/nomenclatures/{nomenclature_id}")
async def unlink_product_from_nomenclature(
    product_id: int,
    nomenclature_id: int,
    user_id: str = Depends(get_user_id)
):
    """Remove link between product and nomenclature"""
    
    result = await db.execute(
        """
        DELETE FROM t_l_product_nomenclature 
        WHERE product_id = $1 AND nomenclature_id = $2
        """,
        product_id,
        nomenclature_id
    )
    
    if "0" in result:
        raise HTTPException(status_code=404, detail="Link not found")
    
    return {"status": "success", "message": "Link removed"}


# Import endpoints
@router.post("/import/csv", response_model=ProductImportResult)
async def import_products_csv(
    file: UploadFile = File(...),
    user_id: str = Depends(get_user_id)
):
    """Import products from CSV file"""
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be CSV format")
    
    # Read CSV content
    content = await file.read()
    text_content = content.decode('utf-8')
    
    # Parse CSV
    csv_reader = csv.DictReader(io.StringIO(text_content))
    
    result = ProductImportResult(
        total_rows=0,
        imported=0,
        skipped=0,
        errors=[],
        imported_products=[]
    )
    
    for row_num, row in enumerate(csv_reader, 1):
        result.total_rows += 1
        
        try:
            # Validate required fields
            if not row.get('product_name'):
                result.errors.append(f"Row {row_num}: Product name is required")
                result.skipped += 1
                continue
            
            # Check if product exists
            existing = await db.fetchone(
                "SELECT product_id FROM t_d_product WHERE LOWER(product_name) = LOWER($1)",
                row['product_name']
            )
            
            if existing:
                product_id = existing['product_id']
                result.skipped += 1
            else:
                # Create product
                product_row = await db.fetchone(
                    """
                    INSERT INTO t_d_product (
                        product_name, category_name, unit_measure, barcode
                    ) VALUES ($1, $2, $3, $4)
                    RETURNING product_id
                    """,
                    row['product_name'],
                    row.get('category'),
                    row.get('unit'),
                    row.get('barcode')
                )
                product_id = product_row['product_id']
                result.imported += 1
                result.imported_products.append(product_id)
            
            # Add price if provided
            if row.get('price'):
                try:
                    price_value = Decimal(row['price'])
                    if price_value > 0:
                        await db.execute(
                            """
                            INSERT INTO t_f_product_price (
                                product_id, supplier_name, price_value, user_id
                            ) VALUES ($1, $2, $3, $4)
                            """,
                            product_id,
                            row.get('supplier'),
                            price_value,
                            int(user_id)
                        )
                except (ValueError, TypeError):
                    result.errors.append(f"Row {row_num}: Invalid price value")
        
        except Exception as e:
            result.errors.append(f"Row {row_num}: {str(e)}")
            result.skipped += 1
    
    return result


# Categories endpoint
@router.get("/categories", response_model=List[str])
async def get_product_categories(user_id: str = Depends(get_user_id)):
    """Get distinct product categories"""
    
    rows = await db.fetchall(
        """
        SELECT DISTINCT category_name 
        FROM t_d_product 
        WHERE category_name IS NOT NULL 
        ORDER BY category_name
        """
    )
    
    return [row['category_name'] for row in rows]