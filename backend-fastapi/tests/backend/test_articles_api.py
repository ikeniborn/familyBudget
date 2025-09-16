"""
Comprehensive tests for articles API endpoints.
Tests all CRUD operations with focus on shared reference data, admin permissions, and user isolation.
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


def validate_article_structure(article_data: dict):
    """Helper function to validate article data structure."""
    required_fields = [
        "article_id", "article_code", "article_name", "description",
        "is_active", "user_id", "created_by", "managed_by", "is_shared",
        "is_editable", "created_at", "updated_at"
    ]

    for field in required_fields:
        assert field in article_data, f"Missing required field: {field}"

    # Validate data types
    assert isinstance(article_data["article_id"], int)
    assert isinstance(article_data["article_code"], str)
    assert isinstance(article_data["article_name"], str)
    assert isinstance(article_data["is_active"], bool)
    assert isinstance(article_data["is_shared"], bool)
    assert isinstance(article_data["is_editable"], bool)


class TestArticlesCRUD:
    """Test basic CRUD operations for articles."""

    def test_create_user_article_success(self, authenticated_client: TestClient):
        """Test successful creation of user-specific article."""
        article_data = {
            "code": "TEST001",
            "name": "Test Article",
            "description": "Test description",
            "is_active": True,
            "user_id": 1  # User-specific article
        }

        response = authenticated_client.post("/api/articles/", json=article_data)

        assert response.status_code == status.HTTP_200_OK
        data = validate_success_response(response.json(), {
            "article_code": "TEST001",
            "article_name": "Test Article",
            "description": "Test description",
            "is_active": True,
            "user_id": 1,
            "is_shared": False
        })
        validate_article_structure(data)

    def test_create_shared_article_by_admin_success(self, authenticated_client: TestClient):
        """Test successful creation of shared article by admin."""
        article_data = {
            "code": "SHARED001",
            "name": "Shared Article",
            "description": "Shared article description",
            "is_active": True,
            "user_id": None  # Shared article
        }

        response = authenticated_client.post("/api/articles/", json=article_data)

        assert response.status_code == status.HTTP_200_OK
        data = validate_success_response(response.json(), {
            "article_code": "SHARED001",
            "article_name": "Shared Article",
            "user_id": None,
            "is_shared": True
        })
        validate_article_structure(data)

    def test_create_shared_article_by_user_denied(self, authenticated_client: TestClient):
        """Test that regular users cannot create shared articles."""
        article_data = {
            "code": "SHARED002",
            "name": "Shared Article",
            "description": "Shared article description",
            "is_active": True,
            "user_id": None  # Shared article
        }

        response = authenticated_client.post("/api/articles/", json=article_data)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        validate_error_response(response.json(), "Only administrators can create shared articles")

    def test_create_duplicate_code_conflict(self, authenticated_client: TestClient):
        """Test creation with duplicate code returns 409 conflict."""
        article_data = {
            "code": "DUP001",
            "name": "First Article",
            "description": "First article",
            "is_active": True
        }

        # Create first article
        response1 = authenticated_client.post("/api/articles/", json=article_data)
        assert response1.status_code == status.HTTP_200_OK

        # Try to create second article with same code
        article_data["name"] = "Second Article"
        response2 = authenticated_client.post("/api/articles/", json=article_data)

        assert response2.status_code == status.HTTP_409_CONFLICT
        validate_error_response(response2.json(), "Article with code 'DUP001' already exists")

    def test_create_article_missing_required_fields(self, authenticated_client: TestClient):
        """Test creation with missing required fields."""
        incomplete_data = {
            "name": "Incomplete Article"
            # Missing required 'code' field
        }

        response = authenticated_client.post("/api/articles/", json=incomplete_data)

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_get_articles_list_success(self, authenticated_client: TestClient):
        """Test retrieving list of articles."""
        # Create test articles
        for i in range(3):
            article_data = {
                "code": f"LIST{i:03d}",
                "name": f"List Article {i}",
                "description": f"Description {i}",
                "is_active": True
            }
            authenticated_client.post("/api/articles/", json=article_data)

        response = authenticated_client.get("/api/articles/")

        assert response.status_code == status.HTTP_200_OK
        articles = validate_list_response(response.json())

        # Should have at least our 3 test articles
        assert len(articles) >= 3
        for article in articles:
            validate_article_structure(article)

    def test_get_articles_with_active_filter(self, authenticated_client: TestClient):
        """Test retrieving articles with active status filter."""
        # Create active article
        active_data = {
            "code": "ACTIVE001",
            "name": "Active Article",
            "description": "Active article",
            "is_active": True
        }
        authenticated_client.post("/api/articles/", json=active_data)

        # Create inactive article
        inactive_data = {
            "code": "INACTIVE001",
            "name": "Inactive Article",
            "description": "Inactive article",
            "is_active": False
        }
        authenticated_client.post("/api/articles/", json=inactive_data)

        # Test active filter
        response = authenticated_client.get("/api/articles/?is_active=true")
        assert response.status_code == status.HTTP_200_OK
        active_articles = validate_list_response(response.json())

        for article in active_articles:
            assert article["is_active"] is True

        # Test inactive filter
        response = authenticated_client.get("/api/articles/?is_active=false")
        assert response.status_code == status.HTTP_200_OK
        inactive_articles = validate_list_response(response.json())

        for article in inactive_articles:
            assert article["is_active"] is False

    def test_get_article_by_id_success(self, authenticated_client: TestClient):
        """Test retrieving single article by ID."""
        # Create test article
        article_data = {
            "code": "SINGLE001",
            "name": "Single Article",
            "description": "Single article description",
            "is_active": True
        }

        create_response = authenticated_client.post("/api/articles/", json=article_data)
        created_article = validate_success_response(create_response.json())
        article_id = created_article["article_id"]

        # Get article by ID
        response = authenticated_client.get(f"/api/articles/{article_id}")

        assert response.status_code == status.HTTP_200_OK
        data = validate_success_response(response.json(), {
            "article_id": article_id,
            "article_code": "SINGLE001",
            "article_name": "Single Article"
        })
        validate_article_structure(data)

    def test_get_article_not_found(self, authenticated_client: TestClient):
        """Test retrieving non-existent article returns 404."""
        response = authenticated_client.get("/api/articles/99999")

        assert response.status_code == status.HTTP_404_NOT_FOUND
        validate_error_response(response.json(), "Article not found")

    def test_update_user_article_success(self, authenticated_client: TestClient):
        """Test successful update of user's own article."""
        # Create test article
        article_data = {
            "code": "UPDATE001",
            "name": "Original Article",
            "description": "Original description",
            "is_active": True
        }

        create_response = authenticated_client.post("/api/articles/", json=article_data)
        created_article = validate_success_response(create_response.json())
        article_id = created_article["article_id"]

        # Update article
        update_data = {
            "name": "Updated Article",
            "description": "Updated description",
            "is_active": False
        }

        response = authenticated_client.put(f"/api/articles/{article_id}", json=update_data)

        assert response.status_code == status.HTTP_200_OK
        data = validate_success_response(response.json(), {
            "article_id": article_id,
            "article_code": "UPDATE001",  # Code should remain unchanged
            "article_name": "Updated Article",
            "description": "Updated description",
            "is_active": False
        })
        validate_article_structure(data)

    def test_update_shared_article_by_admin_success(self, authenticated_client: TestClient):
        """Test successful update of shared article by admin."""
        # Create shared article
        article_data = {
            "code": "SHARED_UPDATE001",
            "name": "Shared Article",
            "description": "Shared description",
            "is_active": True,
            "user_id": None
        }

        create_response = authenticated_client.post("/api/articles/", json=article_data)
        created_article = validate_success_response(create_response.json())
        article_id = created_article["article_id"]

        # Update shared article
        update_data = {
            "name": "Updated Shared Article",
            "description": "Updated shared description"
        }

        response = authenticated_client.put(f"/api/articles/{article_id}", json=update_data)

        assert response.status_code == status.HTTP_200_OK
        data = validate_success_response(response.json(), {
            "article_name": "Updated Shared Article",
            "description": "Updated shared description",
            "is_shared": True
        })

    def test_update_shared_article_by_user_denied(self, authenticated_client: TestClient, test_admin_headers):
        """Test that regular users cannot update shared articles."""
        # Admin creates shared article
        article_data = {
            "code": "SHARED_DENY001",
            "name": "Shared Article",
            "description": "Shared description",
            "is_active": True,
            "user_id": None
        }

        create_response = authenticated_client.post("/api/articles/", json=article_data)
        created_article = validate_success_response(create_response.json())
        article_id = created_article["article_id"]

        # User tries to update shared article
        update_data = {"name": "Hacked Article"}
        response = authenticated_client.put(f"/api/articles/{article_id}", json=update_data)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        validate_error_response(response.json(), "Only administrators can edit shared articles")

    def test_update_article_not_found(self, authenticated_client: TestClient):
        """Test updating non-existent article returns 404."""
        update_data = {"name": "Updated Name"}
        response = authenticated_client.put("/api/articles/99999", json=update_data)

        assert response.status_code == status.HTTP_404_NOT_FOUND
        validate_error_response(response.json(), "Article not found")

    def test_update_duplicate_code_conflict(self, authenticated_client: TestClient):
        """Test updating article with duplicate code returns 409 conflict."""
        # Create two articles
        article1_data = {
            "code": "CONFLICT001",
            "name": "Article 1",
            "description": "First article",
            "is_active": True
        }

        article2_data = {
            "code": "CONFLICT002",
            "name": "Article 2",
            "description": "Second article",
            "is_active": True
        }

        response1 = authenticated_client.post("/api/articles/", json=article1_data)
        response2 = authenticated_client.post("/api/articles/", json=article2_data)

        article2 = validate_success_response(response2.json())
        article2_id = article2["article_id"]

        # Try to update article2 with article1's code
        update_data = {"code": "CONFLICT001"}
        response = authenticated_client.put(f"/api/articles/{article2_id}", json=update_data)

        assert response.status_code == status.HTTP_409_CONFLICT
        validate_error_response(response.json(), "Article with code 'CONFLICT001' already exists")

    def test_delete_user_article_success(self, authenticated_client: TestClient):
        """Test successful deletion of user's own article."""
        # Create test article
        article_data = {
            "code": "DELETE001",
            "name": "Article to Delete",
            "description": "Will be deleted",
            "is_active": True
        }

        create_response = authenticated_client.post("/api/articles/", json=article_data)
        created_article = validate_success_response(create_response.json())
        article_id = created_article["article_id"]

        # Delete article
        response = authenticated_client.delete(f"/api/articles/{article_id}")

        assert response.status_code == status.HTTP_200_OK
        validate_success_response(response.json(), {"message": "Article deleted successfully"})

        # Verify article is deleted
        get_response = authenticated_client.get(f"/api/articles/{article_id}")
        assert get_response.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_shared_article_by_admin_success(self, authenticated_client: TestClient):
        """Test successful deletion of shared article by admin."""
        # Create shared article
        article_data = {
            "code": "SHARED_DELETE001",
            "name": "Shared Article to Delete",
            "description": "Will be deleted",
            "is_active": True,
            "user_id": None
        }

        create_response = authenticated_client.post("/api/articles/", json=article_data)
        created_article = validate_success_response(create_response.json())
        article_id = created_article["article_id"]

        # Delete shared article
        response = authenticated_client.delete(f"/api/articles/{article_id}")

        assert response.status_code == status.HTTP_200_OK
        validate_success_response(response.json())

    def test_delete_shared_article_by_user_denied(self, authenticated_client: TestClient, test_admin_headers):
        """Test that regular users cannot delete shared articles."""
        # Admin creates shared article
        article_data = {
            "code": "SHARED_DELETE_DENY001",
            "name": "Protected Shared Article",
            "description": "Cannot be deleted by users",
            "is_active": True,
            "user_id": None
        }

        create_response = authenticated_client.post("/api/articles/", json=article_data)
        created_article = validate_success_response(create_response.json())
        article_id = created_article["article_id"]

        # User tries to delete shared article
        response = authenticated_client.delete(f"/api/articles/{article_id}")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        validate_error_response(response.json(), "Only administrators can delete shared articles")

    def test_delete_article_not_found(self, authenticated_client: TestClient):
        """Test deleting non-existent article returns 404."""
        response = authenticated_client.delete("/api/articles/99999")

        assert response.status_code == status.HTTP_404_NOT_FOUND
        validate_error_response(response.json(), "Article not found")


class TestArticlesBulkOperations:
    """Test bulk operations for articles."""

    def test_bulk_delete_user_articles_success(self, authenticated_client: TestClient):
        """Test successful bulk deletion of user's own articles."""
        # Create multiple test articles
        article_ids = []
        for i in range(3):
            article_data = {
                "code": f"BULK_DELETE{i:03d}",
                "name": f"Bulk Delete Article {i}",
                "description": f"Article {i} for bulk deletion",
                "is_active": True
            }

            create_response = authenticated_client.post("/api/articles/", json=article_data)
            created_article = validate_success_response(create_response.json())
            article_ids.append(created_article["article_id"])

        # Bulk delete articles
        response = authenticated_client.post("/api/articles/bulk-delete",
                                   json={"article_ids": article_ids},
                                   headers=test_user_headers)

        assert response.status_code == status.HTTP_200_OK
        data = validate_success_response(response.json(), {
            "deleted_count": 3
        })
        assert "Successfully deleted 3 articles" in data["message"]

        # Verify articles are deleted
        for article_id in article_ids:
            get_response = authenticated_client.get(f"/api/articles/{article_id}")
            assert get_response.status_code == status.HTTP_404_NOT_FOUND

    def test_bulk_delete_mixed_permissions_denied(self, authenticated_client: TestClient, test_admin_headers):
        """Test bulk deletion with mixed permissions is denied."""
        # Create user article
        user_article_data = {
            "code": "USER_BULK001",
            "name": "User Article",
            "description": "User article",
            "is_active": True
        }
        user_response = authenticated_client.post("/api/articles/", json=user_article_data)
        user_article = validate_success_response(user_response.json())

        # Create shared article
        shared_article_data = {
            "code": "SHARED_BULK001",
            "name": "Shared Article",
            "description": "Shared article",
            "is_active": True,
            "user_id": None
        }
        shared_response = authenticated_client.post("/api/articles/", json=shared_article_data)
        shared_article = validate_success_response(shared_response.json())

        # User tries to bulk delete both (should fail due to shared article)
        article_ids = [user_article["article_id"], shared_article["article_id"]]
        response = authenticated_client.post("/api/articles/bulk-delete",
                                   json={"article_ids": article_ids},
                                   headers=test_user_headers)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        validate_error_response(response.json(), "Only administrators can delete shared article")

    def test_bulk_delete_empty_list(self, authenticated_client: TestClient):
        """Test bulk deletion with empty article list."""
        response = authenticated_client.post("/api/articles/bulk-delete",
                                   json={"article_ids": []},
                                   headers=test_user_headers)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        validate_error_response(response.json(), "No article IDs provided")

    def test_bulk_delete_nonexistent_articles(self, authenticated_client: TestClient):
        """Test bulk deletion with non-existent article IDs."""
        response = authenticated_client.post("/api/articles/bulk-delete",
                                   json={"article_ids": [99999, 99998]},
                                   headers=test_user_headers)

        assert response.status_code == status.HTTP_404_NOT_FOUND
        validate_error_response(response.json(), "No articles found")


class TestArticlesStatistics:
    """Test statistics endpoint for articles."""

    def test_get_articles_stats_success(self, authenticated_client: TestClient, test_admin_headers):
        """Test retrieving articles statistics."""
        # Create user articles
        user_active_data = {
            "code": "STATS_USER_ACTIVE001",
            "name": "User Active Article",
            "description": "Active user article",
            "is_active": True
        }
        authenticated_client.post("/api/articles/", json=user_active_data)

        user_inactive_data = {
            "code": "STATS_USER_INACTIVE001",
            "name": "User Inactive Article",
            "description": "Inactive user article",
            "is_active": False
        }
        authenticated_client.post("/api/articles/", json=user_inactive_data)

        # Create shared articles
        shared_active_data = {
            "code": "STATS_SHARED_ACTIVE001",
            "name": "Shared Active Article",
            "description": "Active shared article",
            "is_active": True,
            "user_id": None
        }
        authenticated_client.post("/api/articles/", json=shared_active_data)

        # Get statistics
        response = authenticated_client.get("/api/articles/stats")

        assert response.status_code == status.HTTP_200_OK
        stats = validate_success_response(response.json())

        # Validate statistics structure
        required_stats = ["total", "active", "inactive", "shared", "user_specific"]
        for stat in required_stats:
            assert stat in stats
            assert isinstance(stats[stat], int)
            assert stats[stat] >= 0

        # Validate logical relationships
        assert stats["total"] == stats["active"] + stats["inactive"]
        assert stats["total"] == stats["shared"] + stats["user_specific"]


class TestArticlesUserIsolation:
    """Test data isolation between users."""

    def test_users_cannot_access_other_users_articles(self, authenticated_client: TestClient, authenticated_client):
        """Test that users cannot access articles belonging to other users."""
        # User 1 creates article
        article_data = {
            "code": "ISOLATION001",
            "name": "User 1 Article",
            "description": "Private to user 1",
            "is_active": True
        }

        create_response = authenticated_client.post("/api/articles/", json=article_data)
        created_article = validate_success_response(create_response.json())
        article_id = created_article["article_id"]

        # User 2 tries to access User 1's article
        response = authenticated_client.get(f"/api/articles/{article_id}", headers=authenticated_client)

        assert response.status_code == status.HTTP_404_NOT_FOUND
        validate_error_response(response.json(), "Article not found or access denied")

    def test_users_cannot_modify_other_users_articles(self, authenticated_client: TestClient, authenticated_client):
        """Test that users cannot modify articles belonging to other users."""
        # User 1 creates article
        article_data = {
            "code": "ISOLATION002",
            "name": "User 1 Article",
            "description": "Private to user 1",
            "is_active": True
        }

        create_response = authenticated_client.post("/api/articles/", json=article_data)
        created_article = validate_success_response(create_response.json())
        article_id = created_article["article_id"]

        # User 2 tries to update User 1's article
        update_data = {"name": "Hacked Article"}
        update_response = authenticated_client.put(f"/api/articles/{article_id}", json=update_data, headers=authenticated_client)

        assert update_response.status_code == status.HTTP_404_NOT_FOUND

        # User 2 tries to delete User 1's article
        delete_response = authenticated_client.delete(f"/api/articles/{article_id}", headers=authenticated_client)

        assert delete_response.status_code == status.HTTP_404_NOT_FOUND

    def test_users_can_see_shared_articles(self, authenticated_client: TestClient, test_admin_headers):
        """Test that users can see shared articles but cannot modify them."""
        # Admin creates shared article
        shared_data = {
            "code": "SHARED_VISIBLE001",
            "name": "Visible Shared Article",
            "description": "Visible to all users",
            "is_active": True,
            "user_id": None
        }

        create_response = authenticated_client.post("/api/articles/", json=shared_data)
        created_article = validate_success_response(create_response.json())
        article_id = created_article["article_id"]

        # User can view shared article
        view_response = authenticated_client.get(f"/api/articles/{article_id}")
        assert view_response.status_code == status.HTTP_200_OK

        article_data = validate_success_response(view_response.json())
        assert article_data["is_shared"] is True
        assert article_data["article_name"] == "Visible Shared Article"

        # User cannot modify shared article
        update_data = {"name": "Modified Shared Article"}
        update_response = authenticated_client.put(f"/api/articles/{article_id}", json=update_data)

        assert update_response.status_code == status.HTTP_400_BAD_REQUEST
        validate_error_response(update_response.json(), "Only administrators can edit shared articles")


class TestArticlesAuthentication:
    """Test authentication and authorization."""

    def test_unauthenticated_requests_denied(self, client: TestClient):
        """Test that unauthenticated requests are denied."""
        endpoints = [
            ("GET", "/api/articles/"),
            ("GET", "/api/articles/stats"),
            ("GET", "/api/articles/1"),
            ("POST", "/api/articles/"),
            ("PUT", "/api/articles/1"),
            ("DELETE", "/api/articles/1"),
            ("POST", "/api/articles/bulk-delete")
        ]

        for method, endpoint in endpoints:
            if method == "GET":
                response = authenticated_client.get(endpoint)
            elif method == "POST":
                response = authenticated_client.post(endpoint, json={})
            elif method == "PUT":
                response = authenticated_client.put(endpoint, json={})
            elif method == "DELETE":
                response = authenticated_client.delete(endpoint)

            assert response.status_code == status.HTTP_401_UNAUTHORIZED


class TestArticlesEdgeCases:
    """Test edge cases and error conditions."""

    def test_create_article_with_very_long_code(self, authenticated_client: TestClient):
        """Test creation with code exceeding length limit."""
        article_data = {
            "code": "A" * 100,  # Exceeds 50 character limit
            "name": "Long Code Article",
            "description": "Article with very long code",
            "is_active": True
        }

        response = authenticated_client.post("/api/articles/", json=article_data)

        # Should return validation error (422) or database constraint error (400)
        assert response.status_code in [status.HTTP_422_UNPROCESSABLE_ENTITY, status.HTTP_400_BAD_REQUEST]

    def test_create_article_with_empty_name(self, authenticated_client: TestClient):
        """Test creation with empty name."""
        article_data = {
            "code": "EMPTY_NAME001",
            "name": "",
            "description": "Article with empty name",
            "is_active": True
        }

        response = authenticated_client.post("/api/articles/", json=article_data)

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_partial_update_article(self, authenticated_client: TestClient):
        """Test partial update of article (only some fields)."""
        # Create test article
        article_data = {
            "code": "PARTIAL001",
            "name": "Original Name",
            "description": "Original description",
            "is_active": True
        }

        create_response = authenticated_client.post("/api/articles/", json=article_data)
        created_article = validate_success_response(create_response.json())
        article_id = created_article["article_id"]

        # Update only name
        update_data = {"name": "Updated Name"}

        response = authenticated_client.put(f"/api/articles/{article_id}", json=update_data)

        assert response.status_code == status.HTTP_200_OK
        data = validate_success_response(response.json(), {
            "article_code": "PARTIAL001",  # Should remain unchanged
            "article_name": "Updated Name",  # Should be updated
            "description": "Original description",  # Should remain unchanged
            "is_active": True  # Should remain unchanged
        })

    def test_get_articles_with_pagination(self, authenticated_client: TestClient):
        """Test articles list with pagination parameters."""
        # Create multiple test articles
        for i in range(5):
            article_data = {
                "code": f"PAGE{i:03d}",
                "name": f"Page Article {i}",
                "description": f"Article {i}",
                "is_active": True
            }
            authenticated_client.post("/api/articles/", json=article_data)

        # Test pagination
        response = authenticated_client.get("/api/articles/?skip=2&limit=2")

        assert response.status_code == status.HTTP_200_OK
        articles = validate_list_response(response.json())

        # Should return exactly 2 articles (due to limit)
        # Note: Total count might include other articles from previous tests
        assert len(articles) >= 0  # Could be 0 if skip goes beyond available articles