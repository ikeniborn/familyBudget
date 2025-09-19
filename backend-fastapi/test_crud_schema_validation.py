#!/usr/bin/env python3
"""
CRUD Schema Validation Test Suite

This test validates the critical schema fixes implemented in v3.8.0:
1. Period creation - removed non-existent 'created_by'/'managed_by' fields
2. Financial Centers - made user_id optional in schemas
3. Cost Centers - made user_id optional in schemas
4. Articles - fixed ArticleStats instantiation

Focus: Schema instantiation and basic validation without authentication complexity.

Run with: docker exec budget-backend python /app/test_crud_schema_validation.py
"""

import sys
import os
from datetime import datetime
from typing import Dict, Any

# Add the app directory to the Python path
sys.path.insert(0, '/app')

try:
    from fastapi.testclient import TestClient
    from app.main import app
    from app.schemas.period import PeriodCreate, PeriodPublic
    from app.schemas.financial_center import FinancialCenterCreate, FinancialCenterPublic
    from app.schemas.cost_center import CostCenterCreate, CostCenterPublic
    from app.schemas.article import ArticleCreate, ArticleStats, ArticlePublic
    print("✅ All imports successful")
except ImportError as e:
    print(f"❌ Import error: {e}")
    sys.exit(1)


class CRUDSchemaTest:
    """Schema validation test for CRUD fixes."""

    def __init__(self):
        self.client = TestClient(app)
        self.test_results = {}

    def test_period_schema_fixes(self):
        """Test 1: Period schema should NOT have created_by/managed_by fields."""
        print("\n🧪 Test 1: Period Schema Validation")

        try:
            # Test that PeriodCreate can be instantiated without forbidden fields
            period_data = {
                "date": datetime.now(),
                "ru_name": "Test Period for Schema Validation"
            }

            period_schema = PeriodCreate(**period_data)

            # Verify forbidden fields are NOT present
            forbidden_fields = ['created_by', 'managed_by']
            schema_dict = period_schema.dict()

            for field in forbidden_fields:
                if field in schema_dict:
                    print(f"❌ Period schema contains forbidden field: {field}")
                    self.test_results['period_no_forbidden_fields'] = False
                    return

            print("✅ Period schema: No forbidden fields (created_by/managed_by)")

            # Verify user_id is optional
            if 'user_id' in schema_dict and schema_dict['user_id'] is None:
                print("✅ Period schema: user_id is optional")
                self.test_results['period_optional_user_id'] = True
            else:
                print("⚠️ Period schema: user_id handling unclear")
                self.test_results['period_optional_user_id'] = False

            # Test instantiation with minimal data
            minimal_period = PeriodCreate(
                date=datetime.now(),
                ru_name="Minimal Period"
            )
            print("✅ Period schema: Can be instantiated with minimal data")
            self.test_results['period_minimal_instantiation'] = True
            self.test_results['period_no_forbidden_fields'] = True

        except Exception as e:
            print(f"❌ Period schema test failed: {e}")
            self.test_results['period_no_forbidden_fields'] = False
            self.test_results['period_optional_user_id'] = False
            self.test_results['period_minimal_instantiation'] = False

    def test_financial_center_schema_fixes(self):
        """Test 2: Financial Center schema should have optional user_id."""
        print("\n🧪 Test 2: Financial Center Schema Validation")

        try:
            # Test FinancialCenterCreate without user_id
            fc_data = {
                "code": "TEST_FC",
                "name": "Test Financial Center",
                "description": "Test description",
                "is_active": True
            }

            fc_schema = FinancialCenterCreate(**fc_data)
            schema_dict = fc_schema.dict()

            # Verify user_id is optional (should be None by default)
            if 'user_id' in schema_dict:
                if schema_dict['user_id'] is None:
                    print("✅ Financial Center schema: user_id is optional (None by default)")
                    self.test_results['fc_optional_user_id'] = True
                else:
                    print(f"⚠️ Financial Center schema: user_id has unexpected value: {schema_dict['user_id']}")
                    self.test_results['fc_optional_user_id'] = False
            else:
                print("✅ Financial Center schema: user_id not required in instantiation")
                self.test_results['fc_optional_user_id'] = True

            # Test with explicit user_id
            fc_with_user = FinancialCenterCreate(
                code="TEST_FC2",
                name="Test FC with User",
                user_id=123
            )
            print("✅ Financial Center schema: Can set user_id when provided")

            # Test without user_id (should not fail)
            fc_without_user = FinancialCenterCreate(
                code="TEST_FC3",
                name="Test FC without User"
            )
            print("✅ Financial Center schema: Can instantiate without user_id")

            self.test_results['fc_instantiation_success'] = True

        except Exception as e:
            print(f"❌ Financial Center schema test failed: {e}")
            self.test_results['fc_optional_user_id'] = False
            self.test_results['fc_instantiation_success'] = False

    def test_cost_center_schema_fixes(self):
        """Test 3: Cost Center schema should have optional user_id."""
        print("\n🧪 Test 3: Cost Center Schema Validation")

        try:
            # Test CostCenterCreate without user_id
            cc_data = {
                "code": "TEST_CC",
                "name": "Test Cost Center",
                "description": "Test description",
                "is_active": True
            }

            cc_schema = CostCenterCreate(**cc_data)
            schema_dict = cc_schema.dict()

            # Verify user_id is optional
            if 'user_id' in schema_dict:
                if schema_dict['user_id'] is None:
                    print("✅ Cost Center schema: user_id is optional (None by default)")
                    self.test_results['cc_optional_user_id'] = True
                else:
                    print(f"⚠️ Cost Center schema: user_id has unexpected value: {schema_dict['user_id']}")
                    self.test_results['cc_optional_user_id'] = False
            else:
                print("✅ Cost Center schema: user_id not required in instantiation")
                self.test_results['cc_optional_user_id'] = True

            # Test various instantiation patterns
            cc_with_user = CostCenterCreate(
                code="TEST_CC2",
                name="Test CC with User",
                user_id=456
            )
            print("✅ Cost Center schema: Can set user_id when provided")

            cc_without_user = CostCenterCreate(
                code="TEST_CC3",
                name="Test CC without User"
            )
            print("✅ Cost Center schema: Can instantiate without user_id")

            self.test_results['cc_instantiation_success'] = True

        except Exception as e:
            print(f"❌ Cost Center schema test failed: {e}")
            self.test_results['cc_optional_user_id'] = False
            self.test_results['cc_instantiation_success'] = False

    def test_article_schema_fixes(self):
        """Test 4: Article schemas should work correctly."""
        print("\n🧪 Test 4: Article Schema Validation")

        try:
            # Test ArticleCreate
            article_data = {
                "code": "TEST_ART",
                "name": "Test Article",
                "description": "Test article description",
                "is_active": True
            }

            article_schema = ArticleCreate(**article_data)
            print("✅ Article schema: ArticleCreate instantiation successful")

            # Test ArticleStats (this was the main issue in the fix)
            stats_data = {
                "total": 10,
                "active": 8,
                "inactive": 2
            }

            stats_schema = ArticleStats(**stats_data)
            print("✅ Article schema: ArticleStats instantiation successful")

            # Verify stats schema has expected fields
            stats_dict = stats_schema.dict()
            expected_fields = ['total', 'active', 'inactive']
            for field in expected_fields:
                if field not in stats_dict:
                    print(f"❌ ArticleStats missing expected field: {field}")
                    self.test_results['article_stats_validation'] = False
                    return

            print("✅ Article schema: ArticleStats has all expected fields")

            # Test various ArticleStats instantiation patterns
            stats_minimal = ArticleStats(total=5, active=3, inactive=2)
            stats_zero = ArticleStats(total=0, active=0, inactive=0)
            stats_large = ArticleStats(total=1000, active=850, inactive=150)

            print("✅ Article schema: ArticleStats supports various value ranges")

            self.test_results['article_create_success'] = True
            self.test_results['article_stats_validation'] = True
            self.test_results['article_stats_instantiation'] = True

        except Exception as e:
            print(f"❌ Article schema test failed: {e}")
            self.test_results['article_create_success'] = False
            self.test_results['article_stats_validation'] = False
            self.test_results['article_stats_instantiation'] = False

    def test_api_endpoint_structure(self):
        """Test 5: Verify API endpoints are accessible (structure test)."""
        print("\n🧪 Test 5: API Endpoint Structure")

        endpoints_to_test = [
            ("/api/periods/", "Periods"),
            ("/api/financial_centers/", "Financial Centers"),
            ("/api/cost_centers/", "Cost Centers"),
            ("/api/articles/", "Articles"),
            ("/api/articles/stats", "Article Stats")
        ]

        for endpoint, name in endpoints_to_test:
            try:
                response = self.client.get(endpoint)
                # We expect either 200 (success) or 401 (auth required), NOT 404 (not found)
                if response.status_code in [200, 401, 403]:
                    print(f"✅ {name} endpoint exists: {endpoint} (status: {response.status_code})")
                    self.test_results[f'endpoint_{name.lower().replace(" ", "_")}_exists'] = True
                else:
                    print(f"❌ {name} endpoint issue: {endpoint} (status: {response.status_code})")
                    self.test_results[f'endpoint_{name.lower().replace(" ", "_")}_exists'] = False

            except Exception as e:
                print(f"❌ {name} endpoint error: {e}")
                self.test_results[f'endpoint_{name.lower().replace(" ", "_")}_exists'] = False

    def test_openapi_schema_validation(self):
        """Test 6: Verify OpenAPI schema includes fixed endpoints."""
        print("\n🧪 Test 6: OpenAPI Schema Validation")

        try:
            response = self.client.get("/openapi.json")
            if response.status_code == 200:
                schema = response.json()
                paths = schema.get("paths", {})

                # Check critical endpoints are documented
                critical_paths = [
                    "/api/periods/",
                    "/api/financial_centers/",
                    "/api/cost_centers/",
                    "/api/articles/",
                    "/api/articles/stats"
                ]

                documented_paths = 0
                for path in critical_paths:
                    if path in paths:
                        documented_paths += 1
                        print(f"✅ OpenAPI: {path} documented")
                    else:
                        print(f"❌ OpenAPI: {path} not documented")

                coverage = documented_paths / len(critical_paths)
                if coverage >= 0.8:  # 80% coverage is acceptable
                    print(f"✅ OpenAPI schema: {coverage:.0%} endpoint coverage")
                    self.test_results['openapi_documentation'] = True
                else:
                    print(f"⚠️ OpenAPI schema: Only {coverage:.0%} endpoint coverage")
                    self.test_results['openapi_documentation'] = False
            else:
                print(f"❌ OpenAPI schema not accessible: {response.status_code}")
                self.test_results['openapi_documentation'] = False

        except Exception as e:
            print(f"❌ OpenAPI schema test failed: {e}")
            self.test_results['openapi_documentation'] = False

    def run_all_tests(self):
        """Execute all test categories."""
        print("🚀 Starting CRUD Schema Validation Tests")
        print("=" * 60)
        print("Testing critical schema fixes from v3.8.0:")
        print("- Period: No created_by/managed_by fields")
        print("- Financial Centers: Optional user_id")
        print("- Cost Centers: Optional user_id")
        print("- Articles: Fixed ArticleStats instantiation")
        print("=" * 60)

        # Run all test suites
        self.test_period_schema_fixes()
        self.test_financial_center_schema_fixes()
        self.test_cost_center_schema_fixes()
        self.test_article_schema_fixes()
        self.test_api_endpoint_structure()
        self.test_openapi_schema_validation()

        # Print results summary
        self.print_test_summary()

    def print_test_summary(self):
        """Print detailed test results summary."""
        print("\n" + "=" * 60)
        print("CRUD SCHEMA VALIDATION TEST RESULTS")
        print("=" * 60)

        # Group results by test category
        categories = {
            "Period Schema Fixes": [
                'period_no_forbidden_fields',
                'period_optional_user_id',
                'period_minimal_instantiation'
            ],
            "Financial Center Schema": [
                'fc_optional_user_id',
                'fc_instantiation_success'
            ],
            "Cost Center Schema": [
                'cc_optional_user_id',
                'cc_instantiation_success'
            ],
            "Article Schema Fixes": [
                'article_create_success',
                'article_stats_validation',
                'article_stats_instantiation'
            ],
            "API Structure": [
                'endpoint_periods_exists',
                'endpoint_financial_centers_exists',
                'endpoint_cost_centers_exists',
                'endpoint_articles_exists',
                'endpoint_article_stats_exists'
            ],
            "Documentation": [
                'openapi_documentation'
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

            if category_total > 0:
                print(f"  Category Score: {category_passed}/{category_total} ({category_passed/category_total:.0%})")
                total_passed += category_passed
                total_tests += category_total

        print(f"\n🎯 OVERALL RESULTS: {total_passed}/{total_tests} tests passed ({total_passed/total_tests:.0%})")

        if total_passed == total_tests:
            print("\n🎉 ALL SCHEMA FIXES VALIDATED SUCCESSFULLY!")
            print("✅ Period schemas no longer have forbidden fields")
            print("✅ Financial/Cost Center schemas have optional user_id")
            print("✅ Article schemas and stats work correctly")
            print("✅ All API endpoints are properly structured")
            return True
        else:
            failed_tests = total_tests - total_passed
            print(f"\n⚠️ {failed_tests} test(s) failed - some schema issues may remain")

            # Highlight critical failures
            critical_tests = [
                'period_no_forbidden_fields',
                'fc_optional_user_id',
                'cc_optional_user_id',
                'article_stats_validation'
            ]

            critical_failures = []
            for test in critical_tests:
                if test in self.test_results and not self.test_results[test]:
                    critical_failures.append(test)

            if critical_failures:
                print(f"🔥 CRITICAL FAILURES: {', '.join(critical_failures)}")
                print("These failures indicate core schema fixes are not working!")

            return False


def main():
    """Main test execution."""
    print("🧪 CRUD Schema Validation Test Suite")
    print("Version: v3.8.0 Schema Fix Validation")
    print("Focus: Schema instantiation and API structure")
    print("=" * 70)

    test_runner = CRUDSchemaTest()
    success = test_runner.run_all_tests()

    if success:
        print("\n🎯 SCHEMA VALIDATION: SUCCESS")
        print("All critical schema fixes are working correctly!")
        return 0
    else:
        print("\n🔧 SCHEMA VALIDATION: ISSUES DETECTED")
        print("Review failed tests and address schema problems.")
        return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)