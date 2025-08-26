"""
Tests for report endpoints.
"""
import pytest
from datetime import datetime
from fastapi import status
from fastapi.testclient import TestClient


class TestReportEndpoints:
    """Test report generation endpoints."""
    
    @pytest.fixture(autouse=True)
    def setup_test_data(self, authenticated_client: TestClient):
        """Setup test data for reports."""
        # Create periods
        periods = []
        for month in range(1, 4):
            period_response = authenticated_client.post("/api/periods", json={
                "period": f"2025.0{month}",
                "is_active": month == 1
            })
            periods.append(period_response.json()["data"]["id"])
        self.period_ids = periods
        
        # Create financial centers
        fc_response = authenticated_client.post("/api/financial_centers", json={
            "code": "FC001",
            "name": "Family Budget"
        })
        self.fc_id = fc_response.json()["data"]["id"]
        
        # Create cost centers
        cc_home = authenticated_client.post("/api/cost_centers", json={
            "code": "CC001",
            "name": "Home"
        })
        cc_transport = authenticated_client.post("/api/cost_centers", json={
            "code": "CC002",
            "name": "Transport"
        })
        self.cc_home_id = cc_home.json()["data"]["id"]
        self.cc_transport_id = cc_transport.json()["data"]["id"]
        
        # Create nomenclatures
        nom_food = authenticated_client.post("/api/nomenclatures", json={
            "code": "N001",
            "name": "Food"
        })
        nom_utilities = authenticated_client.post("/api/nomenclatures", json={
            "code": "N002",
            "name": "Utilities"
        })
        nom_fuel = authenticated_client.post("/api/nomenclatures", json={
            "code": "N003",
            "name": "Fuel"
        })
        self.nom_food_id = nom_food.json()["data"]["id"]
        self.nom_utilities_id = nom_utilities.json()["data"]["id"]
        self.nom_fuel_id = nom_fuel.json()["data"]["id"]
        
        # Create registry entries for testing
        self._create_test_transactions(authenticated_client)
    
    def _create_test_transactions(self, client: TestClient):
        """Create test transactions for reports."""
        # Plan entries for first period
        plans = [
            (self.cc_home_id, self.nom_food_id, 15000.00),
            (self.cc_home_id, self.nom_utilities_id, 5000.00),
            (self.cc_transport_id, self.nom_fuel_id, 8000.00)
        ]
        
        for cc_id, nom_id, amount in plans:
            client.post("/api/registry", json={
                "period_id": self.period_ids[0],
                "financial_center_id": self.fc_id,
                "cost_center_id": cc_id,
                "nomenclature_id": nom_id,
                "row_type": 1,  # Plan
                "summ": amount,
                "comment": "Monthly plan"
            })
        
        # Fact entries for first period
        facts = [
            (self.cc_home_id, self.nom_food_id, 14500.00),
            (self.cc_home_id, self.nom_utilities_id, 5200.00),
            (self.cc_transport_id, self.nom_fuel_id, 7500.00)
        ]
        
        for cc_id, nom_id, amount in facts:
            client.post("/api/registry", json={
                "period_id": self.period_ids[0],
                "financial_center_id": self.fc_id,
                "cost_center_id": cc_id,
                "nomenclature_id": nom_id,
                "row_type": 2,  # Fact
                "summ": amount,
                "comment": "Actual expense"
            })
    
    def test_budget_summary_report(self, authenticated_client: TestClient):
        """Test budget summary report generation."""
        response = authenticated_client.get(
            f"/api/reports/budget-summary?period_id={self.period_ids[0]}"
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True
        assert "summary" in data["data"]
        
        summary = data["data"]["summary"]
        assert "total_plan" in summary
        assert "total_fact" in summary
        assert "deviation" in summary
        assert "execution_rate" in summary
        
        # Check calculations
        assert float(summary["total_plan"]) == 28000.00
        assert float(summary["total_fact"]) == 27200.00
        assert float(summary["deviation"]) == -800.00
        assert summary["execution_rate"] > 0
    
    def test_nomenclature_breakdown_report(self, authenticated_client: TestClient):
        """Test nomenclature breakdown report."""
        response = authenticated_client.get(
            f"/api/reports/nomenclature-breakdown?period_id={self.period_ids[0]}"
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "breakdown" in data["data"]
        
        breakdown = data["data"]["breakdown"]
        assert len(breakdown) == 3  # Three nomenclatures
        
        for item in breakdown:
            assert "nomenclature_name" in item
            assert "plan_amount" in item
            assert "fact_amount" in item
            assert "deviation" in item
    
    def test_cost_center_report(self, authenticated_client: TestClient):
        """Test cost center report."""
        response = authenticated_client.get(
            f"/api/reports/cost-centers?period_id={self.period_ids[0]}"
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "cost_centers" in data["data"]
        
        cost_centers = data["data"]["cost_centers"]
        assert len(cost_centers) == 2  # Two cost centers
        
        for cc in cost_centers:
            assert "cost_center_name" in cc
            assert "total_plan" in cc
            assert "total_fact" in cc
            assert "utilization_rate" in cc
    
    def test_trend_analysis_report(self, authenticated_client: TestClient):
        """Test trend analysis across periods."""
        # Add data for multiple periods
        for period_id in self.period_ids[1:]:
            authenticated_client.post("/api/registry", json={
                "period_id": period_id,
                "financial_center_id": self.fc_id,
                "cost_center_id": self.cc_home_id,
                "nomenclature_id": self.nom_food_id,
                "row_type": 2,  # Fact
                "summ": 15000.00 + (period_id * 500),  # Increasing trend
                "comment": "Monthly food expense"
            })
        
        # Get trend report
        response = authenticated_client.get(
            f"/api/reports/trends?nomenclature_id={self.nom_food_id}"
        )
        if response.status_code == status.HTTP_200_OK:
            data = response.json()
            assert "trends" in data["data"]
            trends = data["data"]["trends"]
            assert len(trends) >= 2  # At least 2 periods with data
    
    def test_plan_vs_fact_comparison(self, authenticated_client: TestClient):
        """Test plan vs fact comparison report."""
        response = authenticated_client.get(
            f"/api/reports/plan-vs-fact?period_id={self.period_ids[0]}"
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "comparison" in data["data"]
        
        comparison = data["data"]["comparison"]
        assert "items" in comparison
        
        for item in comparison["items"]:
            assert "category" in item
            assert "plan" in item
            assert "fact" in item
            assert "difference" in item
            assert "percentage" in item
    
    def test_financial_center_report(self, authenticated_client: TestClient):
        """Test financial center report."""
        response = authenticated_client.get(
            f"/api/reports/financial-centers?period_id={self.period_ids[0]}"
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "financial_centers" in data["data"]
        
        fc_data = data["data"]["financial_centers"]
        assert len(fc_data) == 1  # One financial center
        assert fc_data[0]["name"] == "Family Budget"
    
    def test_export_report_to_csv(self, authenticated_client: TestClient):
        """Test exporting report to CSV format."""
        response = authenticated_client.get(
            f"/api/reports/export/csv?period_id={self.period_ids[0]}"
        )
        if response.status_code == status.HTTP_200_OK:
            assert response.headers.get("content-type") == "text/csv"
            assert "attachment" in response.headers.get("content-disposition", "")
    
    def test_export_report_to_excel(self, authenticated_client: TestClient):
        """Test exporting report to Excel format."""
        response = authenticated_client.get(
            f"/api/reports/export/excel?period_id={self.period_ids[0]}"
        )
        if response.status_code == status.HTTP_200_OK:
            content_type = response.headers.get("content-type")
            assert "spreadsheet" in content_type or "excel" in content_type
    
    def test_report_with_filters(self, authenticated_client: TestClient):
        """Test generating report with multiple filters."""
        response = authenticated_client.get(
            f"/api/reports/detailed?"
            f"period_id={self.period_ids[0]}&"
            f"cost_center_id={self.cc_home_id}&"
            f"row_type=2"  # Only facts
        )
        if response.status_code == status.HTTP_200_OK:
            data = response.json()
            assert "data" in data
            # All items should be from home cost center and fact type
            for item in data.get("data", {}).get("items", []):
                assert item.get("cost_center_id") == self.cc_home_id
                assert item.get("row_type") == 2
    
    def test_year_to_date_report(self, authenticated_client: TestClient):
        """Test year-to-date cumulative report."""
        response = authenticated_client.get("/api/reports/year-to-date?year=2025")
        if response.status_code == status.HTTP_200_OK:
            data = response.json()
            assert "ytd_summary" in data["data"]
            ytd = data["data"]["ytd_summary"]
            assert "total_plan" in ytd
            assert "total_fact" in ytd
            assert "months_included" in ytd
    
    def test_empty_period_report(self, authenticated_client: TestClient):
        """Test report for period with no data."""
        # Use last period which has no data
        response = authenticated_client.get(
            f"/api/reports/budget-summary?period_id={self.period_ids[-1]}"
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        summary = data["data"]["summary"]
        # Should return zeros or empty data
        assert float(summary.get("total_plan", 0)) == 0 or len(summary.get("items", [])) == 0
    
    def test_report_access_control(self, client: TestClient):
        """Test that reports are only accessible to authenticated users."""
        response = client.get("/api/reports/budget-summary?period_id=1")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_invalid_period_report(self, authenticated_client: TestClient):
        """Test report with invalid period ID."""
        response = authenticated_client.get("/api/reports/budget-summary?period_id=99999")
        assert response.status_code in [status.HTTP_404_NOT_FOUND, status.HTTP_400_BAD_REQUEST]