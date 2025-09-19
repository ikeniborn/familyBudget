#!/usr/bin/env python3
import requests
import json

# Test API directly via backend
base_url = "http://localhost:4000"
session_id = "b7149ada-d832-42db-ae25-21513cf29a6f"

headers = {
    "Cookie": f"familybudget.sid=s:{session_id}",
    "Content-Type": "application/json"
}

# Test get articles
print("Testing GET /api/articles/")
response = requests.get(f"{base_url}/api/articles/", headers=headers)
print(f"Status: {response.status_code}")
print(f"Response: {json.dumps(response.json(), indent=2)[:500]}")

# Test get stats
print("\nTesting GET /api/articles/stats")
response = requests.get(f"{base_url}/api/articles/stats", headers=headers)
print(f"Status: {response.status_code}")
print(f"Response: {json.dumps(response.json(), indent=2)}")

# Test create
print("\nTesting POST /api/articles/")
new_article = {
    "code": "TEST001",
    "name": "Test Article",
    "description": "Test description",
    "is_active": True
}
response = requests.post(f"{base_url}/api/articles/", json=new_article, headers=headers)
print(f"Status: {response.status_code}")
print(f"Response: {json.dumps(response.json(), indent=2)[:500]}")

if response.status_code == 200:
    data = response.json()
    if data.get('success') and data.get('data'):
        article_id = data['data']['id']

        # Test update
        print(f"\nTesting PUT /api/articles/{article_id}")
        update_data = {
            "name": "Updated Test Article"
        }
        response = requests.put(f"{base_url}/api/articles/{article_id}", json=update_data, headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)[:500]}")

        # Test delete
        print(f"\nTesting DELETE /api/articles/{article_id}")
        response = requests.delete(f"{base_url}/api/articles/{article_id}", headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")