"""
Comprehensive tests for articles API endpoints.
Tests all CRUD operations with focus on authentication, authorization, user isolation, and shared articles.
Updated to test unified API response format: {"success": true/false, "data": ..., "error": ...}
"""
import pytest
from datetime import datetime
from fastapi import status
from fastapi.testclient import TestClient
from httpx import AsyncClient


def validate_success_response(response_data: dict, expected_data_checks: dict = None):
    """Helper function to validate unified success response format."""
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
    """Helper function to validate unified error response format."""
    assert "success" in response_data
    assert response_data["success"] is False
    assert "error" in response_data
    assert isinstance(response_data["error"], str)

    if expected_error_substring:
        assert expected_error_substring in response_data["error"]

    return response_data["error"]


def validate_list_response(response_data: dict, expected_total: int = None):
    """Helper function to validate unified list response format."""
    assert "success" in response_data
    assert response_data["success"] is True
    assert "data" in response_data
    assert isinstance(response_data["data"], list)

    if expected_total is not None:
        assert "total" in response_data
        assert response_data["total"] == expected_total

    return response_data["data"]


class TestArticlesCRUDOperations:
    """Test basic CRUD operations for articles."""

    def test_create_article_success(self, authenticated_client: TestClient):
        """Test successful article creation with unified response format."""
        article_data = {
            "code": "FOOD",
            "name": "Питание",
            "description": "Расходы на питание",
            "is_active": True
        }

        response = authenticated_client.post("/api/articles/", json=article_data)
        assert response.status_code == status.HTTP_200_OK

        response_data = response.json()
        data = validate_success_response(response_data, {
            "code": "FOOD",
            "name": "Питание",
            "description": "Расходы на питание",
            "is_active": True
        })
        assert "id" in data
        assert data["is_editable"] is True
        assert data["is_shared"] is False

    def test_create_shared_article_admin(self, admin_authenticated_client: TestClient):
        """Test successful shared article creation by admin with unified response."""
        article_data = {
            "code": "TRANSPORT",
            "name": "Транспорт",
            "description": "Транспортные расходы",
            "is_active": True,
            "user_id": None  # Shared article
        }

        response = admin_authenticated_client.post("/api/articles/", json=article_data)
        assert response.status_code == status.HTTP_200_OK

        response_data = response.json()
        data = validate_success_response(response_data, {
            "code": "TRANSPORT",
            "name": "Транспорт",
            "is_active": True
        })
        assert data["is_shared"] is True
        assert data["is_editable"] is True

    def test_create_shared_article_regular_user_forbidden(self, authenticated_client: TestClient):
        """Test that regular users cannot create shared articles."""
        article_data = {
            "code": "SHARED_ONLY",
            "name": "Общая статья",
            "is_active": True,
            "user_id": None  # Shared article
        }

        response = authenticated_client.post("/api/articles/", json=article_data)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

        response_data = response.json()
        validate_error_response(response_data, "Only administrators can create shared articles")

    def test_create_article_duplicate_code(self, authenticated_client: TestClient):
        """Test article creation with duplicate code returns 409 conflict."""
        article_data = {
            "code": "DUPLICATE",
            "name": "Первая статья",
            "is_active": True
        }

        # Create first article
        response = authenticated_client.post("/api/articles/", json=article_data)
        assert response.status_code == status.HTTP_200_OK

        # Try to create another with same code
        article_data["name"] = "Вторая статья"
        response = authenticated_client.post("/api/articles/", json=article_data)
        assert response.status_code == status.HTTP_409_CONFLICT

        response_data = response.json()
        validate_error_response(response_data, "already exists")

    def test_create_article_missing_required_fields(self, authenticated_client: TestClient):
        """Test article creation with missing required fields."""
        article_data = {
            "name": "Статья без кода"
            # Missing required 'code' field
        }

        response = authenticated_client.post("/api/articles/", json=article_data)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_get_articles_list(self, authenticated_client: TestClient):
        """Test retrieving articles list with unified response format."""
        # Create test articles
        articles_data = [
            {"code": "FOOD", "name": "Питание", "is_active": True},
            {"code": "TRANSPORT", "name": "Транспорт", "is_active": False},
            {"code": "HOUSING", "name": "Жильё", "is_active": True}
        ]

        for article_data in articles_data:
            response = authenticated_client.post("/api/articles/", json=article_data)
            assert response.status_code == status.HTTP_200_OK

        # Get articles list
        response = authenticated_client.get("/api/articles/")
        assert response.status_code == status.HTTP_200_OK

        response_data = response.json()
        articles = validate_list_response(response_data)
        assert len(articles) >= 3

        # Check articles structure
        for article in articles:
            assert "id" in article
            assert "code" in article
            assert "name" in article
            assert "is_active" in article
            assert "is_editable" in article
            assert "is_shared" in article

    def test_get_articles_with_active_filter(self, authenticated_client: TestClient):
        """Test retrieving articles with active status filter."""
        # Create test articles with different active status
        authenticated_client.post("/api/articles/", json={
            "code": "ACTIVE1", "name": "Активная", "is_active": True
        })
        authenticated_client.post("/api/articles/", json={
            "code": "INACTIVE1", "name": "Неактивная", "is_active": False
        })

        # Get only active articles
        response = authenticated_client.get("/api/articles/?is_active=true")
        assert response.status_code == status.HTTP_200_OK

        response_data = response.json()
        articles = validate_list_response(response_data)

        # All returned articles should be active
        for article in articles:
            assert article["is_active"] is True

    def test_get_articles_pagination(self, authenticated_client: TestClient):
        """Test articles pagination."""
        # Create multiple articles
        for i in range(5):
            authenticated_client.post("/api/articles/", json={
                "code": f"PAGE{i}",
                "name": f"Статья {i}",
                "is_active": True
            })

        # Test pagination
        response = authenticated_client.get("/api/articles/?skip=2&limit=2")
        assert response.status_code == status.HTTP_200_OK

        response_data = response.json()
        articles = validate_list_response(response_data)
        assert len(articles) == 2

    def test_get_article_by_id(self, authenticated_client: TestClient):
        """Test retrieving article by ID with unified response format."""
        # Create article
        article_data = {
            "code": "GETBYID",
            "name": "Получить по ID",
            "description": "Тестовая статья",
            "is_active": True
        }

        response = authenticated_client.post("/api/articles/", json=article_data)
        assert response.status_code == status.HTTP_200_OK
        created_article = response.json()["data"]

        # Get article by ID
        response = authenticated_client.get(f"/api/articles/{created_article['id']}")
        assert response.status_code == status.HTTP_200_OK

        response_data = response.json()
        data = validate_success_response(response_data, {
            "code": "GETBYID",
            "name": "Получить по ID",
            "description": "Тестовая статья",
            "is_active": True
        })

    def test_get_article_by_id_not_found(self, authenticated_client: TestClient):
        """Test retrieving non-existent article returns 404."""
        response = authenticated_client.get("/api/articles/99999")
        assert response.status_code == status.HTTP_404_NOT_FOUND

        response_data = response.json()
        validate_error_response(response_data, "not found")

    def test_update_article_success(self, authenticated_client: TestClient):
        """Test successful article update with unified response format."""
        # Create article
        article_data = {
            "code": "UPDATE",
            "name": "Обновляемая статья",
            "is_active": True
        }

        response = authenticated_client.post("/api/articles/", json=article_data)
        assert response.status_code == status.HTTP_200_OK
        created_article = response.json()["data"]

        # Update article
        update_data = {
            "name": "Обновлённая статья",
            "description": "Добавлено описание",
            "is_active": False
        }

        response = authenticated_client.put(
            f"/api/articles/{created_article['id']}",
            json=update_data
        )
        assert response.status_code == status.HTTP_200_OK

        response_data = response.json()
        data = validate_success_response(response_data, {
            "code": "UPDATE",  # Should remain unchanged
            "name": "Обновлённая статья",
            "description": "Добавлено описание",
            "is_active": False
        })

    def test_update_article_not_found(self, authenticated_client: TestClient):
        """Test updating non-existent article returns 404."""
        update_data = {"name": "Новое название"}

        response = authenticated_client.put("/api/articles/99999", json=update_data)
        assert response.status_code == status.HTTP_404_NOT_FOUND

        response_data = response.json()
        validate_error_response(response_data, "not found")

    def test_update_article_duplicate_code(self, authenticated_client: TestClient):
        """Test updating article with duplicate code returns 409 conflict."""
        # Create two articles
        authenticated_client.post("/api/articles/", json={
            "code": "FIRST", "name": "Первая", "is_active": True
        })

        response = authenticated_client.post("/api/articles/", json={
            "code": "SECOND", "name": "Вторая", "is_active": True
        })
        second_article = response.json()["data"]

        # Try to update second article with first article's code
        update_data = {"code": "FIRST"}
        response = authenticated_client.put(
            f"/api/articles/{second_article['id']}",
            json=update_data
        )
        assert response.status_code == status.HTTP_409_CONFLICT

        response_data = response.json()
        validate_error_response(response_data, "already exists")

    def test_delete_article_success(self, authenticated_client: TestClient):
        """Test successful article deletion with unified response format."""
        # Create article
        article_data = {
            "code": "DELETE",
            "name": "Удаляемая статья",
            "is_active": True
        }

        response = authenticated_client.post("/api/articles/", json=article_data)
        assert response.status_code == status.HTTP_200_OK
        created_article = response.json()["data"]

        # Delete article
        response = authenticated_client.delete(f"/api/articles/{created_article['id']}")
        assert response.status_code == status.HTTP_200_OK

        response_data = response.json()
        data = validate_success_response(response_data)
        assert "message" in data
        assert "deleted successfully" in data["message"]

        # Verify article is deleted
        response = authenticated_client.get(f"/api/articles/{created_article['id']}")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_article_not_found(self, authenticated_client: TestClient):
        """Test deleting non-existent article returns 404."""
        response = authenticated_client.delete("/api/articles/99999")
        assert response.status_code == status.HTTP_404_NOT_FOUND

        response_data = response.json()
        validate_error_response(response_data, "not found")


class TestArticlesAuthenticationAndAuthorization:
    """Test authentication and authorization for articles endpoints."""

    def test_unauthenticated_access_denied(self, client: TestClient):
        """Test that unauthenticated access is denied."""
        endpoints = [
            ("GET", "/api/articles/"),
            ("GET", "/api/articles/1"),
            ("GET", "/api/articles/stats"),
            ("POST", "/api/articles/"),
            ("PUT", "/api/articles/1"),
            ("DELETE", "/api/articles/1"),
            ("POST", "/api/articles/bulk-delete")
        ]

        for method, endpoint in endpoints:
            response = getattr(client, method.lower())(
                endpoint,
                json={"test": "data"} if method in ["POST", "PUT"] else None
            )
            assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_shared_article_permissions_admin(self, admin_authenticated_client: TestClient):
        """Test admin can manage shared articles."""
        # Create shared article as admin
        shared_article_data = {
            "code": "SHARED_ADMIN",
            "name": "Общая статья админа",
            "is_active": True,
            "user_id": None
        }

        response = admin_authenticated_client.post("/api/articles/", json=shared_article_data)
        assert response.status_code == status.HTTP_200_OK
        shared_article = response.json()["data"]

        # Admin can update shared article
        update_data = {"name": "Обновлённая общая статья"}
        response = admin_authenticated_client.put(
            f"/api/articles/{shared_article['id']}",
            json=update_data
        )
        assert response.status_code == status.HTTP_200_OK

        # Admin can delete shared article
        response = admin_authenticated_client.delete(f"/api/articles/{shared_article['id']}")
        assert response.status_code == status.HTTP_200_OK

    def test_shared_article_permissions_regular_user(self, authenticated_client: TestClient, admin_authenticated_client: TestClient):
        """Test regular user cannot edit/delete shared articles."""
        # Create shared article as admin
        shared_article_data = {
            "code": "SHARED_READONLY",
            "name": "Общая статья только для чтения",
            "is_active": True,
            "user_id": None
        }

        response = admin_authenticated_client.post("/api/articles/", json=shared_article_data)
        assert response.status_code == status.HTTP_200_OK
        shared_article = response.json()["data"]

        # Regular user can read shared article
        response = authenticated_client.get(f"/api/articles/{shared_article['id']}")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()["data"]
        assert data["is_shared"] is True
        assert data["is_editable"] is False  # Not editable for regular user

        # Regular user cannot update shared article
        update_data = {"name": "Попытка обновления"}
        response = authenticated_client.put(
            f"/api/articles/{shared_article['id']}",
            json=update_data
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        validate_error_response(response.json(), "administrators can edit shared articles")

        # Regular user cannot delete shared article
        response = authenticated_client.delete(f"/api/articles/{shared_article['id']}")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        validate_error_response(response.json(), "administrators can delete shared articles")

    def test_user_isolation(self, authenticated_client: TestClient, second_authenticated_client: TestClient):
        """Test that users can only access their own personal articles."""
        # User 1 creates article
        article_data = {
            "code": "USER1_ONLY",
            "name": "Статья пользователя 1",
            "is_active": True
        }

        response = authenticated_client.post("/api/articles/", json=article_data)
        assert response.status_code == status.HTTP_200_OK
        user1_article = response.json()["data"]

        # User 2 cannot access user 1's article directly
        response = second_authenticated_client.get(f"/api/articles/{user1_article['id']}")
        assert response.status_code == status.HTTP_404_NOT_FOUND

        # User 2 cannot update user 1's article
        response = second_authenticated_client.put(
            f"/api/articles/{user1_article['id']}",
            json={"name": "Попытка изменения"}
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND

        # User 2 cannot delete user 1's article
        response = second_authenticated_client.delete(f"/api/articles/{user1_article['id']}")
        assert response.status_code == status.HTTP_404_NOT_FOUND

        # User 1's article should not appear in user 2's list
        response = second_authenticated_client.get("/api/articles/")
        assert response.status_code == status.HTTP_200_OK
        user2_articles = response.json()["data"]

        user1_article_ids = [a["id"] for a in user2_articles]
        assert user1_article["id"] not in user1_article_ids


class TestArticlesStatistics:
    """Test articles statistics endpoint."""

    def test_get_statistics_empty(self, authenticated_client: TestClient):
        """Test statistics with no articles."""
        response = authenticated_client.get("/api/articles/stats")
        assert response.status_code == status.HTTP_200_OK

        response_data = response.json()
        stats = validate_success_response(response_data, {
            "total": 0,
            "active": 0,
            "inactive": 0,
            "shared": 0,
            "user_specific": 0
        })

    def test_get_statistics_with_articles(self, authenticated_client: TestClient, admin_authenticated_client: TestClient):
        """Test statistics with various article types."""
        # Create user-specific articles
        authenticated_client.post("/api/articles/", json={
            "code": "USER_ACTIVE", "name": "Активная пользователя", "is_active": True
        })
        authenticated_client.post("/api/articles/", json={
            "code": "USER_INACTIVE", "name": "Неактивная пользователя", "is_active": False
        })

        # Create shared articles
        admin_authenticated_client.post("/api/articles/", json={
            "code": "SHARED_ACTIVE", "name": "Общая активная", "is_active": True, "user_id": None
        })
        admin_authenticated_client.post("/api/articles/", json={
            "code": "SHARED_INACTIVE", "name": "Общая неактивная", "is_active": False, "user_id": None
        })

        # Get statistics from user perspective
        response = authenticated_client.get("/api/articles/stats")
        assert response.status_code == status.HTTP_200_OK

        response_data = response.json()
        stats = validate_success_response(response_data, {
            "total": 4,  # 2 user + 2 shared
            "active": 2,  # 1 user active + 1 shared active
            "inactive": 2,  # 1 user inactive + 1 shared inactive
            "shared": 2,  # 2 shared articles
            "user_specific": 2  # 2 user articles
        })

    def test_statistics_user_isolation(self, authenticated_client: TestClient, second_authenticated_client: TestClient):
        """Test that statistics respect user isolation."""
        # User 1 creates articles
        authenticated_client.post("/api/articles/", json={
            "code": "USER1_ART1", "name": "Статья 1 пользователя 1", "is_active": True
        })
        authenticated_client.post("/api/articles/", json={
            "code": "USER1_ART2", "name": "Статья 2 пользователя 1", "is_active": False
        })

        # User 2 creates articles
        second_authenticated_client.post("/api/articles/", json={
            "code": "USER2_ART1", "name": "Статья 1 пользователя 2", "is_active": True
        })

        # User 1's statistics should only include their articles
        response = authenticated_client.get("/api/articles/stats")
        assert response.status_code == status.HTTP_200_OK
        user1_stats = response.json()["data"]

        # User 2's statistics should only include their articles
        response = second_authenticated_client.get("/api/articles/stats")
        assert response.status_code == status.HTTP_200_OK
        user2_stats = response.json()["data"]

        # Each user should only see their own articles (no shared articles in this test)
        assert user1_stats["user_specific"] == 2
        assert user1_stats["total"] == 2

        assert user2_stats["user_specific"] == 1
        assert user2_stats["total"] == 1


class TestArticlesBulkOperations:
    """Test bulk operations for articles."""

    def test_bulk_delete_success(self, authenticated_client: TestClient):
        """Test successful bulk deletion of articles."""
        # Create multiple articles
        article_ids = []
        for i in range(3):
            response = authenticated_client.post("/api/articles/", json={
                "code": f"BULK{i}",
                "name": f"Статья для массового удаления {i}",
                "is_active": True
            })
            article_ids.append(response.json()["data"]["id"])

        # Bulk delete articles
        response = authenticated_client.post("/api/articles/bulk-delete", json={
            "article_ids": article_ids
        })
        assert response.status_code == status.HTTP_200_OK

        response_data = response.json()
        data = validate_success_response(response_data)
        assert data["deleted_count"] == 3
        assert "Successfully deleted 3 articles" in data["message"]

        # Verify articles are deleted
        for article_id in article_ids:
            response = authenticated_client.get(f"/api/articles/{article_id}")
            assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_bulk_delete_empty_list(self, authenticated_client: TestClient):
        """Test bulk delete with empty article list."""
        response = authenticated_client.post("/api/articles/bulk-delete", json={
            "article_ids": []
        })
        assert response.status_code == status.HTTP_400_BAD_REQUEST

        response_data = response.json()
        validate_error_response(response_data, "No article IDs provided")

    def test_bulk_delete_nonexistent_articles(self, authenticated_client: TestClient):
        """Test bulk delete with non-existent article IDs."""
        response = authenticated_client.post("/api/articles/bulk-delete", json={
            "article_ids": [99999, 99998]
        })
        assert response.status_code == status.HTTP_404_NOT_FOUND

        response_data = response.json()
        validate_error_response(response_data, "No articles found")

    def test_bulk_delete_mixed_permissions(self, authenticated_client: TestClient, admin_authenticated_client: TestClient):
        """Test bulk delete with mixed ownership (should fail for unauthorized articles)."""
        # Create user article
        response = authenticated_client.post("/api/articles/", json={
            "code": "USER_ART", "name": "Пользовательская статья", "is_active": True
        })
        user_article_id = response.json()["data"]["id"]

        # Create shared article
        response = admin_authenticated_client.post("/api/articles/", json={
            "code": "SHARED_ART", "name": "Общая статья", "is_active": True, "user_id": None
        })
        shared_article_id = response.json()["data"]["id"]

        # Regular user tries to bulk delete both (should fail on shared article)
        response = authenticated_client.post("/api/articles/bulk-delete", json={
            "article_ids": [user_article_id, shared_article_id]
        })
        assert response.status_code == status.HTTP_400_BAD_REQUEST

        response_data = response.json()
        validate_error_response(response_data, "administrators can delete shared article")

    def test_bulk_delete_user_isolation(self, authenticated_client: TestClient, second_authenticated_client: TestClient):
        """Test bulk delete respects user isolation."""
        # User 1 creates article
        response = authenticated_client.post("/api/articles/", json={
            "code": "USER1_ART", "name": "Статья пользователя 1", "is_active": True
        })
        user1_article_id = response.json()["data"]["id"]

        # User 2 creates article
        response = second_authenticated_client.post("/api/articles/", json={
            "code": "USER2_ART", "name": "Статья пользователя 2", "is_active": True
        })
        user2_article_id = response.json()["data"]["id"]

        # User 1 tries to delete both articles (should fail on user 2's article)
        response = authenticated_client.post("/api/articles/bulk-delete", json={
            "article_ids": [user1_article_id, user2_article_id]
        })
        assert response.status_code == status.HTTP_400_BAD_REQUEST

        response_data = response.json()
        validate_error_response(response_data, "belongs to another user")


class TestArticlesErrorHandling:
    """Test error handling scenarios."""

    def test_server_error_simulation(self, authenticated_client: TestClient):
        """Test handling of server errors during operations."""
        # This test would require mocking database errors
        # For now, we test input validation errors

        # Test with invalid JSON
        response = authenticated_client.post(
            "/api/articles/",
            headers={"Content-Type": "application/json"},
            content="invalid json"
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_invalid_article_id_types(self, authenticated_client: TestClient):
        """Test endpoints with invalid article ID types."""
        invalid_ids = ["string", "null", "-1", "0"]

        for invalid_id in invalid_ids:
            # Test get article
            response = authenticated_client.get(f"/api/articles/{invalid_id}")
            assert response.status_code in [status.HTTP_404_NOT_FOUND, status.HTTP_422_UNPROCESSABLE_ENTITY]

            # Test update article
            response = authenticated_client.put(
                f"/api/articles/{invalid_id}",
                json={"name": "Test"}
            )
            assert response.status_code in [status.HTTP_404_NOT_FOUND, status.HTTP_422_UNPROCESSABLE_ENTITY]

            # Test delete article
            response = authenticated_client.delete(f"/api/articles/{invalid_id}")
            assert response.status_code in [status.HTTP_404_NOT_FOUND, status.HTTP_422_UNPROCESSABLE_ENTITY]

    def test_malformed_request_data(self, authenticated_client: TestClient):
        """Test handling of malformed request data."""
        malformed_requests = [
            {"code": "", "name": "Empty code"},  # Empty code
            {"code": "VALID", "name": ""},       # Empty name
            {"code": "A" * 256, "name": "Too long code"},  # Code too long
            {"code": "VALID", "name": "A" * 1000},  # Name too long
            {"code": 123, "name": "Invalid type"},  # Wrong type for code
            {"code": "VALID", "name": ["array", "instead", "of", "string"]},  # Wrong type for name
        ]

        for malformed_data in malformed_requests:
            response = authenticated_client.post("/api/articles/", json=malformed_data)
            assert response.status_code in [
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                status.HTTP_400_BAD_REQUEST
            ]

    def test_concurrent_operations(self, authenticated_client: TestClient):
        """Test handling of concurrent operations (simulate race conditions)."""
        # Create article
        article_data = {
            "code": "CONCURRENT",
            "name": "Статья для тестирования конкурентности",
            "is_active": True
        }

        response = authenticated_client.post("/api/articles/", json=article_data)
        assert response.status_code == status.HTTP_200_OK
        article = response.json()["data"]

        # Simulate concurrent updates
        update_data1 = {"name": "Обновление 1"}
        update_data2 = {"name": "Обновление 2"}

        response1 = authenticated_client.put(f"/api/articles/{article['id']}", json=update_data1)
        response2 = authenticated_client.put(f"/api/articles/{article['id']}", json=update_data2)

        # Both should succeed (last one wins)
        assert response1.status_code == status.HTTP_200_OK
        assert response2.status_code == status.HTTP_200_OK

        # Verify final state
        response = authenticated_client.get(f"/api/articles/{article['id']}")
        assert response.status_code == status.HTTP_200_OK
        final_article = response.json()["data"]
        assert final_article["name"] == "Обновление 2"