#!/usr/bin/env python3
"""
Quick test script to verify articles creation fix.
"""
import requests
import json
import sys

def test_articles_functionality():
    """Test articles creation and stats functionality."""
    base_url = "http://localhost:4000/api"

    # Test data
    test_article = {
        "code": "TEST001",
        "name": "Test Article",
        "description": "Test description",
        "is_active": True
    }

    print("🔍 Testing Articles API Functionality...")

    try:
        # Step 1: Try to access stats endpoint (should fail without auth)
        print("\n1. Testing stats endpoint (without auth)...")
        response = requests.get(f"{base_url}/articles/stats")
        if response.status_code == 401:
            print("✅ Stats endpoint correctly requires authentication")
        else:
            print(f"❌ Unexpected response: {response.status_code}")
            return False

        # Step 2: Test POST endpoint structure (should fail without auth)
        print("\n2. Testing create endpoint structure (without auth)...")
        response = requests.post(
            f"{base_url}/articles/",
            json=test_article,
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 401:
            print("✅ Create endpoint correctly requires authentication")
        else:
            print(f"❌ Unexpected response: {response.status_code}")
            print(f"Response content: {response.text}")
            return False

        print("\n✅ All basic API structure tests passed!")
        print("📝 Note: Full authentication testing requires valid session")
        return True

    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to API. Is the backend running?")
        return False
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        return False

if __name__ == "__main__":
    success = test_articles_functionality()
    sys.exit(0 if success else 1)