"""
Integration tests for articles module.
Tests the complete flow from frontend service to backend API to ensure proper integration.
"""
import pytest
import asyncio
from httpx import AsyncClient
from fastapi.testclient import TestClient


class TestArticlesIntegration:
    """Test integration between frontend and backend for articles module."""

    def test_complete_articles_crud_flow(self, authenticated_client: TestClient):
        """Test complete CRUD flow for articles through API."""

        # 1. Get initial statistics
        stats_response = authenticated_client.get("/api/articles/stats")
        assert stats_response.status_code == 200
        initial_stats = stats_response.json()["data"]
        initial_total = initial_stats["total"]

        # 2. Create a new article
        create_data = {
            "code": "INTEGRATION_TEST",
            "name": "Интеграционный тест",
            "description": "Статья для интеграционного тестирования",
            "is_active": True
        }

        create_response = authenticated_client.post("/api/articles/", json=create_data)
        assert create_response.status_code == 200
        created_article = create_response.json()["data"]

        assert created_article["code"] == "INTEGRATION_TEST"
        assert created_article["name"] == "Интеграционный тест"
        assert created_article["is_active"] is True
        assert created_article["is_editable"] is True
        assert created_article["is_shared"] is False
        article_id = created_article["id"]

        # 3. Verify article appears in list
        list_response = authenticated_client.get("/api/articles/")
        assert list_response.status_code == 200
        articles = list_response.json()["data"]

        created_article_in_list = next((a for a in articles if a["id"] == article_id), None)
        assert created_article_in_list is not None
        assert created_article_in_list["code"] == "INTEGRATION_TEST"

        # 4. Verify statistics updated
        stats_response = authenticated_client.get("/api/articles/stats")
        assert stats_response.status_code == 200
        updated_stats = stats_response.json()["data"]

        assert updated_stats["total"] == initial_total + 1
        assert updated_stats["active"] == initial_stats["active"] + 1
        assert updated_stats["user_specific"] == initial_stats["user_specific"] + 1

        # 5. Get article by ID
        get_response = authenticated_client.get(f"/api/articles/{article_id}")
        assert get_response.status_code == 200
        retrieved_article = get_response.json()["data"]

        assert retrieved_article["id"] == article_id
        assert retrieved_article["code"] == "INTEGRATION_TEST"
        assert retrieved_article["name"] == "Интеграционный тест"

        # 6. Update the article
        update_data = {
            "name": "Обновлённый интеграционный тест",
            "description": "Обновлённое описание",
            "is_active": False
        }

        update_response = authenticated_client.put(f"/api/articles/{article_id}", json=update_data)
        assert update_response.status_code == 200
        updated_article = update_response.json()["data"]

        assert updated_article["name"] == "Обновлённый интеграционный тест"
        assert updated_article["description"] == "Обновлённое описание"
        assert updated_article["is_active"] is False
        assert updated_article["code"] == "INTEGRATION_TEST"  # Should remain unchanged

        # 7. Verify update reflected in list and stats
        list_response = authenticated_client.get("/api/articles/")
        updated_article_in_list = next((a for a in list_response.json()["data"] if a["id"] == article_id), None)
        assert updated_article_in_list["name"] == "Обновлённый интеграционный тест"
        assert updated_article_in_list["is_active"] is False

        stats_response = authenticated_client.get("/api/articles/stats")
        final_stats = stats_response.json()["data"]
        assert final_stats["active"] == initial_stats["active"]  # Back to original since we made it inactive
        assert final_stats["inactive"] == initial_stats["inactive"] + 1

        # 8. Delete the article
        delete_response = authenticated_client.delete(f"/api/articles/{article_id}")
        assert delete_response.status_code == 200
        delete_result = delete_response.json()["data"]
        assert "deleted successfully" in delete_result["message"]

        # 9. Verify article is gone
        get_response = authenticated_client.get(f"/api/articles/{article_id}")
        assert get_response.status_code == 404

        list_response = authenticated_client.get("/api/articles/")
        articles_after_delete = list_response.json()["data"]
        deleted_article_in_list = next((a for a in articles_after_delete if a["id"] == article_id), None)
        assert deleted_article_in_list is None

        # 10. Verify statistics back to original
        stats_response = authenticated_client.get("/api/articles/stats")
        final_stats = stats_response.json()["data"]
        assert final_stats["total"] == initial_total
        assert final_stats["active"] == initial_stats["active"]
        assert final_stats["inactive"] == initial_stats["inactive"]
        assert final_stats["user_specific"] == initial_stats["user_specific"]

    def test_shared_articles_admin_flow(self, admin_authenticated_client: TestClient, authenticated_client: TestClient):
        """Test shared articles creation and access by admin and regular user."""

        # 1. Admin creates shared article
        shared_article_data = {
            "code": "SHARED_INTEGRATION",
            "name": "Общая статья интеграционный тест",
            "description": "Общая статья для тестирования",
            "is_active": True,
            "user_id": None  # Shared article
        }

        create_response = admin_authenticated_client.post("/api/articles/", json=shared_article_data)
        assert create_response.status_code == 200
        shared_article = create_response.json()["data"]

        assert shared_article["is_shared"] is True
        assert shared_article["is_editable"] is True  # Admin can edit shared articles
        shared_article_id = shared_article["id"]

        # 2. Regular user can see shared article
        user_list_response = authenticated_client.get("/api/articles/")
        assert user_list_response.status_code == 200
        user_articles = user_list_response.json()["data"]

        shared_in_user_list = next((a for a in user_articles if a["id"] == shared_article_id), None)
        assert shared_in_user_list is not None
        assert shared_in_user_list["is_shared"] is True
        assert shared_in_user_list["is_editable"] is False  # Regular user cannot edit shared articles

        # 3. Regular user can get shared article by ID
        user_get_response = authenticated_client.get(f"/api/articles/{shared_article_id}")
        assert user_get_response.status_code == 200
        user_retrieved_article = user_get_response.json()["data"]
        assert user_retrieved_article["is_shared"] is True
        assert user_retrieved_article["is_editable"] is False

        # 4. Regular user cannot update shared article
        user_update_response = authenticated_client.put(
            f"/api/articles/{shared_article_id}",
            json={"name": "Попытка изменения"}
        )
        assert user_update_response.status_code == 400
        assert "administrators can edit shared articles" in user_update_response.json()["error"]

        # 5. Regular user cannot delete shared article
        user_delete_response = authenticated_client.delete(f"/api/articles/{shared_article_id}")
        assert user_delete_response.status_code == 400
        assert "administrators can delete shared articles" in user_delete_response.json()["error"]

        # 6. Admin can update shared article
        admin_update_response = admin_authenticated_client.put(
            f"/api/articles/{shared_article_id}",
            json={"name": "Обновлённая общая статья"}
        )
        assert admin_update_response.status_code == 200
        updated_shared = admin_update_response.json()["data"]
        assert updated_shared["name"] == "Обновлённая общая статья"

        # 7. Regular user sees the update
        user_updated_get = authenticated_client.get(f"/api/articles/{shared_article_id}")
        assert user_updated_get.status_code == 200
        assert user_updated_get.json()["data"]["name"] == "Обновлённая общая статья"

        # 8. Admin deletes shared article
        admin_delete_response = admin_authenticated_client.delete(f"/api/articles/{shared_article_id}")
        assert admin_delete_response.status_code == 200

        # 9. Article is gone for both admin and user
        admin_get_response = admin_authenticated_client.get(f"/api/articles/{shared_article_id}")
        assert admin_get_response.status_code == 404

        user_get_response = authenticated_client.get(f"/api/articles/{shared_article_id}")
        assert user_get_response.status_code == 404

    def test_user_isolation_flow(self, authenticated_client: TestClient, second_authenticated_client: TestClient):
        """Test that user isolation works properly in integration."""

        # 1. User 1 creates article
        user1_article_data = {
            "code": "USER1_ISOLATION",
            "name": "Статья пользователя 1",
            "is_active": True
        }

        create_response = authenticated_client.post("/api/articles/", json=user1_article_data)
        assert create_response.status_code == 200
        user1_article = create_response.json()["data"]
        user1_article_id = user1_article["id"]

        # 2. User 2 creates article with same code (should work due to user isolation)
        user2_article_data = {
            "code": "USER1_ISOLATION",  # Same code as user 1
            "name": "Статья пользователя 2",
            "is_active": True
        }

        create_response2 = second_authenticated_client.post("/api/articles/", json=user2_article_data)
        assert create_response2.status_code == 200
        user2_article = create_response2.json()["data"]
        user2_article_id = user2_article["id"]

        # 3. Each user sees only their own article
        user1_list = authenticated_client.get("/api/articles/").json()["data"]
        user2_list = second_authenticated_client.get("/api/articles/").json()["data"]

        user1_article_ids = [a["id"] for a in user1_list]
        user2_article_ids = [a["id"] for a in user2_list]

        assert user1_article_id in user1_article_ids
        assert user1_article_id not in user2_article_ids
        assert user2_article_id in user2_article_ids
        assert user2_article_id not in user1_article_ids

        # 4. Each user cannot access the other's article
        user2_get_user1_article = second_authenticated_client.get(f"/api/articles/{user1_article_id}")
        assert user2_get_user1_article.status_code == 404

        user1_get_user2_article = authenticated_client.get(f"/api/articles/{user2_article_id}")
        assert user1_get_user2_article.status_code == 404

        # 5. Statistics are isolated
        user1_stats = authenticated_client.get("/api/articles/stats").json()["data"]
        user2_stats = second_authenticated_client.get("/api/articles/stats").json()["data"]

        # Each user should have 1 user-specific article (assuming no shared articles)
        assert user1_stats["user_specific"] >= 1
        assert user2_stats["user_specific"] >= 1

        # 6. Cleanup
        authenticated_client.delete(f"/api/articles/{user1_article_id}")
        second_authenticated_client.delete(f"/api/articles/{user2_article_id}")

    def test_bulk_operations_flow(self, authenticated_client: TestClient):
        """Test bulk operations integration."""

        # 1. Create multiple articles
        article_ids = []
        for i in range(3):
            article_data = {
                "code": f"BULK_TEST_{i}",
                "name": f"Статья для массового удаления {i}",
                "is_active": True
            }

            response = authenticated_client.post("/api/articles/", json=article_data)
            assert response.status_code == 200
            article_ids.append(response.json()["data"]["id"])

        # 2. Verify articles exist
        for article_id in article_ids:
            response = authenticated_client.get(f"/api/articles/{article_id}")
            assert response.status_code == 200

        # 3. Bulk delete articles
        bulk_delete_response = authenticated_client.post("/api/articles/bulk-delete", json={
            "article_ids": article_ids
        })
        assert bulk_delete_response.status_code == 200

        bulk_result = bulk_delete_response.json()["data"]
        assert bulk_result["deleted_count"] == 3
        assert "Successfully deleted 3 articles" in bulk_result["message"]

        # 4. Verify articles are gone
        for article_id in article_ids:
            response = authenticated_client.get(f"/api/articles/{article_id}")
            assert response.status_code == 404

    def test_error_handling_flow(self, authenticated_client: TestClient):
        """Test error handling in integration scenarios."""

        # 1. Create article
        article_data = {
            "code": "ERROR_TEST",
            "name": "Тест ошибок",
            "is_active": True
        }

        response = authenticated_client.post("/api/articles/", json=article_data)
        assert response.status_code == 200

        # 2. Try to create duplicate
        duplicate_response = authenticated_client.post("/api/articles/", json=article_data)
        assert duplicate_response.status_code == 409
        assert "already exists" in duplicate_response.json()["error"]

        # 3. Try to access non-existent article
        response = authenticated_client.get("/api/articles/99999")
        assert response.status_code == 404

        # 4. Try to update non-existent article
        response = authenticated_client.put("/api/articles/99999", json={"name": "Test"})
        assert response.status_code == 404

        # 5. Try to delete non-existent article
        response = authenticated_client.delete("/api/articles/99999")
        assert response.status_code == 404

        # 6. Cleanup - delete the test article
        list_response = authenticated_client.get("/api/articles/")
        test_article = next((a for a in list_response.json()["data"] if a["code"] == "ERROR_TEST"), None)
        if test_article:
            authenticated_client.delete(f"/api/articles/{test_article['id']}")

    def test_filtering_and_pagination_flow(self, authenticated_client: TestClient):
        """Test filtering and pagination in integration."""

        # 1. Create test articles with different states
        test_articles = [
            {"code": "FILTER_ACTIVE", "name": "Активная для фильтра", "is_active": True},
            {"code": "FILTER_INACTIVE", "name": "Неактивная для фильтра", "is_active": False},
        ]

        created_ids = []
        for article_data in test_articles:
            response = authenticated_client.post("/api/articles/", json=article_data)
            assert response.status_code == 200
            created_ids.append(response.json()["data"]["id"])

        # 2. Test filtering by active status
        active_response = authenticated_client.get("/api/articles/?is_active=true")
        assert active_response.status_code == 200
        active_articles = active_response.json()["data"]

        # Should contain our active test article
        active_codes = [a["code"] for a in active_articles]
        assert "FILTER_ACTIVE" in active_codes
        assert "FILTER_INACTIVE" not in active_codes

        # 3. Test filtering by inactive status
        inactive_response = authenticated_client.get("/api/articles/?is_active=false")
        assert inactive_response.status_code == 200
        inactive_articles = inactive_response.json()["data"]

        # Should contain our inactive test article
        inactive_codes = [a["code"] for a in inactive_articles]
        assert "FILTER_INACTIVE" in inactive_codes
        assert "FILTER_ACTIVE" not in inactive_codes

        # 4. Test pagination
        paginated_response = authenticated_client.get("/api/articles/?skip=0&limit=1")
        assert paginated_response.status_code == 200
        paginated_articles = paginated_response.json()["data"]
        assert len(paginated_articles) <= 1

        # 5. Cleanup
        for article_id in created_ids:
            authenticated_client.delete(f"/api/articles/{article_id}")

    def test_regular_user_cannot_create_shared_articles(self, authenticated_client: TestClient):
        """Test that regular users cannot create shared articles."""

        shared_article_data = {
            "code": "FORBIDDEN_SHARED",
            "name": "Запрещённая общая статья",
            "is_active": True,
            "user_id": None  # Shared article
        }

        response = authenticated_client.post("/api/articles/", json=shared_article_data)
        assert response.status_code == 400
        assert "Only administrators can create shared articles" in response.json()["error"]