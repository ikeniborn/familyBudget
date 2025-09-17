"""
Comprehensive tests for user data isolation across all entities.
Verifies that all data is properly isolated by user_id and no data leakage occurs.
Tests the core security principle that users can only access their own data.
"""
import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession


class TestUserDataIsolationPeriods:
    """Test user data isolation for periods."""

    def test_periods_isolation_between_users(self, authenticated_client: TestClient, second_authenticated_client: TestClient):
        """Test that users can only see their own periods."""
        # User 1 creates period
        period_data = {
            "period": "2025.01",
            "period_year": 2025,
            "period_month": 1,
            "period_start_date": "2025-01-01",
            "period_end_date": "2025-01-31"
        }

        response = authenticated_client.post("/api/periods/", json=period_data)
        assert response.status_code == status.HTTP_200_OK
        user1_period = response.json()["data"]

        # User 2 creates period
        period_data["period"] = "2025.02"
        period_data["period_month"] = 2
        period_data["period_start_date"] = "2025-02-01"
        period_data["period_end_date"] = "2025-02-28"

        response = second_authenticated_client.post("/api/periods/", json=period_data)
        assert response.status_code == status.HTTP_200_OK
        user2_period = response.json()["data"]

        # Verify periods have different user_ids
        assert user1_period["user_id"] != user2_period["user_id"]

        # User 1 cannot access user 2's period
        response = authenticated_client.get(f"/api/periods/{user2_period['id']}")
        assert response.status_code == status.HTTP_404_NOT_FOUND

        # User 2 cannot access user 1's period
        response = second_authenticated_client.get(f"/api/periods/{user1_period['id']}")
        assert response.status_code == status.HTTP_404_NOT_FOUND

        # User 1's list should only contain their period
        response = authenticated_client.get("/api/periods/")
        user1_periods = response.json()["data"]
        period_ids = [p["id"] for p in user1_periods]
        assert user1_period["id"] in period_ids
        assert user2_period["id"] not in period_ids

        # User 2's list should only contain their period
        response = second_authenticated_client.get("/api/periods/")
        user2_periods = response.json()["data"]
        period_ids = [p["id"] for p in user2_periods]
        assert user2_period["id"] in period_ids
        assert user1_period["id"] not in period_ids


class TestUserDataIsolationFinancialCenters:
    """Test user data isolation for financial centers."""

    def test_financial_centers_isolation_between_users(self, authenticated_client: TestClient, second_authenticated_client: TestClient):
        """Test that users can only see their own financial centers."""
        # User 1 creates financial center
        fc_data = {
            "financial_center_code": "FC001",
            "name": "Центр пользователя 1",
            "description": "Описание центра 1"
        }

        response = authenticated_client.post("/api/financial_centers/", json=fc_data)
        assert response.status_code == status.HTTP_200_OK
        user1_fc = response.json()["data"]

        # User 2 creates financial center
        fc_data["financial_center_code"] = "FC002"
        fc_data["name"] = "Центр пользователя 2"

        response = second_authenticated_client.post("/api/financial_centers/", json=fc_data)
        assert response.status_code == status.HTTP_200_OK
        user2_fc = response.json()["data"]

        # Verify financial centers have different user_ids
        assert user1_fc["user_id"] != user2_fc["user_id"]

        # User 1 cannot access user 2's financial center
        response = authenticated_client.get(f"/api/financial_centers/{user2_fc['id']}")
        assert response.status_code == status.HTTP_404_NOT_FOUND

        # User 2 cannot access user 1's financial center
        response = second_authenticated_client.get(f"/api/financial_centers/{user1_fc['id']}")
        assert response.status_code == status.HTTP_404_NOT_FOUND

        # User 1's list should only contain their financial center
        response = authenticated_client.get("/api/financial_centers/")
        user1_fcs = response.json()["data"]
        fc_ids = [fc["id"] for fc in user1_fcs]
        assert user1_fc["id"] in fc_ids
        assert user2_fc["id"] not in fc_ids

        # User 2's list should only contain their financial center
        response = second_authenticated_client.get("/api/financial_centers/")
        user2_fcs = response.json()["data"]
        fc_ids = [fc["id"] for fc in user2_fcs]
        assert user2_fc["id"] in fc_ids
        assert user1_fc["id"] not in fc_ids


class TestUserDataIsolationCostCenters:
    """Test user data isolation for cost centers."""

    def test_cost_centers_isolation_between_users(self, authenticated_client: TestClient, second_authenticated_client: TestClient):
        """Test that users can only see their own cost centers."""
        # User 1 creates cost center
        cc_data = {
            "cost_center_code": "CC001",
            "name": "Центр затрат 1",
            "description": "Описание центра затрат 1"
        }

        response = authenticated_client.post("/api/cost_centers/", json=cc_data)
        assert response.status_code == status.HTTP_200_OK
        user1_cc = response.json()["data"]

        # User 2 creates cost center
        cc_data["cost_center_code"] = "CC002"
        cc_data["name"] = "Центр затрат 2"

        response = second_authenticated_client.post("/api/cost_centers/", json=cc_data)
        assert response.status_code == status.HTTP_200_OK
        user2_cc = response.json()["data"]

        # Verify cost centers have different user_ids
        assert user1_cc["user_id"] != user2_cc["user_id"]

        # User 1 cannot access user 2's cost center
        response = authenticated_client.get(f"/api/cost_centers/{user2_cc['id']}")
        assert response.status_code == status.HTTP_404_NOT_FOUND

        # User 2 cannot access user 1's cost center
        response = second_authenticated_client.get(f"/api/cost_centers/{user1_cc['id']}")
        assert response.status_code == status.HTTP_404_NOT_FOUND

        # User 1's list should only contain their cost center
        response = authenticated_client.get("/api/cost_centers/")
        user1_ccs = response.json()["data"]
        cc_ids = [cc["id"] for cc in user1_ccs]
        assert user1_cc["id"] in cc_ids
        assert user2_cc["id"] not in cc_ids

        # User 2's list should only contain their cost center
        response = second_authenticated_client.get("/api/cost_centers/")
        user2_ccs = response.json()["data"]
        cc_ids = [cc["id"] for cc in user2_ccs]
        assert user2_cc["id"] in cc_ids
        assert user1_cc["id"] not in cc_ids


class TestUserDataIsolationNomenclatures:
    """Test user data isolation for nomenclatures."""

    def test_nomenclatures_isolation_between_users(self, authenticated_client: TestClient, second_authenticated_client: TestClient):
        """Test that users can only see their own nomenclatures."""
        # User 1 creates nomenclature
        nom_data = {
            "nomenclature_code": "NOM001",
            "name": "Номенклатура 1",
            "account_name": "Счет 1",
            "bill_name": "Счет-фактура 1",
            "operation": "Операция 1"
        }

        response = authenticated_client.post("/api/nomenclatures/", json=nom_data)
        assert response.status_code == status.HTTP_200_OK
        user1_nom = response.json()["data"]

        # User 2 creates nomenclature
        nom_data["nomenclature_code"] = "NOM002"
        nom_data["name"] = "Номенклатура 2"

        response = second_authenticated_client.post("/api/nomenclatures/", json=nom_data)
        assert response.status_code == status.HTTP_200_OK
        user2_nom = response.json()["data"]

        # Verify nomenclatures have different user_ids
        assert user1_nom["user_id"] != user2_nom["user_id"]

        # User 1 cannot access user 2's nomenclature
        response = authenticated_client.get(f"/api/nomenclatures/{user2_nom['id']}")
        assert response.status_code == status.HTTP_404_NOT_FOUND

        # User 2 cannot access user 1's nomenclature
        response = second_authenticated_client.get(f"/api/nomenclatures/{user1_nom['id']}")
        assert response.status_code == status.HTTP_404_NOT_FOUND

        # User 1's list should only contain their nomenclature
        response = authenticated_client.get("/api/nomenclatures/")
        user1_noms = response.json()["data"]
        nom_ids = [nom["id"] for nom in user1_noms]
        assert user1_nom["id"] in nom_ids
        assert user2_nom["id"] not in nom_ids

        # User 2's list should only contain their nomenclature
        response = second_authenticated_client.get("/api/nomenclatures/")
        user2_noms = response.json()["data"]
        nom_ids = [nom["id"] for nom in user2_noms]
        assert user2_nom["id"] in nom_ids
        assert user1_nom["id"] not in nom_ids


class TestUserDataIsolationArticles:
    """Test user data isolation for articles."""

    def test_articles_isolation_between_users(self, authenticated_client: TestClient, second_authenticated_client: TestClient):
        """Test that users can only see their own articles."""
        # User 1 creates article
        article_data = {
            "code": "ART001",
            "name": "Статья пользователя 1",
            "description": "Описание статьи 1",
            "is_active": True
        }

        response = authenticated_client.post("/api/articles/", json=article_data)
        assert response.status_code == status.HTTP_200_OK
        user1_article = response.json()["data"]

        # User 2 creates article
        article_data["code"] = "ART002"
        article_data["name"] = "Статья пользователя 2"

        response = second_authenticated_client.post("/api/articles/", json=article_data)
        assert response.status_code == status.HTTP_200_OK
        user2_article = response.json()["data"]

        # Verify articles have different user_ids
        assert user1_article["user_id"] != user2_article["user_id"]

        # User 1 cannot access user 2's article
        response = authenticated_client.get(f"/api/articles/{user2_article['id']}")
        assert response.status_code == status.HTTP_404_NOT_FOUND

        # User 2 cannot access user 1's article
        response = second_authenticated_client.get(f"/api/articles/{user1_article['id']}")
        assert response.status_code == status.HTTP_404_NOT_FOUND

        # User 1's list should only contain their article
        response = authenticated_client.get("/api/articles/")
        user1_articles = response.json()["data"]
        article_ids = [art["id"] for art in user1_articles]
        assert user1_article["id"] in article_ids
        assert user2_article["id"] not in article_ids

        # User 2's list should only contain their article
        response = second_authenticated_client.get("/api/articles/")
        user2_articles = response.json()["data"]
        article_ids = [art["id"] for art in user2_articles]
        assert user2_article["id"] in article_ids
        assert user1_article["id"] not in article_ids


class TestCrossEntityUserIsolation:
    """Test user isolation across different entity types."""

    def test_cross_entity_isolation(self, authenticated_client: TestClient, second_authenticated_client: TestClient):
        """Test that user isolation works consistently across all entity types."""
        # Create entities for user 1
        user1_entities = {}

        # Period
        response = authenticated_client.post("/api/periods/", json={
            "period": "2025.01", "period_year": 2025, "period_month": 1,
            "period_start_date": "2025-01-01", "period_end_date": "2025-01-31"
        })
        user1_entities["period"] = response.json()["data"]

        # Financial Center
        response = authenticated_client.post("/api/financial_centers/", json={
            "financial_center_code": "FC1", "name": "FC User 1"
        })
        user1_entities["financial_center"] = response.json()["data"]

        # Cost Center
        response = authenticated_client.post("/api/cost_centers/", json={
            "cost_center_code": "CC1", "name": "CC User 1"
        })
        user1_entities["cost_center"] = response.json()["data"]

        # Nomenclature
        response = authenticated_client.post("/api/nomenclatures/", json={
            "nomenclature_code": "NOM1", "name": "Nomenclature User 1",
            "account_name": "Account 1", "bill_name": "Bill 1", "operation": "Op 1"
        })
        user1_entities["nomenclature"] = response.json()["data"]

        # Article
        response = authenticated_client.post("/api/articles/", json={
            "code": "ART1", "name": "Article User 1", "is_active": True
        })
        user1_entities["article"] = response.json()["data"]

        # Create entities for user 2
        user2_entities = {}

        # Period
        response = second_authenticated_client.post("/api/periods/", json={
            "period": "2025.02", "period_year": 2025, "period_month": 2,
            "period_start_date": "2025-02-01", "period_end_date": "2025-02-28"
        })
        user2_entities["period"] = response.json()["data"]

        # Financial Center
        response = second_authenticated_client.post("/api/financial_centers/", json={
            "financial_center_code": "FC2", "name": "FC User 2"
        })
        user2_entities["financial_center"] = response.json()["data"]

        # Cost Center
        response = second_authenticated_client.post("/api/cost_centers/", json={
            "cost_center_code": "CC2", "name": "CC User 2"
        })
        user2_entities["cost_center"] = response.json()["data"]

        # Nomenclature
        response = second_authenticated_client.post("/api/nomenclatures/", json={
            "nomenclature_code": "NOM2", "name": "Nomenclature User 2",
            "account_name": "Account 2", "bill_name": "Bill 2", "operation": "Op 2"
        })
        user2_entities["nomenclature"] = response.json()["data"]

        # Article
        response = second_authenticated_client.post("/api/articles/", json={
            "code": "ART2", "name": "Article User 2", "is_active": True
        })
        user2_entities["article"] = response.json()["data"]

        # Verify all entities have correct user_ids
        for entity_type, entity in user1_entities.items():
            assert "user_id" in entity
            assert entity["user_id"] is not None

        for entity_type, entity in user2_entities.items():
            assert "user_id" in entity
            assert entity["user_id"] is not None

        # Verify user_ids are different between users
        for entity_type in user1_entities.keys():
            assert user1_entities[entity_type]["user_id"] != user2_entities[entity_type]["user_id"]

        # Test cross-access denial
        endpoints = {
            "period": "/api/periods/",
            "financial_center": "/api/financial_centers/",
            "cost_center": "/api/cost_centers/",
            "nomenclature": "/api/nomenclatures/",
            "article": "/api/articles/"
        }

        for entity_type, endpoint in endpoints.items():
            user1_id = user1_entities[entity_type]["id"]
            user2_id = user2_entities[entity_type]["id"]

            # User 1 cannot access user 2's entity
            response = authenticated_client.get(f"{endpoint}{user2_id}")
            assert response.status_code == status.HTTP_404_NOT_FOUND, f"User 1 should not access user 2's {entity_type}"

            # User 2 cannot access user 1's entity
            response = second_authenticated_client.get(f"{endpoint}{user1_id}")
            assert response.status_code == status.HTTP_404_NOT_FOUND, f"User 2 should not access user 1's {entity_type}"


class TestUserIdEnforcement:
    """Test that user_id is always required and enforced."""

    def test_user_id_automatically_set(self, authenticated_client: TestClient):
        """Test that user_id is automatically set for all entity types."""
        test_data = [
            ("/api/periods/", {
                "period": "2025.03", "period_year": 2025, "period_month": 3,
                "period_start_date": "2025-03-01", "period_end_date": "2025-03-31"
            }),
            ("/api/financial_centers/", {
                "financial_center_code": "AUTO_FC", "name": "Auto FC"
            }),
            ("/api/cost_centers/", {
                "cost_center_code": "AUTO_CC", "name": "Auto CC"
            }),
            ("/api/nomenclatures/", {
                "nomenclature_code": "AUTO_NOM", "name": "Auto Nomenclature",
                "account_name": "Auto Account", "bill_name": "Auto Bill", "operation": "Auto Op"
            }),
            ("/api/articles/", {
                "code": "AUTO_ART", "name": "Auto Article", "is_active": True
            })
        ]

        for endpoint, data in test_data:
            response = authenticated_client.post(endpoint, json=data)
            assert response.status_code == status.HTTP_200_OK, f"Failed to create entity at {endpoint}"

            entity = response.json()["data"]
            assert "user_id" in entity, f"user_id missing in response from {endpoint}"
            assert entity["user_id"] is not None, f"user_id is null in response from {endpoint}"
            assert isinstance(entity["user_id"], int), f"user_id is not integer in response from {endpoint}"

    def test_statistics_user_isolation(self, authenticated_client: TestClient, second_authenticated_client: TestClient):
        """Test that statistics endpoints respect user isolation."""
        # Create data for user 1
        authenticated_client.post("/api/periods/", json={
            "period": "2025.04", "period_year": 2025, "period_month": 4,
            "period_start_date": "2025-04-01", "period_end_date": "2025-04-30"
        })
        authenticated_client.post("/api/financial_centers/", json={
            "financial_center_code": "STAT_FC1", "name": "Stats FC 1"
        })
        authenticated_client.post("/api/articles/", json={
            "code": "STAT_ART1", "name": "Stats Article 1", "is_active": True
        })

        # Create data for user 2
        second_authenticated_client.post("/api/periods/", json={
            "period": "2025.05", "period_year": 2025, "period_month": 5,
            "period_start_date": "2025-05-01", "period_end_date": "2025-05-31"
        })
        second_authenticated_client.post("/api/financial_centers/", json={
            "financial_center_code": "STAT_FC2", "name": "Stats FC 2"
        })

        # Check statistics for user 1
        response = authenticated_client.get("/api/periods/stats")
        user1_stats = response.json()["data"]

        response = second_authenticated_client.get("/api/periods/stats")
        user2_stats = response.json()["data"]

        # Statistics should reflect only each user's data
        assert user1_stats["total"] >= 1
        assert user2_stats["total"] >= 1

        # If there's an articles stats endpoint, check it too
        response = authenticated_client.get("/api/articles/stats")
        if response.status_code == status.HTTP_200_OK:
            user1_article_stats = response.json()["data"]

            response = second_authenticated_client.get("/api/articles/stats")
            assert response.status_code == status.HTTP_200_OK
            user2_article_stats = response.json()["data"]

            # User 1 should have at least 1 article, user 2 should have 0
            assert user1_article_stats["total"] >= 1
            assert user2_article_stats["total"] == 0

    def test_bulk_operations_user_isolation(self, authenticated_client: TestClient, second_authenticated_client: TestClient):
        """Test that bulk operations respect user isolation."""
        # Create articles for each user
        response1 = authenticated_client.post("/api/articles/", json={
            "code": "BULK1", "name": "Bulk Article 1", "is_active": True
        })
        user1_article_id = response1.json()["data"]["id"]

        response2 = second_authenticated_client.post("/api/articles/", json={
            "code": "BULK2", "name": "Bulk Article 2", "is_active": True
        })
        user2_article_id = response2.json()["data"]["id"]

        # User 1 tries to bulk delete both articles (should fail)
        response = authenticated_client.post("/api/articles/bulk-delete", json={
            "article_ids": [user1_article_id, user2_article_id]
        })
        assert response.status_code in [status.HTTP_400_BAD_REQUEST, status.HTTP_404_NOT_FOUND]

        # User 1 can only bulk delete their own article
        response = authenticated_client.post("/api/articles/bulk-delete", json={
            "article_ids": [user1_article_id]
        })
        assert response.status_code == status.HTTP_200_OK

        # Verify user 2's article still exists
        response = second_authenticated_client.get(f"/api/articles/{user2_article_id}")
        assert response.status_code == status.HTTP_200_OK

    def test_update_operations_user_isolation(self, authenticated_client: TestClient, second_authenticated_client: TestClient):
        """Test that update operations respect user isolation."""
        # Create entities for each user
        response1 = authenticated_client.post("/api/articles/", json={
            "code": "UPDATE1", "name": "Update Article 1", "is_active": True
        })
        user1_article_id = response1.json()["data"]["id"]

        response2 = second_authenticated_client.post("/api/articles/", json={
            "code": "UPDATE2", "name": "Update Article 2", "is_active": True
        })
        user2_article_id = response2.json()["data"]["id"]

        # User 1 cannot update user 2's article
        response = authenticated_client.put(f"/api/articles/{user2_article_id}", json={
            "name": "Attempted Update"
        })
        assert response.status_code == status.HTTP_404_NOT_FOUND

        # User 2 cannot update user 1's article
        response = second_authenticated_client.put(f"/api/articles/{user1_article_id}", json={
            "name": "Attempted Update"
        })
        assert response.status_code == status.HTTP_404_NOT_FOUND

        # Users can update their own articles
        response = authenticated_client.put(f"/api/articles/{user1_article_id}", json={
            "name": "Successfully Updated by User 1"
        })
        assert response.status_code == status.HTTP_200_OK

        response = second_authenticated_client.put(f"/api/articles/{user2_article_id}", json={
            "name": "Successfully Updated by User 2"
        })
        assert response.status_code == status.HTTP_200_OK

    def test_delete_operations_user_isolation(self, authenticated_client: TestClient, second_authenticated_client: TestClient):
        """Test that delete operations respect user isolation."""
        # Create entities for each user
        response1 = authenticated_client.post("/api/articles/", json={
            "code": "DELETE1", "name": "Delete Article 1", "is_active": True
        })
        user1_article_id = response1.json()["data"]["id"]

        response2 = second_authenticated_client.post("/api/articles/", json={
            "code": "DELETE2", "name": "Delete Article 2", "is_active": True
        })
        user2_article_id = response2.json()["data"]["id"]

        # User 1 cannot delete user 2's article
        response = authenticated_client.delete(f"/api/articles/{user2_article_id}")
        assert response.status_code == status.HTTP_404_NOT_FOUND

        # User 2 cannot delete user 1's article
        response = second_authenticated_client.delete(f"/api/articles/{user1_article_id}")
        assert response.status_code == status.HTTP_404_NOT_FOUND

        # Users can delete their own articles
        response = authenticated_client.delete(f"/api/articles/{user1_article_id}")
        assert response.status_code == status.HTTP_200_OK

        response = second_authenticated_client.delete(f"/api/articles/{user2_article_id}")
        assert response.status_code == status.HTTP_200_OK

        # Verify articles are deleted
        response = authenticated_client.get(f"/api/articles/{user1_article_id}")
        assert response.status_code == status.HTTP_404_NOT_FOUND

        response = second_authenticated_client.get(f"/api/articles/{user2_article_id}")
        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestAdminUserDataIsolation:
    """Test that even admin users have isolated data."""

    def test_admin_data_isolation(self, admin_authenticated_client: TestClient, authenticated_client: TestClient):
        """Test that admin users also have data isolation."""
        # Admin creates article
        response = admin_authenticated_client.post("/api/articles/", json={
            "code": "ADMIN_ART", "name": "Admin Article", "is_active": True
        })
        assert response.status_code == status.HTTP_200_OK
        admin_article = response.json()["data"]

        # Regular user creates article
        response = authenticated_client.post("/api/articles/", json={
            "code": "USER_ART", "name": "User Article", "is_active": True
        })
        assert response.status_code == status.HTTP_200_OK
        user_article = response.json()["data"]

        # Articles should have different user_ids
        assert admin_article["user_id"] != user_article["user_id"]

        # Admin cannot see user's article
        response = admin_authenticated_client.get(f"/api/articles/{user_article['id']}")
        assert response.status_code == status.HTTP_404_NOT_FOUND

        # User cannot see admin's article
        response = authenticated_client.get(f"/api/articles/{admin_article['id']}")
        assert response.status_code == status.HTTP_404_NOT_FOUND

        # Each can only see their own articles in lists
        response = admin_authenticated_client.get("/api/articles/")
        admin_articles = response.json()["data"]
        admin_article_ids = [a["id"] for a in admin_articles]
        assert admin_article["id"] in admin_article_ids
        assert user_article["id"] not in admin_article_ids

        response = authenticated_client.get("/api/articles/")
        user_articles = response.json()["data"]
        user_article_ids = [a["id"] for a in user_articles]
        assert user_article["id"] in user_article_ids
        assert admin_article["id"] not in user_article_ids