#!/usr/bin/env python3
"""
Comprehensive CRUD Operations Schema Fixes Test Suite

This test validates the critical CRUD operation fixes implemented in v3.8.0:
1. Period creation - removed non-existent 'created_by'/'managed_by' fields causing 500 errors
2. Financial Centers - made user_id optional in schemas, fixing 422 validation errors
3. Cost Centers - made user_id optional in schemas, fixing 422 validation errors
4. Articles - fixed ArticleStats instantiation removing invalid fields, resolving 400 errors

Validates that all settings pages are now fully functional with successful CRUD operations.

Run with: docker exec budget-backend python /app/tests/test_crud_operations_fix.py
"""

import sys
import os
import asyncio
import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

# Add the app directory to the Python path
sys.path.insert(0, '/app')

try:
    import pytest
    from fastapi.testclient import TestClient
    from sqlalchemy.orm import Session
    from app.main import app
    from app.db.session import SessionLocal
    from app.models.user import User
    from app.models.period import Period
    from app.models.financial_center import FinancialCenter
    from app.models.cost_center import CostCenter
    from app.models.article import Article
    from app.schemas.period import PeriodCreate, PeriodPublic
    from app.schemas.financial_center import FinancialCenterCreate, FinancialCenterPublic
    from app.schemas.cost_center import CostCenterCreate, CostCenterPublic
    from app.schemas.article import ArticleCreate, ArticleStats, ArticlePublic
    from app.core.security import SecurityUtils
    print("✅ All imports successful")
except ImportError as e:
    print(f"❌ Import error: {e}")
    sys.exit(1)


class CRUDOperationsTest:
    """Comprehensive test suite for CRUD operations schema fixes."""

    def __init__(self):
        self.client = TestClient(app)
        self.db = SessionLocal()
        self.test_user = None
        self.test_user_id = None
        self.auth_headers = {}
        self.created_records = {
            'periods': [],
            'financial_centers': [],
            'cost_centers': [],
            'articles': []
        }
        self.test_results = {}

    def setup_test_user(self):
        """Create a test user for authentication."""
        print("\n🔧 Setting up test user...")

        # Generate unique test user
        unique_id = str(uuid.uuid4())[:8]
        username = f"test_crud_{unique_id}"

        # Create test user
        test_user = User(
            username=username,
            user_name=f"Test CRUD User {unique_id}",
            password_hash=SecurityUtils.get_password_hash("testpassword123"),
            user_email=f"{username}@test.com",
            role="admin",  # Need admin for settings access
            telegram_id=12345678 + hash(unique_id) % 1000000  # Generate valid telegram_id
        )

        self.db.add(test_user)
        self.db.commit()
        self.db.refresh(test_user)

        self.test_user = test_user
        self.test_user_id = test_user.id

        # For testing, we'll use session-based auth instead of JWT
        # Create auth headers (we'll use session-based authentication for this test)
        self.auth_headers = {}  # Will implement session auth later if needed

        print(f"✅ Test user created: {username} (ID: {test_user.id})")
        return True

    def test_schema_instantiation(self):
        """Test 1: Verify all schemas can be instantiated without forbidden fields."""
        print("\n🧪 Test 1: Schema Instantiation (No created_by/managed_by fields)")

        try:
            # Test Period schema - should NOT have created_by/managed_by
            period_data = {
                "date": datetime.now(),
                "ru_name": "Test Period for CRUD Fix"
            }
            period_schema = PeriodCreate(**period_data)
            assert not hasattr(period_schema, 'created_by'), "PeriodCreate should not have created_by field"
            assert not hasattr(period_schema, 'managed_by'), "PeriodCreate should not have managed_by field"
            print("✅ PeriodCreate: No forbidden fields")
            self.test_results['period_schema_clean'] = True

        except Exception as e:
            print(f"❌ PeriodCreate schema failed: {e}")
            self.test_results['period_schema_clean'] = False

        try:
            # Test Financial Center schema - user_id should be optional
            fc_data = {
                "code": "TEST_FC",
                "name": "Test Financial Center",
                "is_active": True
            }
            fc_schema = FinancialCenterCreate(**fc_data)
            assert hasattr(fc_schema, 'user_id'), "FinancialCenterCreate should have user_id field"
            assert fc_schema.user_id is None, "user_id should be optional (None by default)"
            print("✅ FinancialCenterCreate: user_id is optional")
            self.test_results['fc_schema_optional_user'] = True

        except Exception as e:
            print(f"❌ FinancialCenterCreate schema failed: {e}")
            self.test_results['fc_schema_optional_user'] = False

        try:
            # Test Cost Center schema - user_id should be optional
            cc_data = {
                "code": "TEST_CC",
                "name": "Test Cost Center",
                "is_active": True
            }
            cc_schema = CostCenterCreate(**cc_data)
            assert hasattr(cc_schema, 'user_id'), "CostCenterCreate should have user_id field"
            assert cc_schema.user_id is None, "user_id should be optional (None by default)"
            print("✅ CostCenterCreate: user_id is optional")
            self.test_results['cc_schema_optional_user'] = True

        except Exception as e:
            print(f"❌ CostCenterCreate schema failed: {e}")
            self.test_results['cc_schema_optional_user'] = False

        try:
            # Test Article schema and stats
            article_data = {
                "code": "TEST_ART",
                "name": "Test Article",
                "is_active": True
            }
            article_schema = ArticleCreate(**article_data)
            print("✅ ArticleCreate: Schema instantiation works")

            # Test ArticleStats - should work without invalid fields
            stats_data = {"total": 10, "active": 8, "inactive": 2}
            stats_schema = ArticleStats(**stats_data)
            print("✅ ArticleStats: No invalid fields")
            self.test_results['article_schemas_clean'] = True

        except Exception as e:
            print(f"❌ Article schemas failed: {e}")
            self.test_results['article_schemas_clean'] = False

    def test_authenticated_crud_operations(self):
        """Test 2: Perform actual CRUD operations via API endpoints."""
        print("\n🧪 Test 2: Authenticated CRUD Operations")

        if not self.test_user:
            print("❌ No test user available for authenticated tests")
            return

        # Test Period creation
        try:
            period_data = {
                "date": datetime.now().isoformat(),
                "ru_name": f"Test Period {datetime.now().strftime('%Y-%m-%d %H:%M')}"
            }
            response = self.client.post(
                "/api/periods/",
                json=period_data,
                headers=self.auth_headers
            )

            if response.status_code == 201:
                created_period = response.json()
                self.created_records['periods'].append(created_period['data']['id'])
                print(f"✅ Period created successfully: ID {created_period['data']['id']}")

                # Verify no forbidden fields in response
                period_data = created_period['data']
                assert 'created_by' not in period_data, "Response should not contain created_by"
                assert 'managed_by' not in period_data, "Response should not contain managed_by"
                assert period_data['user_id'] == self.test_user_id, "user_id should be set from session"
                print("✅ Period: No forbidden fields, user_id set correctly")
                self.test_results['period_create_success'] = True
            else:
                print(f"❌ Period creation failed: {response.status_code} - {response.text}")
                self.test_results['period_create_success'] = False

        except Exception as e:
            print(f"❌ Period creation error: {e}")
            self.test_results['period_create_success'] = False

        # Test Financial Center creation
        try:
            fc_data = {
                "code": f"FC{datetime.now().strftime('%H%M%S')}",
                "name": f"Test FC {datetime.now().strftime('%H:%M:%S')}",
                "description": "Test financial center for CRUD fix",
                "is_active": True
            }
            response = self.client.post(
                "/api/financial_centers/",
                json=fc_data,
                headers=self.auth_headers
            )

            if response.status_code == 201:
                created_fc = response.json()
                self.created_records['financial_centers'].append(created_fc['data']['id'])
                print(f"✅ Financial Center created successfully: ID {created_fc['data']['id']}")

                # Verify user_id set from session
                fc_response_data = created_fc['data']
                assert fc_response_data['user_id'] == self.test_user_id, "user_id should be set from session"
                print("✅ Financial Center: user_id set correctly from session")
                self.test_results['fc_create_success'] = True
            else:
                print(f"❌ Financial Center creation failed: {response.status_code} - {response.text}")
                self.test_results['fc_create_success'] = False

        except Exception as e:
            print(f"❌ Financial Center creation error: {e}")
            self.test_results['fc_create_success'] = False

        # Test Cost Center creation
        try:
            cc_data = {
                "code": f"CC{datetime.now().strftime('%H%M%S')}",
                "name": f"Test CC {datetime.now().strftime('%H:%M:%S')}",
                "description": "Test cost center for CRUD fix",
                "is_active": True
            }
            response = self.client.post(
                "/api/cost_centers/",
                json=cc_data,
                headers=self.auth_headers
            )

            if response.status_code == 201:
                created_cc = response.json()
                self.created_records['cost_centers'].append(created_cc['data']['id'])
                print(f"✅ Cost Center created successfully: ID {created_cc['data']['id']}")

                # Verify user_id set from session
                cc_response_data = created_cc['data']
                assert cc_response_data['user_id'] == self.test_user_id, "user_id should be set from session"
                print("✅ Cost Center: user_id set correctly from session")
                self.test_results['cc_create_success'] = True
            else:
                print(f"❌ Cost Center creation failed: {response.status_code} - {response.text}")
                self.test_results['cc_create_success'] = False

        except Exception as e:
            print(f"❌ Cost Center creation error: {e}")
            self.test_results['cc_create_success'] = False

        # Test Article creation
        try:
            article_data = {
                "code": f"ART{datetime.now().strftime('%H%M%S')}",
                "name": f"Test Article {datetime.now().strftime('%H:%M:%S')}",
                "description": "Test article for CRUD fix",
                "is_active": True
            }
            response = self.client.post(
                "/api/articles/",
                json=article_data,
                headers=self.auth_headers
            )

            if response.status_code == 201:
                created_article = response.json()
                self.created_records['articles'].append(created_article['data']['id'])
                print(f"✅ Article created successfully: ID {created_article['data']['id']}")

                # Verify user_id set from session
                article_response_data = created_article['data']
                assert article_response_data['user_id'] == self.test_user_id, "user_id should be set from session"
                print("✅ Article: user_id set correctly from session")
                self.test_results['article_create_success'] = True
            else:
                print(f"❌ Article creation failed: {response.status_code} - {response.text}")
                self.test_results['article_create_success'] = False

        except Exception as e:
            print(f"❌ Article creation error: {e}")
            self.test_results['article_create_success'] = False

    def test_stats_endpoints(self):
        """Test 3: Verify stats endpoints work correctly (especially ArticleStats fix)."""
        print("\n🧪 Test 3: Stats Endpoints (ArticleStats fix)")

        if not self.test_user:
            print("❌ No test user available for stats tests")
            return

        # Test Article stats endpoint (this was failing before the fix)
        try:
            response = self.client.get(
                "/api/articles/stats",
                headers=self.auth_headers
            )

            if response.status_code == 200:
                stats_data = response.json()
                assert 'data' in stats_data, "Stats response should have data field"
                assert 'total' in stats_data['data'], "Stats should include total count"
                print(f"✅ Article stats endpoint works: {stats_data['data']}")
                self.test_results['article_stats_success'] = True
            else:
                print(f"❌ Article stats failed: {response.status_code} - {response.text}")
                self.test_results['article_stats_success'] = False

        except Exception as e:
            print(f"❌ Article stats error: {e}")
            self.test_results['article_stats_success'] = False

        # Test other stats endpoints for completeness
        for endpoint, name in [
            ("/api/periods/", "Periods"),
            ("/api/financial_centers/", "Financial Centers"),
            ("/api/cost_centers/", "Cost Centers")
        ]:
            try:
                response = self.client.get(endpoint, headers=self.auth_headers)
                if response.status_code == 200:
                    print(f"✅ {name} list endpoint works")
                    self.test_results[f'{name.lower().replace(" ", "_")}_list_success'] = True
                else:
                    print(f"❌ {name} list failed: {response.status_code}")
                    self.test_results[f'{name.lower().replace(" ", "_")}_list_success'] = False
            except Exception as e:
                print(f"❌ {name} list error: {e}")
                self.test_results[f'{name.lower().replace(" ", "_")}_list_success'] = False

    def test_data_isolation(self):
        """Test 4: Verify proper data isolation by user_id."""
        print("\n🧪 Test 4: Data Isolation Verification")

        if not self.test_user:
            print("❌ No test user available for isolation tests")
            return

        # Verify that all created records belong to the test user
        isolation_tests = [
            ("periods", Period, "/api/periods/"),
            ("financial_centers", FinancialCenter, "/api/financial_centers/"),
            ("cost_centers", CostCenter, "/api/cost_centers/"),
            ("articles", Article, "/api/articles/")
        ]

        for record_type, model_class, endpoint in isolation_tests:
            try:
                # Get records via API
                response = self.client.get(endpoint, headers=self.auth_headers)
                if response.status_code == 200:
                    records = response.json()['data']

                    # Check that all records belong to our test user
                    test_user_records = [r for r in records if r['user_id'] == self.test_user_id]
                    other_user_records = [r for r in records if r['user_id'] != self.test_user_id]

                    if len(other_user_records) == 0:
                        print(f"✅ {record_type}: Perfect data isolation - only user's records visible")
                        self.test_results[f'{record_type}_isolation_success'] = True
                    else:
                        print(f"⚠️ {record_type}: {len(other_user_records)} records from other users visible")
                        self.test_results[f'{record_type}_isolation_success'] = False
                else:
                    print(f"❌ {record_type}: Cannot test isolation - API error {response.status_code}")
                    self.test_results[f'{record_type}_isolation_success'] = False

            except Exception as e:
                print(f"❌ {record_type} isolation test error: {e}")
                self.test_results[f'{record_type}_isolation_success'] = False

    def test_update_operations(self):
        """Test 5: Verify update operations work correctly."""
        print("\n🧪 Test 5: Update Operations")

        if not self.created_records['periods']:
            print("❌ No created records to test updates")
            return

        # Test Period update
        if self.created_records['periods']:
            try:
                period_id = self.created_records['periods'][0]
                update_data = {
                    "ru_name": f"Updated Period {datetime.now().strftime('%H:%M:%S')}"
                }
                response = self.client.put(
                    f"/api/periods/{period_id}",
                    json=update_data,
                    headers=self.auth_headers
                )

                if response.status_code == 200:
                    updated_period = response.json()
                    assert updated_period['data']['ru_name'] == update_data['ru_name']
                    print("✅ Period update successful")
                    self.test_results['period_update_success'] = True
                else:
                    print(f"❌ Period update failed: {response.status_code}")
                    self.test_results['period_update_success'] = False

            except Exception as e:
                print(f"❌ Period update error: {e}")
                self.test_results['period_update_success'] = False

        # Test other record types updates
        for record_type, record_ids in self.created_records.items():
            if record_type == 'periods' or not record_ids:  # Skip periods (already tested) and empty lists
                continue

            try:
                record_id = record_ids[0]
                update_data = {"name": f"Updated {record_type} {datetime.now().strftime('%H:%M:%S')}"}
                endpoint = f"/api/{record_type}/{record_id}"

                response = self.client.put(endpoint, json=update_data, headers=self.auth_headers)

                if response.status_code == 200:
                    print(f"✅ {record_type} update successful")
                    self.test_results[f'{record_type}_update_success'] = True
                else:
                    print(f"❌ {record_type} update failed: {response.status_code}")
                    self.test_results[f'{record_type}_update_success'] = False

            except Exception as e:
                print(f"❌ {record_type} update error: {e}")
                self.test_results[f'{record_type}_update_success'] = False

    def cleanup_test_data(self):
        """Clean up created test data."""
        print("\n🧹 Cleaning up test data...")

        # Delete created records via API
        for record_type, record_ids in self.created_records.items():
            for record_id in record_ids:
                try:
                    response = self.client.delete(
                        f"/api/{record_type}/{record_id}",
                        headers=self.auth_headers
                    )
                    if response.status_code in [200, 204, 404]:  # 404 is ok (already deleted)
                        print(f"✅ Deleted {record_type} ID {record_id}")
                    else:
                        print(f"⚠️ Could not delete {record_type} ID {record_id}: {response.status_code}")
                except Exception as e:
                    print(f"⚠️ Error deleting {record_type} ID {record_id}: {e}")

        # Delete test user
        if self.test_user:
            try:
                self.db.delete(self.test_user)
                self.db.commit()
                print(f"✅ Test user deleted: {self.test_user.username}")
            except Exception as e:
                print(f"⚠️ Error deleting test user: {e}")
                self.db.rollback()

        # Close database connection
        try:
            self.db.close()
            print("✅ Database connection closed")
        except:
            pass

    def run_all_tests(self):
        """Execute all test categories."""
        print("🚀 Starting Comprehensive CRUD Operations Fix Tests")
        print("=" * 60)
        print("Testing critical schema fixes from v3.8.0:")
        print("- Period creation (removed created_by/managed_by fields)")
        print("- Financial/Cost Centers (optional user_id)")
        print("- Articles (fixed ArticleStats instantiation)")
        print("=" * 60)

        try:
            # Setup
            self.setup_test_user()

            # Run test suites
            self.test_schema_instantiation()
            self.test_authenticated_crud_operations()
            self.test_stats_endpoints()
            self.test_data_isolation()
            self.test_update_operations()

            # Print comprehensive results
            self.print_test_summary()

        finally:
            # Always cleanup
            self.cleanup_test_data()

    def print_test_summary(self):
        """Print comprehensive test results summary."""
        print("\n" + "=" * 60)
        print("COMPREHENSIVE CRUD FIXES TEST RESULTS")
        print("=" * 60)

        # Group results by category
        categories = {
            "Schema Fixes": [
                'period_schema_clean',
                'fc_schema_optional_user',
                'cc_schema_optional_user',
                'article_schemas_clean'
            ],
            "CRUD Operations": [
                'period_create_success',
                'fc_create_success',
                'cc_create_success',
                'article_create_success'
            ],
            "Update Operations": [
                'period_update_success',
                'financial_centers_update_success',
                'cost_centers_update_success',
                'articles_update_success'
            ],
            "Stats & Endpoints": [
                'article_stats_success',
                'periods_list_success',
                'financial_centers_list_success',
                'cost_centers_list_success'
            ],
            "Data Isolation": [
                'periods_isolation_success',
                'financial_centers_isolation_success',
                'cost_centers_isolation_success',
                'articles_isolation_success'
            ]
        }

        total_passed = 0
        total_tests = 0

        for category, test_keys in categories.items():
            print(f"\n📊 {category}:")
            category_passed = 0
            category_total = 0

            for test_key in test_keys:
                if test_key in self.test_results:
                    result = self.test_results[test_key]
                    status = "✅ PASS" if result else "❌ FAIL"
                    print(f"  {test_key:35s}: {status}")
                    category_passed += int(result)
                    category_total += 1

            print(f"  Category Score: {category_passed}/{category_total}")
            total_passed += category_passed
            total_tests += category_total

        print(f"\n🎯 OVERALL RESULTS: {total_passed}/{total_tests} tests passed")

        if total_passed == total_tests:
            print("\n🎉 ALL CRUD FIXES VALIDATED SUCCESSFULLY!")
            print("✅ Settings pages should now work without 500/422/400 errors")
            print("✅ All reference modules support full CRUD operations")
            print("✅ Schema validation working correctly")
            print("✅ Data isolation maintained")
            return True
        else:
            failed_tests = total_tests - total_passed
            print(f"\n⚠️ {failed_tests} tests failed - some issues may remain")
            return False


def main():
    """Main test execution with proper error handling."""
    print("🧪 Comprehensive CRUD Operations Schema Fixes Test Suite")
    print("Version: 3.8.0 Fix Validation")
    print("=" * 70)

    test_runner = CRUDOperationsTest()

    try:
        success = test_runner.run_all_tests()

        if success:
            print("\n🎯 CRUD FIXES VALIDATION: SUCCESS")
            print("All critical CRUD operations are working correctly!")
            return 0
        else:
            print("\n🔧 CRUD FIXES VALIDATION: SOME ISSUES DETECTED")
            print("Review failed tests and address remaining issues.")
            return 1

    except Exception as e:
        print(f"\n💥 CRITICAL ERROR during testing: {e}")
        print("Test execution failed - check environment and dependencies")
        return 2


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)