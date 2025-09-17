"""
Comprehensive tests for articles API endpoints.
Tests all CRUD operations with focus on authentication, authorization, and user data isolation.
Updated to test unified API response format: {"success": true/false, "data": ..., "error": ...}
All data is user-specific - no shared functionality.
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
        # All articles are user-specific, no shared functionality
        assert "user_id" in data
        assert data["user_id"] is not None

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

        # Check articles structure - all should be user-specific
        for article in articles:
            assert "id" in article
            assert "code" in article
            assert "name" in article
            assert "is_active" in article
            assert "is_editable" in article
            assert "user_id" in article
            assert article["user_id"] is not None
            assert article["is_editable"] is True

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

    def test_user_data_isolation(self, authenticated_client: TestClient, second_authenticated_client: TestClient):
        """Test that users can only access their own articles - strict data isolation."""
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

    def test_admin_user_data_isolation(self, admin_authenticated_client: TestClient, authenticated_client: TestClient):
        """Test that even admin users have isolated data."""
        # Admin creates article
        admin_article_data = {
            "code": "ADMIN_ARTICLE",
            "name": "Статья администратора",
            "is_active": True
        }

        response = admin_authenticated_client.post("/api/articles/", json=admin_article_data)
        assert response.status_code == status.HTTP_200_OK
        admin_article = response.json()["data"]

        # Regular user cannot see admin's article
        response = authenticated_client.get(f"/api/articles/{admin_article['id']}")
        assert response.status_code == status.HTTP_404_NOT_FOUND

        # Regular user's list should not include admin's article
        response = authenticated_client.get("/api/articles/")
        assert response.status_code == status.HTTP_200_OK
        user_articles = response.json()["data"]

        admin_article_ids = [a["id"] for a in user_articles]
        assert admin_article["id"] not in admin_article_ids


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
            "inactive": 0
        })

    def test_get_statistics_with_articles(self, authenticated_client: TestClient):
        """Test statistics with user-specific articles only."""
        # Create user-specific articles
        authenticated_client.post("/api/articles/", json={
            "code": "USER_ACTIVE1", "name": "Активная 1", "is_active": True
        })
        authenticated_client.post("/api/articles/", json={
            "code": "USER_ACTIVE2", "name": "Активная 2", "is_active": True
        })
        authenticated_client.post("/api/articles/", json={
            "code": "USER_INACTIVE", "name": "Неактивная", "is_active": False
        })

        # Get statistics from user perspective
        response = authenticated_client.get("/api/articles/stats")
        assert response.status_code == status.HTTP_200_OK

        response_data = response.json()
        stats = validate_success_response(response_data, {
            "total": 3,
            "active": 2,
            "inactive": 1
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

        # Each user should only see their own articles
        assert user1_stats["total"] == 2
        assert user1_stats["active"] == 1
        assert user1_stats["inactive"] == 1

        assert user2_stats["total"] == 1
        assert user2_stats["active"] == 1
        assert user2_stats["inactive"] == 0


class TestArticlesBulkOperations:
    """Test bulk operations for articles."""

    def test_bulk_delete_success(self, authenticated_client: TestClient):
        """Test successful bulk deletion of user's own articles."""
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


class TestArticlesUserIdEnforcement:
    """Test that user_id is always required and enforced for data isolation."""

    def test_create_article_user_id_set_automatically(self, authenticated_client: TestClient):
        """Test that user_id is automatically set when creating articles."""
        article_data = {
            "code": "AUTO_USER_ID",
            "name": "Автоматический user_id",
            "is_active": True
        }

        response = authenticated_client.post("/api/articles/", json=article_data)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()["data"]
        assert "user_id" in data
        assert data["user_id"] is not None
        assert isinstance(data["user_id"], int)

    def test_article_belongs_to_creating_user(self, authenticated_client: TestClient, second_authenticated_client: TestClient):
        """Test that created articles belong to the creating user."""
        # User 1 creates article
        response = authenticated_client.post("/api/articles/", json={
            "code": "USER1_ARTICLE", "name": "Статья user 1", "is_active": True
        })
        assert response.status_code == status.HTTP_200_OK
        user1_article = response.json()["data"]

        # User 2 creates article
        response = second_authenticated_client.post("/api/articles/", json={
            "code": "USER2_ARTICLE", "name": "Статья user 2", "is_active": True
        })
        assert response.status_code == status.HTTP_200_OK
        user2_article = response.json()["data"]

        # Articles should have different user_ids
        assert user1_article["user_id"] != user2_article["user_id"]

        # User 1 can only see their own article
        response = authenticated_client.get("/api/articles/")
        user1_articles = response.json()["data"]
        user1_article_ids = [a["id"] for a in user1_articles]
        assert user1_article["id"] in user1_article_ids
        assert user2_article["id"] not in user1_article_ids

        # User 2 can only see their own article
        response = second_authenticated_client.get("/api/articles/")
        user2_articles = response.json()["data"]
        user2_article_ids = [a["id"] for a in user2_articles]
        assert user2_article["id"] in user2_article_ids
        assert user1_article["id"] not in user2_article_ids

    def test_update_preserves_user_id(self, authenticated_client: TestClient):
        """Test that updating an article preserves the user_id."""
        # Create article
        response = authenticated_client.post("/api/articles/", json={
            "code": "PRESERVE_USER", "name": "Сохранить user_id", "is_active": True
        })
        original_article = response.json()["data"]
        original_user_id = original_article["user_id"]

        # Update article
        response = authenticated_client.put(f"/api/articles/{original_article['id']}", json={
            "name": "Обновленное название"
        })
        assert response.status_code == status.HTTP_200_OK

        updated_article = response.json()["data"]
        assert updated_article["user_id"] == original_user_id
        assert updated_article["name"] == "Обновленное название"

    def test_all_operations_require_user_authentication(self, client: TestClient):
        """Test that all article operations require user authentication."""
        test_data = {"code": "TEST", "name": "Test Article", "is_active": True}

        # All operations should fail without authentication
        assert client.get("/api/articles/").status_code == status.HTTP_401_UNAUTHORIZED
        assert client.get("/api/articles/1").status_code == status.HTTP_401_UNAUTHORIZED
        assert client.post("/api/articles/", json=test_data).status_code == status.HTTP_401_UNAUTHORIZED
        assert client.put("/api/articles/1", json=test_data).status_code == status.HTTP_401_UNAUTHORIZED
        assert client.delete("/api/articles/1").status_code == status.HTTP_401_UNAUTHORIZED
        assert client.get("/api/articles/stats").status_code == status.HTTP_401_UNAUTHORIZED
        assert client.post("/api/articles/bulk-delete", json={"article_ids": [1]}).status_code == status.HTTP_401_UNAUTHORIZED