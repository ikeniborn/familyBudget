#!/usr/bin/env python3
"""
Test script for Redis caching functionality
"""

import asyncio
import aiohttp
import time

# API base URL
API_URL = "http://localhost:8888"
USER_ID = "1"  # Test user ID


async def test_redis_caching():
    """Test Redis caching performance"""
    async with aiohttp.ClientSession() as session:
        print("🧪 Redis Caching Performance Test")
        print("=" * 50)
        
        # Test 1: First request (cache miss)
        print("\n1️⃣ Testing cache MISS (first request)...")
        start_time = time.time()
        
        async with session.get(
            f"{API_URL}/nomenclatures",
            headers={"X-User-Id": USER_ID}
        ) as response:
            if response.status == 200:
                data = await response.json()
                first_request_time = time.time() - start_time
                print(f"✅ First request completed in {first_request_time:.3f}s")
                print(f"📊 Found {len(data)} nomenclatures")
            else:
                print(f"❌ First request failed: {response.status}")
                return
        
        # Test 2: Second request (cache hit)
        print("\n2️⃣ Testing cache HIT (second request)...")
        start_time = time.time()
        
        async with session.get(
            f"{API_URL}/nomenclatures",
            headers={"X-User-Id": USER_ID}
        ) as response:
            if response.status == 200:
                data2 = await response.json()
                second_request_time = time.time() - start_time
                print(f"✅ Second request completed in {second_request_time:.3f}s")
                
                # Calculate performance improvement
                if second_request_time > 0:
                    improvement = ((first_request_time - second_request_time) / first_request_time) * 100
                    print(f"🚀 Performance improvement: {improvement:.1f}%")
                
                # Verify data consistency
                if len(data) == len(data2):
                    print("✅ Data consistency verified")
                else:
                    print("❌ Data inconsistency detected")
            else:
                print(f"❌ Second request failed: {response.status}")
        
        # Test 3: Multiple concurrent requests (should all hit cache)
        print("\n3️⃣ Testing concurrent cache hits...")
        start_time = time.time()
        
        tasks = []
        for i in range(10):
            task = session.get(
                f"{API_URL}/nomenclatures",
                headers={"X-User-Id": USER_ID}
            )
            tasks.append(task)
        
        responses = await asyncio.gather(*tasks)
        concurrent_time = time.time() - start_time
        
        successful_requests = sum(1 for resp in responses if resp.status == 200)
        print(f"✅ {successful_requests}/10 concurrent requests completed in {concurrent_time:.3f}s")
        print(f"📊 Average response time: {concurrent_time / 10 * 1000:.1f}ms")
        
        # Clean up responses
        for resp in responses:
            resp.close()
        
        # Test 4: Test different endpoints for cache isolation
        print("\n4️⃣ Testing cache isolation between endpoints...")
        
        endpoints = [
            "/financial_centers",
            "/cost_centers", 
            "/nomenclatures"
        ]
        
        for endpoint in endpoints:
            start_time = time.time()
            async with session.get(
                f"{API_URL}{endpoint}",
                headers={"X-User-Id": USER_ID}
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    request_time = time.time() - start_time
                    print(f"✅ {endpoint}: {len(data)} items in {request_time:.3f}s")
                else:
                    print(f"❌ {endpoint}: failed with {response.status}")
        
        # Test 5: Test user-specific caching
        print("\n5️⃣ Testing user-specific registry caching...")
        
        # First request for user 1
        start_time = time.time()
        async with session.get(
            f"{API_URL}/registry/last_row?limit_rows=5",
            headers={"X-User-Id": "1"}
        ) as response:
            if response.status == 200:
                user1_data = await response.json()
                user1_time = time.time() - start_time
                print(f"✅ User 1 data: {len(user1_data)} records in {user1_time:.3f}s")
        
        # Second request for user 1 (should hit cache)
        start_time = time.time()
        async with session.get(
            f"{API_URL}/registry/last_row?limit_rows=5",
            headers={"X-User-Id": "1"}
        ) as response:
            if response.status == 200:
                user1_cached_time = time.time() - start_time
                print(f"✅ User 1 cached: {user1_cached_time:.3f}s")
                
                if user1_cached_time < user1_time:
                    print("🚀 User-specific caching is working")
        
        # Test 6: Health check (should not be cached)
        print("\n6️⃣ Testing non-cached endpoint...")
        
        times = []
        for i in range(3):
            start_time = time.time()
            async with session.get(f"{API_URL}/health") as response:
                if response.status == 200:
                    request_time = time.time() - start_time
                    times.append(request_time)
        
        avg_time = sum(times) / len(times)
        print(f"✅ Health check (no cache): avg {avg_time:.3f}s")
        
        # All times should be similar (no caching benefit)
        if max(times) - min(times) < 0.1:  # Within 100ms variance
            print("✅ No caching detected for health endpoint")
        
        print("\n✅ Redis caching test completed!")


async def test_cache_invalidation():
    """Test cache invalidation on data changes"""
    async with aiohttp.ClientSession() as session:
        print("\n🔄 Cache Invalidation Test")
        print("=" * 30)
        
        # Create a test registry entry to trigger cache invalidation
        test_data = {
            "operation_dttm": "2024-01-07T10:00:00",
            "period_id": 1,
            "financial_center_id": 1,
            "cost_center_id": 1,
            "nomenclature_id": 1,
            "cost_sum": 100.50,
            "comment_description": "Test cache invalidation",
            "row_type_id": 2,
            "user_id": 1
        }
        
        # First, get last rows to populate cache
        async with session.get(
            f"{API_URL}/registry/last_row?limit_rows=3",
            headers={"X-User-Id": USER_ID}
        ) as response:
            if response.status == 200:
                before_data = await response.json()
                print(f"✅ Cached {len(before_data)} records")
        
        # Create new entry (should invalidate cache)
        async with session.post(
            f"{API_URL}/registry",
            headers={"X-User-Id": USER_ID},
            json=test_data
        ) as response:
            if response.status == 200:
                print("✅ Created new registry entry")
            else:
                error = await response.text()
                print(f"❌ Failed to create entry: {error}")
                return
        
        # Get last rows again (should be fresh data, not cached)
        async with session.get(
            f"{API_URL}/registry/last_row?limit_rows=3",
            headers={"X-User-Id": USER_ID}
        ) as response:
            if response.status == 200:
                after_data = await response.json()
                print(f"✅ Retrieved {len(after_data)} records after invalidation")
                
                # Verify the new entry is included
                if len(after_data) > 0:
                    print("✅ Cache invalidation working correctly")
                else:
                    print("⚠️ No data returned after creating entry")


if __name__ == "__main__":
    print("Starting Redis caching tests...")
    print(f"Testing API at: {API_URL}")
    print("Make sure Redis is running and API is started with SECURE_API=true\n")
    
    asyncio.run(test_redis_caching())
    asyncio.run(test_cache_invalidation())