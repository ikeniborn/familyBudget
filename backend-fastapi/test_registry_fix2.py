#!/usr/bin/env python3
"""Test script for registry API fix - with proper IDs."""

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
        
        # Get existing reference data
        periods_resp = await session.get(f"{base_url}/api/periods")
        periods = periods_resp.json() if periods_resp.status_code == 200 else []
        
        fc_resp = await session.get(f"{base_url}/api/financial_centers")
        financial_centers = fc_resp.json() if fc_resp.status_code == 200 else []
        
        cc_resp = await session.get(f"{base_url}/api/cost_centers")
        cost_centers = cc_resp.json() if cc_resp.status_code == 200 else []
        
        nom_resp = await session.get(f"{base_url}/api/nomenclatures")
        nomenclatures = nom_resp.json() if nom_resp.status_code == 200 else []
        
        print(f"Found {len(periods)} periods, {len(financial_centers)} financial centers, {len(cost_centers)} cost centers, {len(nomenclatures)} nomenclatures")
        
        # Create test data if needed
        if not periods:
            period_data = {"period_name": "2025.09"}
            resp = await session.post(f"{base_url}/api/periods/", json=period_data)
            if resp.status_code == 200:
                periods = [resp.json()]
                print("✅ Created test period")
        
        if not financial_centers:
            fc_data = {"financial_center_name": "Test ЦФО"}
            resp = await session.post(f"{base_url}/api/financial_centers/", json=fc_data)
            if resp.status_code == 200:
                financial_centers = [resp.json()]
                print("✅ Created test financial center")
        
        if not cost_centers:
            cc_data = {"cost_center_name": "Test МВЗ"}
            resp = await session.post(f"{base_url}/api/cost_centers/", json=cc_data)
            if resp.status_code == 200:
                cost_centers = [resp.json()]
                print("✅ Created test cost center")
        
        if not nomenclatures:
            nom_data = {"nomenclature_name": "Test Category"}
            resp = await session.post(f"{base_url}/api/nomenclatures/", json=nom_data)
            if resp.status_code == 200:
                nomenclatures = [resp.json()]
                print("✅ Created test nomenclature")
        
        # Test 1: Create entry WITH cost_center_id
        if periods and financial_centers and cost_centers and nomenclatures:
            entry_with_cc = {
                "operation_dttm": datetime.now().isoformat(),
                "period_id": periods[0]["id"],
                "financial_center_id": financial_centers[0]["id"],
                "cost_center_id": cost_centers[0]["id"],  # Including cost center
                "nomenclature_id": nomenclatures[0]["id"],
                "row_type_id": 2,  # Fact
                "cost_sum": 100.50,
                "comment_description": "Test with cost center"
            }
            
            resp = await session.post(f"{base_url}/api/registry/", json=entry_with_cc)
            if resp.status_code == 200:
                data = resp.json()
                print(f"✅ Entry WITH cost_center_id created successfully: ID={data['id']}")
            else:
                print(f"❌ Failed to create entry with cost_center_id: {resp.status_code}")
                print(f"Response: {resp.text}")
        
        # Test 2: Create entry WITHOUT cost_center_id (this was failing before fix)
        if periods and financial_centers and nomenclatures:
            entry_without_cc = {
                "operation_dttm": datetime.now().isoformat(),
                "period_id": periods[0]["id"],
                "financial_center_id": financial_centers[0]["id"],
                # No cost_center_id - this should work now after fix
                "nomenclature_id": nomenclatures[0]["id"],
                "row_type_id": 2,  # Fact
                "cost_sum": 213.00,
                "comment_description": "Test without cost center"
            }
            
            resp = await session.post(f"{base_url}/api/registry/", json=entry_without_cc)
            if resp.status_code == 200:
                data = resp.json()
                print(f"✅ Entry WITHOUT cost_center_id created successfully: ID={data['id']}")
                print(f"   cost_center_id in response: {data.get('cost_center_id')} (should be None)")
                print("\n🎉 FIX VERIFIED: Registry entries can now be created without cost_center_id!")
            else:
                print(f"❌ Failed to create entry without cost_center_id: {resp.status_code}")
                print(f"Response: {resp.text}")

if __name__ == "__main__":
    asyncio.run(test_registry_creation())