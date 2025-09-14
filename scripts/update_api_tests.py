#!/usr/bin/env python3
"""
Script to automatically update existing API tests to use unified response format.
Updates all test_*_api.py files to validate new response format:
- Success: {"success": true, "data": ...}
- Error: {"success": false, "error": "..."}
- Lists: {"success": true, "data": [...], "total": N}
"""

import re
import os

# Helper functions to insert at the top of each file
HELPER_FUNCTIONS = """

def validate_success_response(response_data: dict, expected_data_checks: dict = None):
    \"\"\"Helper function to validate unified success response format.\"\"\"
    assert "success" in response_data
    assert response_data["success"] is True
    assert "data" in response_data

    if expected_data_checks:
        data = response_data["data"]
        for key, expected_value in expected_data_checks.items():
            assert key in data
            if expected_value is not None:
                assert data[key] == expected_value

    return response_data["data"]


def validate_error_response(response_data: dict, expected_error_substring: str = None):
    \"\"\"Helper function to validate unified error response format.\"\"\"
    assert "success" in response_data
    assert response_data["success"] is False
    assert "error" in response_data
    assert isinstance(response_data["error"], str)

    if expected_error_substring:
        assert expected_error_substring in response_data["error"]

    return response_data["error"]


def validate_list_response(response_data: dict, expected_total: int = None):
    \"\"\"Helper function to validate unified list response format.\"\"\"
    assert "success" in response_data
    assert response_data["success"] is True
    assert "data" in response_data
    assert isinstance(response_data["data"], list)

    if expected_total is not None:
        assert "total" in response_data
        assert response_data["total"] == expected_total

    return response_data["data"]
"""


def update_test_file(file_path: str):
    """Update a single test file to use unified response format."""
    print(f"Updating {file_path}...")

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Skip if already updated (helper functions present)
    if 'validate_success_response' in content:
        print(f"  {file_path} already updated, skipping")
        return

    # Add helper functions after imports
    import_section = content.find('from httpx import AsyncClient')
    if import_section != -1:
        insertion_point = content.find('\n\n', import_section)
        if insertion_point != -1:
            content = content[:insertion_point] + HELPER_FUNCTIONS + content[insertion_point:]

    # Replace common patterns

    # Pattern 1: Direct response.json() access with data validation
    # data = response.json() -> response_data = response.json(); data = validate_success_response(response_data)
    content = re.sub(
        r'(\s+)data = response\.json\(\)\s*\n(\s+)assert data\[',
        r'\1response_data = response.json()\n\1data = validate_success_response(response_data)\n\2assert data[',
        content
    )

    # Pattern 2: Error response validation
    # error_data = response.json(); assert "something" in error_data["detail"]
    content = re.sub(
        r'(\s+)error_data = response\.json\(\)\s*\n(\s+)assert .+ in error_data\["detail"\]',
        r'\1response_data = response.json()\n\1validate_error_response(response_data)',
        content
    )

    # Pattern 3: List response validation
    # items = response.json() for GET all endpoints
    content = re.sub(
        r'(\s+)([a-z_]+) = response\.json\(\)\s*\n(\s+)assert len\(\2\) == (\d+)',
        r'\1response_data = response.json()\n\1\2 = validate_list_response(response_data, expected_total=\4)\n\3assert len(\2) == \4',
        content
    )

    # Pattern 4: Update docstrings to mention unified format
    content = re.sub(
        r'(def test_[^"]+"""[^"]+)(\.""")',
        r'\1 with unified response format\2',
        content
    )

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"  {file_path} updated successfully")


def main():
    """Update all API test files in the backend tests directory."""
    test_dir = '/home/ikeniborn/Documents/Project/familyBudget/tests/backend'

    api_test_files = [
        'test_financial_centers_api.py',
        'test_cost_centers_api.py',
        'test_nomenclatures_api.py'
    ]

    for filename in api_test_files:
        file_path = os.path.join(test_dir, filename)
        if os.path.exists(file_path):
            update_test_file(file_path)
        else:
            print(f"Warning: {file_path} not found")

    print("All API test files updated successfully!")


if __name__ == '__main__':
    main()