#!/usr/bin/env python3
"""
Simple CRUD Fixes Validation Tests

This script tests the recent CRUD fixes in the Family Budget application:
1. Period creation - removed invalid 'created_by' field
2. Financial Centers - made user_id optional in schema
3. Cost Centers - made user_id optional in schema
4. Articles - fixed ArticleStats instantiation

Run with: docker exec budget-backend python test_crud_fixes_simple.py
"""

import sys
import os
import asyncio
import json
from datetime import datetime
from typing import Dict, Any

# Add the app directory to the Python path
sys.path.insert(0, '/app')

try:
    from fastapi.testclient import TestClient
    from app.main import app
    from app.schemas.period import PeriodCreate
    from app.schemas.financial_center import FinancialCenterCreate
    from app.schemas.cost_center import CostCenterCreate
    from app.schemas.article import ArticleCreate, ArticleStats

    print("✅ All imports successful")
except ImportError as e:
    print(f"❌ Import error: {e}")
    sys.exit(1)


class SimpleCRUDTest:
    """Simple CRUD test runner."""

    def __init__(self):
        self.client = TestClient(app)
        self.results = {}

    def test_schemas_can_be_instantiated(self):
        """Test that all schemas can be instantiated without errors."""
        print("\n🧪 Testing schema instantiation...")

        try:
            # Test Period creation without created_by
            period_data = {
                "date": datetime.now(),
                "ru_name": "Test Period"
            }
            period_schema = PeriodCreate(**period_data)
            print(f"✅ PeriodCreate schema: {period_schema}")
            self.results['period_schema'] = True

        except Exception as e:
            print(f"❌ PeriodCreate schema failed: {e}")
            self.results['period_schema'] = False

        try:
            # Test Financial Center without user_id
            fc_data = {
                "code": "TEST",
                "name": "Test Financial Center",
                "is_active": True
            }
            fc_schema = FinancialCenterCreate(**fc_data)
            print(f"✅ FinancialCenterCreate schema: {fc_schema}")
            self.results['fc_schema'] = True

        except Exception as e:
            print(f"❌ FinancialCenterCreate schema failed: {e}")
            self.results['fc_schema'] = False

        try:
            # Test Cost Center without user_id
            cc_data = {
                "code": "TEST",
                "name": "Test Cost Center",
                "is_active": True
            }
            cc_schema = CostCenterCreate(**cc_data)
            print(f"✅ CostCenterCreate schema: {cc_schema}")
            self.results['cc_schema'] = True

        except Exception as e:
            print(f"❌ CostCenterCreate schema failed: {e}")
            self.results['cc_schema'] = False

        try:
            # Test Article creation
            article_data = {
                "code": "TEST",
                "name": "Test Article",
                "is_active": True
            }
            article_schema = ArticleCreate(**article_data)
            print(f"✅ ArticleCreate schema: {article_schema}")
            self.results['article_schema'] = True

        except Exception as e:
            print(f"❌ ArticleCreate schema failed: {e}")
            self.results['article_schema'] = False

        try:
            # Test ArticleStats instantiation
            stats_data = {"total": 10, "active": 8, "inactive": 2}
            stats_schema = ArticleStats(**stats_data)
            print(f"✅ ArticleStats schema: {stats_schema}")
            self.results['stats_schema'] = True

        except Exception as e:
            print(f"❌ ArticleStats schema failed: {e}")
            self.results['stats_schema'] = False

    def test_api_endpoints_basic(self):
        """Test basic API endpoint responses (no auth required tests)."""
        print("\n🧪 Testing basic API endpoints...")

        # Test health endpoint
        try:
            response = self.client.get("/health")
            print(f"Health endpoint: {response.status_code}")
            self.results['health'] = response.status_code == 200
        except Exception as e:
            print(f"❌ Health endpoint failed: {e}")
            self.results['health'] = False

        # Test API docs endpoint
        try:
            response = self.client.get("/docs")
            print(f"Docs endpoint: {response.status_code}")
            self.results['docs'] = response.status_code == 200
        except Exception as e:
            print(f"❌ Docs endpoint failed: {e}")
            self.results['docs'] = False

    def test_auth_endpoints(self):
        """Test authentication endpoints structure."""
        print("\n🧪 Testing authentication endpoints...")

        # Test that login endpoint exists and responds
        try:
            response = self.client.post("/api/auth/login", json={
                "username": "nonexistent",
                "password": "wrong"
            })
            # We expect this to fail auth, but not crash
            print(f"Login endpoint responds: {response.status_code}")
            self.results['login_endpoint'] = response.status_code in [400, 401, 422]
        except Exception as e:
            print(f"❌ Login endpoint error: {e}")
            self.results['login_endpoint'] = False

    def test_reference_endpoints_structure(self):
        """Test that reference endpoints exist and have proper structure."""
        print("\n🧪 Testing reference endpoints structure...")

        endpoints = [
            "/api/periods/",
            "/api/financial_centers/",
            "/api/cost_centers/",
            "/api/articles/"
        ]

        for endpoint in endpoints:
            try:
                response = self.client.get(endpoint)
                # We expect 401 (auth required) not 404 (not found)
                endpoint_exists = response.status_code in [200, 401, 403]
                print(f"{endpoint}: {response.status_code} ({'✅' if endpoint_exists else '❌'})")
                self.results[f"endpoint_{endpoint.split('/')[-2]}"] = endpoint_exists
            except Exception as e:
                print(f"❌ {endpoint} failed: {e}")
                self.results[f"endpoint_{endpoint.split('/')[-2]}"] = False

    def test_openapi_schema(self):
        """Test that OpenAPI schema includes all our endpoints."""
        print("\n🧪 Testing OpenAPI schema...")

        try:
            response = self.client.get("/openapi.json")
            if response.status_code == 200:
                schema = response.json()
                paths = schema.get("paths", {})

                # Check for critical endpoints
                critical_endpoints = [
                    "/api/periods/",
                    "/api/financial_centers/",
                    "/api/cost_centers/",
                    "/api/articles/",
                    "/api/articles/stats"
                ]

                endpoints_found = 0
                for endpoint in critical_endpoints:
                    if endpoint in paths:
                        endpoints_found += 1
                        print(f"✅ {endpoint} found in schema")
                    else:
                        print(f"❌ {endpoint} missing from schema")

                self.results['openapi_schema'] = endpoints_found == len(critical_endpoints)
            else:
                print(f"❌ OpenAPI schema not accessible: {response.status_code}")
                self.results['openapi_schema'] = False

        except Exception as e:
            print(f"❌ OpenAPI schema test failed: {e}")
            self.results['openapi_schema'] = False

    def run_all_tests(self):
        """Run all test categories."""
        print("🚀 Starting Simple CRUD Fixes Validation")
        print("=" * 50)

        # Run test categories
        self.test_schemas_can_be_instantiated()
        self.test_api_endpoints_basic()
        self.test_auth_endpoints()
        self.test_reference_endpoints_structure()
        self.test_openapi_schema()

        # Print summary
        print("\n" + "=" * 50)
        print("TEST RESULTS SUMMARY")
        print("=" * 50)

        passed_tests = sum(1 for result in self.results.values() if result)
        total_tests = len(self.results)

        for test_name, result in self.results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{test_name:25s}: {status}")

        print(f"\nOverall: {passed_tests}/{total_tests} tests passed")

        if passed_tests == total_tests:
            print("\n🎉 ALL CRUD FIXES BASIC VALIDATION PASSED!")
            return True
        else:
            print(f"\n⚠️ {total_tests - passed_tests} tests failed.")
            return False


def main():
    """Main test execution."""
    print("Simple CRUD Fixes Validation Test")
    print("This test validates basic functionality without authentication")
    print("=" * 60)

    test_runner = SimpleCRUDTest()
    success = test_runner.run_all_tests()

    if success:
        print("\n🎯 Basic CRUD Fixes Validation: SUCCESS")
        return 0
    else:
        print("\n🔧 Basic CRUD Fixes Validation: NEEDS ATTENTION")
        return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)