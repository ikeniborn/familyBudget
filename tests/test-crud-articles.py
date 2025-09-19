#!/usr/bin/env python3
import requests
import json

# Start session and login
session = requests.Session()
login_data = {"username": "admin", "password": "admin"}  # Default admin password
response = session.post("http://localhost:5173/api/auth/login", json=login_data)

if response.status_code != 200:
    print("Failed to login")
    exit(1)

print("✓ Logged in successfully")

# Test CREATE
print("\n1. Testing CREATE article...")
new_article = {
    "code": "TEST_ART_001",
    "name": "Test Article 001",
    "description": "Test article created via script",
    "is_active": True
}
response = session.post("http://localhost:5173/api/articles/", json=new_article)
print(f"Status: {response.status_code}")
print(f"Response: {json.dumps(response.json(), indent=2)[:500]}")

if response.status_code == 200:
    data = response.json()
    if data.get('success') and data.get('data'):
        article_id = data['data']['id']
        print(f"✓ Created article with ID: {article_id}")

        # Test UPDATE
        print(f"\n2. Testing UPDATE article {article_id}...")
        update_data = {
            "name": "Updated Test Article 001",
            "description": "Updated description"
        }
        response = session.put(f"http://localhost:5173/api/articles/{article_id}", json=update_data)
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)[:500]}")

        if response.status_code == 200:
            print("✓ Updated successfully")

        # Test DELETE
        print(f"\n3. Testing DELETE article {article_id}...")
        response = session.delete(f"http://localhost:5173/api/articles/{article_id}")
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")

        if response.status_code == 200:
            print("✓ Deleted successfully")
else:
    print("✗ Failed to create article - check if already exists")

# Test with existing article
print("\n4. Testing with existing article (ID=1)...")
response = session.get("http://localhost:5173/api/articles/1")
print(f"Status: {response.status_code}")
data = response.json()
if data.get('success') and data.get('data'):
    article = data['data']
    print(f"Article: {article['name']} (code: {article['code']})")
    print(f"Is editable: {article.get('is_editable', False)}")
    print(f"Is shared: {article.get('is_shared', False)}")