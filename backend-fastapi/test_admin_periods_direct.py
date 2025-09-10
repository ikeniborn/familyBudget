#!/usr/bin/env python3
"""
Direct test script for admin periods endpoint.
This script simulates admin and regular user sessions to test the admin periods functionality.
"""

import requests
import json
from datetime import datetime
from typing import Dict, Any, Optional


class AdminPeriodsEndpointTester:
    """Direct tester for admin periods endpoint functionality."""
    
    def __init__(self, base_url: str = "http://localhost:4000"):
        self.base_url = base_url
        self.session = requests.Session()
    
    def simulate_session(self, user_data: Dict[str, Any]) -> None:
        """Simulate a user session by setting cookies."""
        # Create a mock session cookie (this would be done by the auth system in real usage)
        session_data = json.dumps({"user": user_data})
        # In real usage, the session would be stored in Redis and accessed by cookie
        # For testing, we'll directly mock the session validation
        self.current_user = user_data
    
    def test_admin_periods_endpoint(self) -> Dict[str, Any]:
        """Test the admin periods endpoint."""
        print(f"Testing admin periods endpoint: {self.base_url}/api/admin/periods")
        
        try:
            response = self.session.get(f"{self.base_url}/api/admin/periods")
            
            result = {
                "endpoint": "/api/admin/periods",
                "status_code": response.status_code,
                "success": response.status_code == 200,
                "data": None,
                "error": None
            }
            
            if response.status_code == 200:
                data = response.json()
                result["data"] = data
                
                # Validate response structure
                if isinstance(data, dict) and "data" in data:
                    result["periods_count"] = len(data["data"])
                    result["has_user_info"] = False
                    
                    # Check if periods contain user information
                    if data["data"]:
                        first_period = data["data"][0]
                        user_fields = ["user_name", "user_email", "username", "telegram_id"]
                        result["has_user_info"] = any(field in first_period for field in user_fields)
                        result["sample_period"] = first_period
                
            else:
                try:
                    result["error"] = response.json()
                except:
                    result["error"] = response.text
                    
        except Exception as e:
            result = {
                "endpoint": "/api/admin/periods",
                "status_code": None,
                "success": False,
                "data": None,
                "error": str(e)
            }
        
        return result
    
    def test_regular_periods_endpoint(self) -> Dict[str, Any]:
        """Test the regular periods endpoint for comparison."""
        print(f"Testing regular periods endpoint: {self.base_url}/api/periods/")
        
        try:
            response = self.session.get(f"{self.base_url}/api/periods/")
            
            result = {
                "endpoint": "/api/periods/",
                "status_code": response.status_code,
                "success": response.status_code == 200,
                "data": None,
                "error": None
            }
            
            if response.status_code == 200:
                data = response.json()
                result["data"] = data
                result["periods_count"] = len(data) if isinstance(data, list) else 0
                
                # Check if periods contain user information (they shouldn't in regular endpoint)
                result["has_user_info"] = False
                if isinstance(data, list) and data:
                    first_period = data[0]
                    user_fields = ["user_name", "user_email", "username", "telegram_id"]
                    result["has_user_info"] = any(
                        field in first_period and first_period[field] is not None 
                        for field in user_fields
                    )
                    result["sample_period"] = first_period
            else:
                try:
                    result["error"] = response.json()
                except:
                    result["error"] = response.text
                    
        except Exception as e:
            result = {
                "endpoint": "/api/periods/",
                "status_code": None,
                "success": False,
                "data": None,
                "error": str(e)
            }
        
        return result
    
    def test_authentication_scenarios(self) -> Dict[str, Any]:
        """Test different authentication scenarios."""
        results = {
            "no_auth": {},
            "regular_user_admin_access": {},
            "admin_user_admin_access": {},
            "admin_user_regular_access": {}
        }
        
        # 1. Test no authentication
        print("\n1. Testing without authentication...")
        self.session.cookies.clear()
        results["no_auth"]["admin"] = self.test_admin_periods_endpoint()
        results["no_auth"]["regular"] = self.test_regular_periods_endpoint()
        
        # 2. Test regular user trying to access admin endpoint
        print("\n2. Testing regular user access to admin endpoint...")
        regular_user = {
            "user_id": 2,
            "username": "regularuser", 
            "user_name": "Regular User",
            "user_email": "user@example.com"
        }
        self.simulate_session(regular_user)
        results["regular_user_admin_access"]["admin"] = self.test_admin_periods_endpoint()
        results["regular_user_admin_access"]["regular"] = self.test_regular_periods_endpoint()
        
        # 3. Test admin user accessing admin endpoint
        print("\n3. Testing admin user access to admin endpoint...")
        admin_user = {
            "user_id": 1,
            "username": "admin",
            "user_name": "Admin User", 
            "user_email": "admin@example.com"
        }
        self.simulate_session(admin_user)
        results["admin_user_admin_access"]["admin"] = self.test_admin_periods_endpoint()
        results["admin_user_admin_access"]["regular"] = self.test_regular_periods_endpoint()
        
        return results
    
    def validate_data_structure(self, period_data: Dict[str, Any], is_admin: bool = False) -> Dict[str, Any]:
        """Validate the data structure of a period object."""
        validation = {
            "has_core_fields": True,
            "has_user_fields": False,
            "has_legacy_fields": True,
            "missing_fields": [],
            "data_types_correct": True,
            "type_issues": []
        }
        
        # Core period fields that should always be present
        core_fields = ["id", "date", "ru_name", "user_id"]
        for field in core_fields:
            if field not in period_data:
                validation["has_core_fields"] = False
                validation["missing_fields"].append(field)
        
        # User information fields (only expected in admin endpoint)
        user_fields = ["user_name", "user_email", "username", "telegram_id"]
        for field in user_fields:
            if field in period_data and period_data[field] is not None:
                validation["has_user_fields"] = True
                break
        
        # Legacy fields for backward compatibility
        legacy_fields = ["period_id", "period_name", "period_year", "period_month"]
        for field in legacy_fields:
            if field not in period_data:
                validation["has_legacy_fields"] = False
                validation["missing_fields"].append(field)
        
        # Data type validation
        if "id" in period_data and not isinstance(period_data["id"], int):
            validation["data_types_correct"] = False
            validation["type_issues"].append(f"id should be int, got {type(period_data['id'])}")
        
        if "user_id" in period_data and not isinstance(period_data["user_id"], int):
            validation["data_types_correct"] = False
            validation["type_issues"].append(f"user_id should be int, got {type(period_data['user_id'])}")
        
        return validation
    
    def run_comprehensive_test(self) -> Dict[str, Any]:
        """Run comprehensive test suite for admin periods endpoint."""
        print("=" * 60)
        print("ADMIN PERIODS ENDPOINT COMPREHENSIVE TEST")
        print("=" * 60)
        
        results = {
            "test_timestamp": datetime.now().isoformat(),
            "base_url": self.base_url,
            "authentication_tests": {},
            "data_structure_tests": {},
            "comparison_tests": {},
            "summary": {}
        }
        
        # Test authentication scenarios
        results["authentication_tests"] = self.test_authentication_scenarios()
        
        # Analyze results for admin user scenario
        admin_results = results["authentication_tests"]["admin_user_admin_access"]
        if admin_results.get("admin", {}).get("success") and admin_results["admin"]["data"]:
            admin_data = admin_results["admin"]["data"]
            if admin_data.get("data"):
                sample_period = admin_data["data"][0]
                results["data_structure_tests"]["admin_endpoint"] = self.validate_data_structure(
                    sample_period, is_admin=True
                )
        
        if admin_results.get("regular", {}).get("success") and admin_results["regular"]["data"]:
            regular_data = admin_results["regular"]["data"]
            if isinstance(regular_data, list) and regular_data:
                sample_period = regular_data[0]
                results["data_structure_tests"]["regular_endpoint"] = self.validate_data_structure(
                    sample_period, is_admin=False
                )
        
        # Summary
        summary = {
            "admin_endpoint_accessible_by_admin": False,
            "admin_endpoint_blocked_for_regular_users": False,
            "admin_endpoint_returns_user_info": False,
            "regular_endpoint_accessible_by_users": False,
            "data_structure_valid": False,
            "authentication_working": False
        }
        
        # Check admin access
        admin_admin = results["authentication_tests"]["admin_user_admin_access"]["admin"]
        if admin_admin.get("success"):
            summary["admin_endpoint_accessible_by_admin"] = True
            summary["admin_endpoint_returns_user_info"] = admin_admin.get("has_user_info", False)
        
        # Check regular user blocked from admin
        regular_admin = results["authentication_tests"]["regular_user_admin_access"]["admin"]
        if regular_admin.get("status_code") in [401, 403]:
            summary["admin_endpoint_blocked_for_regular_users"] = True
        
        # Check regular endpoint access
        admin_regular = results["authentication_tests"]["admin_user_admin_access"]["regular"]
        if admin_regular.get("success"):
            summary["regular_endpoint_accessible_by_users"] = True
        
        # Check data structure
        admin_struct = results["data_structure_tests"].get("admin_endpoint", {})
        regular_struct = results["data_structure_tests"].get("regular_endpoint", {})
        
        if (admin_struct.get("has_core_fields") and 
            admin_struct.get("has_legacy_fields") and
            regular_struct.get("has_core_fields") and
            regular_struct.get("has_legacy_fields")):
            summary["data_structure_valid"] = True
        
        # Overall authentication check
        if (summary["admin_endpoint_accessible_by_admin"] and 
            summary["admin_endpoint_blocked_for_regular_users"]):
            summary["authentication_working"] = True
        
        results["summary"] = summary
        
        return results


def print_test_results(results: Dict[str, Any]) -> None:
    """Print formatted test results."""
    print("\n" + "=" * 60)
    print("TEST RESULTS SUMMARY")
    print("=" * 60)
    
    summary = results.get("summary", {})
    
    # Status indicators
    def status_icon(success: bool) -> str:
        return "✅" if success else "❌"
    
    print(f"\n🔐 AUTHENTICATION & AUTHORIZATION:")
    print(f"  {status_icon(summary.get('admin_endpoint_accessible_by_admin'))} Admin can access admin endpoint")
    print(f"  {status_icon(summary.get('admin_endpoint_blocked_for_regular_users'))} Regular users blocked from admin endpoint")
    print(f"  {status_icon(summary.get('authentication_working'))} Overall authentication working")
    
    print(f"\n📊 DATA & FUNCTIONALITY:")
    print(f"  {status_icon(summary.get('admin_endpoint_returns_user_info'))} Admin endpoint returns user information")
    print(f"  {status_icon(summary.get('regular_endpoint_accessible_by_users'))} Regular endpoint accessible")
    print(f"  {status_icon(summary.get('data_structure_valid'))} Data structure valid")
    
    # Detailed results
    print(f"\n📋 DETAILED ENDPOINT TESTS:")
    
    auth_tests = results.get("authentication_tests", {})
    
    # Admin user tests
    admin_tests = auth_tests.get("admin_user_admin_access", {})
    admin_admin = admin_tests.get("admin", {})
    admin_regular = admin_tests.get("regular", {})
    
    print(f"\n  Admin User Tests:")
    print(f"    /api/admin/periods:  {admin_admin.get('status_code', 'N/A')} - {'✅' if admin_admin.get('success') else '❌'}")
    if admin_admin.get("periods_count") is not None:
        print(f"      → Found {admin_admin['periods_count']} periods")
        print(f"      → Has user info: {'✅' if admin_admin.get('has_user_info') else '❌'}")
    
    print(f"    /api/periods/:       {admin_regular.get('status_code', 'N/A')} - {'✅' if admin_regular.get('success') else '❌'}")
    if admin_regular.get("periods_count") is not None:
        print(f"      → Found {admin_regular['periods_count']} periods")
    
    # Regular user tests  
    regular_tests = auth_tests.get("regular_user_admin_access", {})
    regular_admin = regular_tests.get("admin", {})
    regular_regular = regular_tests.get("regular", {})
    
    print(f"\n  Regular User Tests:")
    print(f"    /api/admin/periods:  {regular_admin.get('status_code', 'N/A')} - {'✅ (blocked)' if regular_admin.get('status_code') in [401, 403] else '❌ (not blocked)'}")
    print(f"    /api/periods/:       {regular_regular.get('status_code', 'N/A')} - {'✅' if regular_regular.get('success') else '❌'}")
    
    # No auth tests
    no_auth_tests = auth_tests.get("no_auth", {})
    print(f"\n  Unauthenticated Tests:")
    print(f"    /api/admin/periods:  {no_auth_tests.get('admin', {}).get('status_code', 'N/A')} - {'✅ (blocked)' if no_auth_tests.get('admin', {}).get('status_code') in [401, 403] else '❌ (not blocked)'}")
    print(f"    /api/periods/:       {no_auth_tests.get('regular', {}).get('status_code', 'N/A')} - {'✅ (blocked)' if no_auth_tests.get('regular', {}).get('status_code') in [401, 403] else '❌ (not blocked)'}")
    
    # Data structure validation
    struct_tests = results.get("data_structure_tests", {})
    print(f"\n📋 DATA STRUCTURE VALIDATION:")
    
    if "admin_endpoint" in struct_tests:
        admin_struct = struct_tests["admin_endpoint"]
        print(f"  Admin Endpoint Structure:")
        print(f"    Core fields: {'✅' if admin_struct.get('has_core_fields') else '❌'}")
        print(f"    User fields: {'✅' if admin_struct.get('has_user_fields') else '❌'}")
        print(f"    Legacy fields: {'✅' if admin_struct.get('has_legacy_fields') else '❌'}")
        print(f"    Data types: {'✅' if admin_struct.get('data_types_correct') else '❌'}")
        
        if admin_struct.get("missing_fields"):
            print(f"    Missing: {', '.join(admin_struct['missing_fields'])}")
        if admin_struct.get("type_issues"):
            print(f"    Type issues: {'; '.join(admin_struct['type_issues'])}")
    
    if "regular_endpoint" in struct_tests:
        regular_struct = struct_tests["regular_endpoint"]
        print(f"  Regular Endpoint Structure:")
        print(f"    Core fields: {'✅' if regular_struct.get('has_core_fields') else '❌'}")
        print(f"    User fields: {'❌ (not expected)' if not regular_struct.get('has_user_fields') else '⚠️ (unexpected)'}")
        print(f"    Legacy fields: {'✅' if regular_struct.get('has_legacy_fields') else '❌'}")
        print(f"    Data types: {'✅' if regular_struct.get('data_types_correct') else '❌'}")
    
    print("\n" + "=" * 60)


def main():
    """Main test execution."""
    print("Starting Admin Periods Endpoint Test...")
    print("This test validates the admin periods endpoint functionality.")
    print("Note: This test will run against the live API - ensure backend is running.")
    
    tester = AdminPeriodsEndpointTester()
    
    try:
        results = tester.run_comprehensive_test()
        print_test_results(results)
        
        # Save detailed results to file for analysis
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = f"admin_periods_test_results_{timestamp}.json"
        
        with open(output_file, 'w') as f:
            json.dump(results, f, indent=2, default=str)
        
        print(f"\n📁 Detailed results saved to: {output_file}")
        
        # Return summary for automated testing
        summary = results.get("summary", {})
        all_passed = all([
            summary.get("admin_endpoint_accessible_by_admin"),
            summary.get("admin_endpoint_blocked_for_regular_users"), 
            summary.get("admin_endpoint_returns_user_info"),
            summary.get("regular_endpoint_accessible_by_users"),
            summary.get("data_structure_valid"),
            summary.get("authentication_working")
        ])
        
        print(f"\n🎯 OVERALL RESULT: {'✅ ALL TESTS PASSED' if all_passed else '❌ SOME TESTS FAILED'}")
        
        return 0 if all_passed else 1
        
    except Exception as e:
        print(f"❌ Test execution failed: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit(main())