#!/usr/bin/env python3
import requests

# Login to get session
login_data = {
    "username": "admin",
    "password": "admin123"  # Try common password
}

# Start session
session = requests.Session()

# Try login
print("Attempting login...")
response = session.post("http://localhost:5173/api/auth/login", json=login_data)
print(f"Login response: {response.status_code}")
print(f"Response: {response.text}")

if response.status_code != 200:
    print("\nTrying different password...")
    login_data['password'] = 'admin'
    response = session.post("http://localhost:5173/api/auth/login", json=login_data)
    print(f"Login response: {response.status_code}")
    print(f"Response: {response.text}")

if response.status_code == 200:
    print("\n✓ Logged in successfully!")
    print(f"Cookies: {session.cookies}")

    # Test articles API
    print("\nTesting /api/articles/...")
    response = session.get("http://localhost:5173/api/articles/")
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text[:500]}")

    # Test stats
    print("\nTesting /api/articles/stats...")
    response = session.get("http://localhost:5173/api/articles/stats")
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")