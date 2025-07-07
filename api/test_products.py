#!/usr/bin/env python3
"""
Test script for Product API endpoints
"""

import asyncio
import aiohttp
import json
from decimal import Decimal
from datetime import date

# API base URL
API_URL = "http://localhost:8888"
USER_ID = "1"  # Test user ID

# Test products data
TEST_PRODUCTS = [
    {
        "product_name": "Молоко Простоквашино 2.5%",
        "category_name": "Молочные продукты",
        "unit_measure": "л",
        "barcode": "4600605025796",
        "description": "2.5% жирности, пастеризованное"
    },
    {
        "product_name": "Хлеб Дарницкий",
        "category_name": "Хлебобулочные изделия",
        "unit_measure": "шт",
        "barcode": "4601234567890",
        "description": "Ржано-пшеничный хлеб"
    },
    {
        "product_name": "Яблоки Голден",
        "category_name": "Фрукты",
        "unit_measure": "кг",
        "description": "Сорт Голден Делишес"
    }
]


async def test_create_product(session: aiohttp.ClientSession):
    """Test creating products"""
    print("\n1️⃣ Testing product creation...")
    
    created_products = []
    
    for product_data in TEST_PRODUCTS:
        async with session.post(
            f"{API_URL}/api/products/",
            headers={"X-User-Id": USER_ID},
            json=product_data
        ) as response:
            if response.status == 200:
                product = await response.json()
                created_products.append(product)
                print(f"✅ Created product: {product['product_name']} (ID: {product['product_id']})")
            else:
                error = await response.text()
                print(f"❌ Failed to create product: {error}")
    
    return created_products


async def test_search_products(session: aiohttp.ClientSession):
    """Test searching products"""
    print("\n2️⃣ Testing product search...")
    
    # Test 1: Search all products
    async with session.get(
        f"{API_URL}/api/products/",
        headers={"X-User-Id": USER_ID},
        params={"page": 1, "limit": 10}
    ) as response:
        if response.status == 200:
            data = await response.json()
            print(f"✅ Found {data['total']} products")
            for item in data['items']:
                print(f"   - {item['product_name']} ({item['category_name']})")
        else:
            print(f"❌ Search failed: {await response.text()}")
    
    # Test 2: Search by category
    async with session.get(
        f"{API_URL}/api/products/",
        headers={"X-User-Id": USER_ID},
        params={"category": "Молочные продукты"}
    ) as response:
        if response.status == 200:
            data = await response.json()
            print(f"✅ Found {data['total']} products in 'Молочные продукты'")
        else:
            print(f"❌ Category search failed")
    
    # Test 3: Search by keyword
    async with session.get(
        f"{API_URL}/api/products/",
        headers={"X-User-Id": USER_ID},
        params={"search": "хлеб"}
    ) as response:
        if response.status == 200:
            data = await response.json()
            print(f"✅ Found {data['total']} products matching 'хлеб'")
        else:
            print(f"❌ Keyword search failed")


async def test_add_prices(session: aiohttp.ClientSession, products):
    """Test adding prices to products"""
    print("\n3️⃣ Testing price addition...")
    
    price_data = [
        {"supplier_name": "Пятерочка", "price_value": 89.90},
        {"supplier_name": "Магнит", "price_value": 45.00},
        {"supplier_name": "Перекресток", "price_value": 120.50}
    ]
    
    for i, product in enumerate(products[:3]):
        price_info = price_data[i % len(price_data)]
        
        async with session.post(
            f"{API_URL}/api/products/{product['product_id']}/prices",
            headers={"X-User-Id": USER_ID},
            json={
                "product_id": product['product_id'],
                "supplier_name": price_info["supplier_name"],
                "price_value": price_info["price_value"],
                "price_date": str(date.today())
            }
        ) as response:
            if response.status == 200:
                price = await response.json()
                print(f"✅ Added price for {product['product_name']}: "
                      f"{price['price_value']} руб. ({price['supplier_name']})")
            else:
                print(f"❌ Failed to add price: {await response.text()}")


async def test_price_history(session: aiohttp.ClientSession, product_id: int):
    """Test getting price history"""
    print(f"\n4️⃣ Testing price history for product {product_id}...")
    
    async with session.get(
        f"{API_URL}/api/products/{product_id}/prices",
        headers={"X-User-Id": USER_ID}
    ) as response:
        if response.status == 200:
            data = await response.json()
            print(f"✅ Price history for {data['product_name']}:")
            print(f"   - Average price: {data['average_price']} руб.")
            print(f"   - Min price: {data['min_price']} руб.")
            print(f"   - Max price: {data['max_price']} руб.")
            print(f"   - Price entries: {len(data['prices'])}")
        else:
            print(f"❌ Failed to get price history: {await response.text()}")


async def test_update_product(session: aiohttp.ClientSession, product_id: int):
    """Test updating a product"""
    print(f"\n5️⃣ Testing product update for ID {product_id}...")
    
    update_data = {
        "description": "Updated description with more details",
        "is_active": True
    }
    
    async with session.put(
        f"{API_URL}/api/products/{product_id}",
        headers={"X-User-Id": USER_ID},
        json=update_data
    ) as response:
        if response.status == 200:
            product = await response.json()
            print(f"✅ Updated product: {product['product_name']}")
            print(f"   New description: {product['description']}")
        else:
            print(f"❌ Failed to update product: {await response.text()}")


async def test_categories(session: aiohttp.ClientSession):
    """Test getting product categories"""
    print("\n6️⃣ Testing categories endpoint...")
    
    async with session.get(
        f"{API_URL}/api/products/categories",
        headers={"X-User-Id": USER_ID}
    ) as response:
        if response.status == 200:
            categories = await response.json()
            print(f"✅ Found {len(categories)} categories:")
            for cat in categories:
                print(f"   - {cat}")
        else:
            print(f"❌ Failed to get categories: {await response.text()}")


async def test_csv_import(session: aiohttp.ClientSession):
    """Test CSV import"""
    print("\n7️⃣ Testing CSV import...")
    
    csv_content = """product_name,category,unit,price,supplier,barcode
Сахар-песок,Бакалея,кг,65.90,Ашан,4600123456789
Картофель,Овощи,кг,35.50,Рынок,
Масло подсолнечное,Бакалея,л,120.00,Пятерочка,4601234567891
"""
    
    # Create form data
    data = aiohttp.FormData()
    data.add_field('file',
                   csv_content.encode('utf-8'),
                   filename='products.csv',
                   content_type='text/csv')
    
    async with session.post(
        f"{API_URL}/api/products/import/csv",
        headers={"X-User-Id": USER_ID},
        data=data
    ) as response:
        if response.status == 200:
            result = await response.json()
            print(f"✅ CSV import completed:")
            print(f"   - Total rows: {result['total_rows']}")
            print(f"   - Imported: {result['imported']}")
            print(f"   - Skipped: {result['skipped']}")
            if result['errors']:
                print(f"   - Errors: {result['errors']}")
        else:
            print(f"❌ Failed to import CSV: {await response.text()}")


async def main():
    """Run all tests"""
    print("🧪 Product API Test Suite")
    print(f"Testing API at: {API_URL}")
    print("=" * 50)
    
    async with aiohttp.ClientSession() as session:
        # Create products
        products = await test_create_product(session)
        
        if products:
            # Search products
            await test_search_products(session)
            
            # Add prices
            await test_add_prices(session, products)
            
            # Get price history
            if len(products) > 0:
                await test_price_history(session, products[0]['product_id'])
            
            # Update product
            if len(products) > 0:
                await test_update_product(session, products[0]['product_id'])
            
            # Get categories
            await test_categories(session)
            
            # Test CSV import
            await test_csv_import(session)
        
        print("\n✅ All tests completed!")


if __name__ == "__main__":
    asyncio.run(main())