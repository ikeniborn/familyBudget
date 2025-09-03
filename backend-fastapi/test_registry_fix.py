#!/usr/bin/env python3
"""Test script for registry API fix."""

import asyncio
import httpx
import json
from datetime import datetime

async def test_registry_creation():
    """Test registry entry creation with and without cost_center_id."""
    
    base_url = "http://localhost:4000"
    
    # First, login to get session
    async with httpx.AsyncClient() as session:
        # Login
        login_data = {
            "username": "admin",
            "password": "admin123"  # Use your actual test credentials
        }
        
        resp = await session.post(f"{base_url}/api/auth/login", json=login_data)
        if resp.status_code != 200:
            print(f"Login failed: {resp.status_code}")
            print(f"Response: {resp.text}")
            return
        
        print("✅ Login successful")
        
        # Test 1: Create entry WITH cost_center_id
        entry_with_cc = {
            "operation_dttm": datetime.now().isoformat(),
            "period_id": 1,
            "financial_center_id": 1,
            "cost_center_id": 1,  # Including cost center
            "nomenclature_id": 1,
            "row_type_id": 2,  # Fact
            "cost_sum": 100.50,
            "comment_description": "Test with cost center"
        }
        
        resp = await session.post(f"{base_url}/api/registry/", json=entry_with_cc)
        if resp.status_code == 200:
            data = resp.json()
            print(f"✅ Entry with cost_center_id created: ID={data['id']}")
        else:
            print(f"❌ Failed to create entry with cost_center_id: {resp.status_code}")
            print(f"Response: {resp.text}")
        
        # Test 2: Create entry WITHOUT cost_center_id
        entry_without_cc = {
            "operation_dttm": datetime.now().isoformat(),
            "period_id": 1,
            "financial_center_id": 1,
            # No cost_center_id - this should work now
            "nomenclature_id": 1,
            "row_type_id": 2,  # Fact
            "cost_sum": 213.00,
            "comment_description": "Test without cost center"
        }
        
        resp = await session.post(f"{base_url}/api/registry/", json=entry_without_cc)
        if resp.status_code == 200:
            data = resp.json()
            print(f"✅ Entry without cost_center_id created: ID={data['id']}")
            print(f"   cost_center_id in response: {data.get('cost_center_id')}")
        else:
            print(f"❌ Failed to create entry without cost_center_id: {resp.status_code}")
            print(f"Response: {resp.text}")

if __name__ == "__main__":
    asyncio.run(test_registry_creation())