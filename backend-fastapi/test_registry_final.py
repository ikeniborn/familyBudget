#!/usr/bin/env python3
"""Final test for registry API fix."""

import asyncio
import httpx
from datetime import datetime

async def test_registry_creation():
    """Test registry entry creation with actual IDs."""
    
    base_url = "http://localhost:4000"
    
    async with httpx.AsyncClient() as session:
        # Login
        login_data = {
            "username": "admin",
            "password": "admin123"
        }
        
        resp = await session.post(f"{base_url}/api/auth/login", json=login_data)
        if resp.status_code != 200:
            print(f"❌ Login failed: {resp.status_code}")
            return
        
        print("✅ Login successful")
        
        # Test 1: Create entry WITH cost_center_id
        print("\n📝 Test 1: Creating entry WITH cost_center_id...")
        entry_with_cc = {
            "operation_dttm": datetime.now().isoformat(),
            "period_id": 1,  # 2025.09 - Сентябрь
            "financial_center_id": 4,  # Семья
            "cost_center_id": 3,  # Авто
            "nomenclature_id": 1,  # Продукты
            "row_type_id": 2,  # Fact
            "cost_sum": 150.50,
            "comment_description": "Тест с МВЗ (Авто)"
        }
        
        resp = await session.post(f"{base_url}/api/registry/", json=entry_with_cc)
        if resp.status_code == 200:
            data = resp.json()
            print(f"✅ SUCCESS: Entry created with cost_center_id")
            print(f"   ID: {data['id']}")
            print(f"   Cost Center ID: {data['cost_center_id']}")
        else:
            print(f"❌ FAILED: Status {resp.status_code}")
            print(f"   Error: {resp.text}")
        
        # Test 2: Create entry WITHOUT cost_center_id (main test)
        print("\n📝 Test 2: Creating entry WITHOUT cost_center_id...")
        entry_without_cc = {
            "operation_dttm": datetime.now().isoformat(),
            "period_id": 1,  # 2025.09 - Сентябрь
            "financial_center_id": 4,  # Семья
            # NO cost_center_id - this was causing 500 error before fix
            "nomenclature_id": 1,  # Продукты
            "row_type_id": 2,  # Fact
            "cost_sum": 213.00,
            "comment_description": "Тест БЕЗ МВЗ"
        }
        
        resp = await session.post(f"{base_url}/api/registry/", json=entry_without_cc)
        if resp.status_code == 200:
            data = resp.json()
            print(f"✅ SUCCESS: Entry created WITHOUT cost_center_id")
            print(f"   ID: {data['id']}")
            print(f"   Cost Center ID: {data.get('cost_center_id')} (should be None)")
            print("\n🎉 FIX VERIFIED: The 500 error is resolved!")
            print("   Registry entries can now be created without cost_center_id")
        else:
            print(f"❌ FAILED: Status {resp.status_code}")
            print(f"   Error: {resp.text}")

if __name__ == "__main__":
    asyncio.run(test_registry_creation())