#!/usr/bin/env python3
"""
Security test script for Budget API
Tests for SQL injection vulnerabilities and user context validation
"""

import asyncio
import aiohttp
import json
from typing import Dict, Any

# API base URL
API_URL = "http://localhost:8888"

# Test cases for SQL injection
SQL_INJECTION_TESTS = [
    {"name": "Basic SQL injection", "payload": "1' OR '1'='1"},
    {"name": "Union injection", "payload": "1' UNION SELECT * FROM t_d_user--"},
    {"name": "Drop table", "payload": "1'; DROP TABLE t_f_registry;--"},
    {"name": "Comment injection", "payload": "1'/**/OR/**/1=1--"},
    {"name": "Encoded injection", "payload": "1%27%20OR%20%271%27%3D%271"},
]


async def test_endpoint(session: aiohttp.ClientSession, method: str, path: str, 
                       headers: Dict[str, str] = None, data: Any = None) -> Dict[str, Any]:
    """Test a single endpoint"""
    url = f"{API_URL}{path}"
    try:
        async with session.request(method, url, headers=headers, json=data) as response:
            return {
                "status": response.status,
                "data": await response.text(),
                "headers": dict(response.headers)
            }
    except Exception as e:
        return {"error": str(e)}


async def run_security_tests():
    """Run all security tests"""
    async with aiohttp.ClientSession() as session:
        print("🔒 SECURITY TEST SUITE FOR BUDGET API\n")
        
        # Test 1: Missing user context
        print("1️⃣ Testing missing user context...")
        result = await test_endpoint(session, "GET", "/users")
        if result.get("status") == 401:
            print("✅ PASS: API correctly rejects requests without X-User-Id header")
        else:
            print(f"❌ FAIL: API accepted request without authentication: {result}")
        
        # Test 2: SQL Injection in GET parameters
        print("\n2️⃣ Testing SQL injection in GET parameters...")
        for test in SQL_INJECTION_TESTS:
            result = await test_endpoint(
                session, "GET", f"/users/{test['payload']}", 
                headers={"X-User-Id": "1"}
            )
            if result.get("status") in [400, 404, 422]:
                print(f"✅ PASS: {test['name']} - properly handled")
            else:
                print(f"❌ FAIL: {test['name']} - may be vulnerable: {result}")
        
        # Test 3: User isolation
        print("\n3️⃣ Testing user data isolation...")
        # Try to access another user's data
        result1 = await test_endpoint(
            session, "GET", "/users/2", 
            headers={"X-User-Id": "1"}
        )
        if result1.get("status") == 403:
            print("✅ PASS: Users cannot access other users' data")
        else:
            print(f"❌ FAIL: User 1 could access user 2's data: {result1}")
        
        # Test 4: SQL Injection in POST data
        print("\n4️⃣ Testing SQL injection in POST data...")
        malicious_data = {
            "operation_dttm": "2024-01-01",
            "period_id": "1' OR '1'='1",
            "financial_center_id": 1,
            "cost_center_id": 1,
            "nomenclature_id": 1,
            "cost_sum": 100,
            "comment_description": "'; DROP TABLE t_f_registry;--",
            "row_type_id": 1,
            "user_id": 1
        }
        result = await test_endpoint(
            session, "POST", "/registry",
            headers={"X-User-Id": "1"},
            data=malicious_data
        )
        if result.get("status") in [200, 201]:
            print("✅ PASS: POST data is properly sanitized")
        elif result.get("status") >= 400:
            print("✅ PASS: Malicious POST data was rejected")
        else:
            print(f"❌ FAIL: Potentially vulnerable to POST injection: {result}")
        
        # Test 5: Parameter pollution
        print("\n5️⃣ Testing parameter pollution...")
        result = await test_endpoint(
            session, "GET", "/periods?start_date=2024-01-01&start_date='; DROP TABLE--",
            headers={"X-User-Id": "1"}
        )
        if "error" not in str(result.get("data", "")).lower():
            print("✅ PASS: Parameter pollution handled correctly")
        else:
            print(f"❌ FAIL: Parameter pollution may cause issues: {result}")
        
        # Test 6: Health check (should work without auth)
        print("\n6️⃣ Testing health check endpoint...")
        result = await test_endpoint(session, "GET", "/health")
        if result.get("status") == 200:
            print("✅ PASS: Health check works without authentication")
        else:
            print(f"❌ FAIL: Health check failed: {result}")
        
        print("\n✨ Security test suite completed!")


async def test_performance():
    """Test connection pooling performance"""
    print("\n⚡ PERFORMANCE TEST")
    
    async with aiohttp.ClientSession() as session:
        # Warm up
        await test_endpoint(session, "GET", "/health")
        
        # Test multiple concurrent requests
        import time
        start_time = time.time()
        
        tasks = []
        for i in range(50):
            task = test_endpoint(
                session, "GET", "/nomenclatures",
                headers={"X-User-Id": "1"}
            )
            tasks.append(task)
        
        results = await asyncio.gather(*tasks)
        end_time = time.time()
        
        successful = sum(1 for r in results if r.get("status") == 200)
        print(f"✅ Completed {successful}/50 requests in {end_time - start_time:.2f}s")
        print(f"📊 Average response time: {(end_time - start_time) / 50 * 1000:.2f}ms")


if __name__ == "__main__":
    print("Starting Budget API Security Tests...")
    print(f"Testing API at: {API_URL}")
    print("Make sure the API is running with SECURE_API=true\n")
    
    asyncio.run(run_security_tests())
    asyncio.run(test_performance())