import pytest
from httpx import AsyncClient
from datetime import datetime, date
import json


class TestDataValidation:
    """Test data validation for all endpoints."""

    @pytest.mark.asyncio
    async def test_registry_cost_sum_validation(self, async_client: AsyncClient):
        """Test cost_sum field validation."""
        # Test cases for cost_sum
        test_cases = [
            ({"cost_sum": -100}, 422),  # Negative value
            ({"cost_sum": "not_a_number"}, 422),  # Invalid type
            ({"cost_sum": None}, 422),  # Null value
            ({"cost_sum": 999999999999}, 422),  # Too large
            ({"cost_sum": 0}, 201),  # Zero should be valid
            ({"cost_sum": 100.50}, 201),  # Valid decimal
        ]

        base_data = {
            "user_id": 1,
            "period_id": 1,
            "financial_center_id": 1,
            "cost_center_id": 1,
            "nomenclature_id": 1,
            "row_type_id": 1,
            "operation_dttm": datetime.now().isoformat()
        }

        for cost_sum_data, expected_status in test_cases:
            data = {**base_data, **cost_sum_data}
            response = await async_client.post("/registry", json=data)
            assert response.status_code == expected_status

    @pytest.mark.asyncio
    async def test_registry_date_validation(self, async_client: AsyncClient):
        """Test date field validation."""
        base_data = {
            "user_id": 1,
            "period_id": 1,
            "financial_center_id": 1,
            "cost_center_id": 1,
            "nomenclature_id": 1,
            "row_type_id": 1,
            "cost_sum": 100
        }

        # Test various date formats
        date_tests = [
            ("2024-01-15T10:30:00", 201),  # Valid ISO format
            ("2024-01-15", 201),  # Valid date only
            ("invalid-date", 422),  # Invalid format
            ("2024-13-01", 422),  # Invalid month
            ("2024-01-32", 422),  # Invalid day
            ("", 422),  # Empty string
        ]

        for date_value, expected_status in date_tests:
            data = {**base_data, "operation_dttm": date_value}
            response = await async_client.post("/registry", json=data)
            assert response.status_code == expected_status

    @pytest.mark.asyncio
    async def test_foreign_key_validation(self, async_client: AsyncClient):
        """Test foreign key constraints validation."""
        base_data = {
            "cost_sum": 100,
            "operation_dttm": datetime.now().isoformat()
        }

        # Test invalid foreign keys
        fk_tests = [
            {"user_id": -1, "period_id": 1, "financial_center_id": 1, "cost_center_id": 1, "nomenclature_id": 1, "row_type_id": 1},
            {"user_id": 1, "period_id": 0, "financial_center_id": 1, "cost_center_id": 1, "nomenclature_id": 1, "row_type_id": 1},
            {"user_id": 1, "period_id": 1, "financial_center_id": None, "cost_center_id": 1, "nomenclature_id": 1, "row_type_id": 1},
        ]

        for fk_data in fk_tests:
            data = {**base_data, **fk_data}
            response = await async_client.post("/registry", json=data)
            assert response.status_code in [422, 400]  # Validation or constraint error

    @pytest.mark.asyncio
    async def test_string_length_validation(self, async_client: AsyncClient):
        """Test string field length validation."""
        base_data = {
            "user_id": 1,
            "period_id": 1,
            "financial_center_id": 1,
            "cost_center_id": 1,
            "nomenclature_id": 1,
            "row_type_id": 1,
            "cost_sum": 100,
            "operation_dttm": datetime.now().isoformat()
        }

        # Test comment field length
        test_cases = [
            ("A" * 255, 201),  # Max length
            ("A" * 256, 422),  # Too long
            ("", 201),  # Empty is valid
            ("Normal comment", 201),  # Normal length
        ]

        for comment, expected_status in test_cases:
            data = {**base_data, "comment_description": comment}
            response = await async_client.post("/registry", json=data)
            assert response.status_code == expected_status

    @pytest.mark.asyncio
    async def test_product_barcode_validation(self, async_client: AsyncClient):
        """Test product barcode validation."""
        base_product = {
            "product_name": "Test Product",
            "category_name": "Test Category",
            "unit_measure": "шт"
        }

        # Test barcode formats
        barcode_tests = [
            ("1234567890123", 201),  # Valid EAN-13
            ("12345678", 201),  # Valid EAN-8
            ("123", 422),  # Too short
            ("12345678901234567890", 422),  # Too long
            ("ABCD1234", 422),  # Non-numeric
            ("", 201),  # Empty might be allowed
        ]

        for barcode, expected_status in barcode_tests:
            data = {**base_product, "barcode": barcode}
            response = await async_client.post("/products", json=data)
            assert response.status_code == expected_status

    @pytest.mark.asyncio
    async def test_enum_field_validation(self, async_client: AsyncClient):
        """Test enum/choice field validation."""
        # Test nomenclature group field
        base_nomenclature = {
            "nomenclature_name": "Test Nomenclature"
        }

        group_tests = [
            ("Доходы", 201),
            ("Расходы", 201),
            ("Invalid Group", 422),
            ("", 422),
            (None, 422),
        ]

        for group, expected_status in group_tests:
            data = {**base_nomenclature, "nomenclature_group": group}
            response = await async_client.post("/nomenclatures", json=data)
            assert response.status_code == expected_status

    @pytest.mark.asyncio
    async def test_numeric_range_validation(self, async_client: AsyncClient):
        """Test numeric field range validation."""
        # Test user_id range
        test_cases = [
            (1, 200),  # Valid
            (2147483647, 200),  # Max int32
            (2147483648, 422),  # Overflow
            (0, 422),  # Zero might be invalid for ID
            (-1, 422),  # Negative
        ]

        for user_id, expected_status in test_cases:
            response = await async_client.get(f"/users/{user_id}")
            assert response.status_code == expected_status

    @pytest.mark.asyncio
    async def test_required_fields_validation(self, async_client: AsyncClient):
        """Test required fields validation."""
        # Test missing required fields
        incomplete_data = {
            "cost_sum": 100
            # Missing all other required fields
        }

        response = await async_client.post("/registry", json=incomplete_data)
        assert response.status_code == 422
        
        # Check error details
        error_detail = response.json()
        assert "detail" in error_detail
        # Should indicate which fields are missing

    @pytest.mark.asyncio
    async def test_json_payload_validation(self, async_client: AsyncClient):
        """Test JSON payload validation."""
        # Test invalid JSON
        invalid_payloads = [
            "not json",  # Plain string
            "{invalid json}",  # Malformed JSON
            '{"key": undefined}',  # JavaScript undefined
        ]

        for payload in invalid_payloads:
            response = await async_client.post(
                "/registry",
                content=payload,
                headers={"Content-Type": "application/json"}
            )
            assert response.status_code in [422, 400]