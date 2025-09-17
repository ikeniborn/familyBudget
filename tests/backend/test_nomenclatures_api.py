"""
Comprehensive tests for nomenclatures API endpoints.
Tests CRUD operations, duplicate handling, and user isolation.
"""
import pytest
from fastapi import status
from fastapi.testclient import TestClient
from httpx import AsyncClient


class TestNomenclaturesCRUDOperations:
    """Test basic CRUD operations for nomenclatures."""

    def test_create_nomenclature_success(self, authenticated_client: TestClient):
        """Test successful nomenclature creation."""
        nomenclature_data = {
            "name": "Продукты питания",
            "account_name": "Счет продуктов",
            "bill_name": "Покупка еды",
            "operation": "Расход",
            "is_budget": True,
            "is_fact": True,
            "is_active": True
        }

        response = authenticated_client.post("/api/nomenclatures/", json=nomenclature_data)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert data["name"] == nomenclature_data["name"]
        assert data["account_name"] == nomenclature_data["account_name"]
        assert data["is_budget"] is True
        assert data["is_fact"] is True
        assert data["is_active"] is True
        assert "id" in data
        assert "user_id" in data

    def test_create_nomenclature_with_article_id(self, authenticated_client: TestClient):
        """Test creating nomenclature with article_id reference."""
        # First create an article
        article_data = {
            "code": "ART001",
            "name": "Test Article",
            "description": "Test article for nomenclature",
            "is_active": True
        }
        article_response = authenticated_client.post("/api/articles/", json=article_data)
        assert article_response.status_code == status.HTTP_200_OK
        article_id = article_response.json()["article_id"]

        # Create nomenclature with article reference
        nomenclature_data = {
            "name": "Продукты с статьей",
            "account_name": "Счет продуктов",
            "is_budget": True,
            "is_fact": True,
            "article_id": article_id
        }

        response = authenticated_client.post("/api/nomenclatures/", json=nomenclature_data)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert data["name"] == nomenclature_data["name"]
        assert data["article_id"] == article_id
        assert "id" in data

    def test_create_nomenclature_with_invalid_article_id(self, authenticated_client: TestClient):
        """Test creating nomenclature with non-existent article_id."""
        nomenclature_data = {
            "name": "Продукты с несуществующей статьей",
            "account_name": "Счет продуктов",
            "is_budget": True,
            "is_fact": True,
            "article_id": 99999  # Non-existent article
        }

        response = authenticated_client.post("/api/nomenclatures/", json=nomenclature_data)
        # Should return validation error due to foreign key constraint
        assert response.status_code in [status.HTTP_400_BAD_REQUEST, status.HTTP_422_UNPROCESSABLE_ENTITY]

    def test_create_nomenclature_minimal_data(self, authenticated_client: TestClient):
        """Test creating nomenclature with minimal required data."""
        nomenclature_data = {
            "name": "Минимальная номенклатура"
        }

        response = authenticated_client.post("/api/nomenclatures/", json=nomenclature_data)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert data["name"] == nomenclature_data["name"]
        assert "id" in data

    def test_create_nomenclature_missing_name(self, authenticated_client: TestClient):
        """Test creating nomenclature without required name field."""
        nomenclature_data = {
            "account_name": "Test account",
            "is_budget": True
        }

        response = authenticated_client.post("/api/nomenclatures/", json=nomenclature_data)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestNomenclaturesDuplicateHandling:
    """Test duplicate nomenclature handling and error responses."""

    def test_create_duplicate_nomenclature_400_error(self, authenticated_client: TestClient):
        """Test creating duplicate nomenclature returns 400 Bad Request."""
        nomenclature_data = {
            "name": "Дублирующаяся номенклатура",
            "account_name": "Тестовый счет",
            "is_budget": True,
            "is_fact": False
        }

        # Create first nomenclature
        response1 = authenticated_client.post("/api/nomenclatures/", json=nomenclature_data)
        assert response1.status_code == status.HTTP_200_OK

        # Try to create duplicate
        response2 = authenticated_client.post("/api/nomenclatures/", json=nomenclature_data)
        assert response2.status_code == status.HTTP_400_BAD_REQUEST

        # Check error message
        error_data = response2.json()
        assert "уже существует" in error_data["detail"]
        assert nomenclature_data["name"] in error_data["detail"]

    def test_duplicate_nomenclature_case_sensitive(self, authenticated_client: TestClient):
        """Test that nomenclature names are case sensitive."""
        # Create nomenclature with lowercase
        nomenclature1_data = {
            "name": "транспорт",
            "is_budget": True
        }
        response1 = authenticated_client.post("/api/nomenclatures/", json=nomenclature1_data)
        assert response1.status_code == status.HTTP_200_OK

        # Create nomenclature with uppercase - should succeed
        nomenclature2_data = {
            "name": "ТРАНСПОРТ",
            "is_budget": True
        }
        response2 = authenticated_client.post("/api/nomenclatures/", json=nomenclature2_data)
        assert response2.status_code == status.HTTP_200_OK

        # Different cases should be treated as different names
        assert response1.json()["id"] != response2.json()["id"]

    def test_duplicate_nomenclature_integrity_error(self, authenticated_client: TestClient):
        """Test handling of database integrity errors on duplicates."""
        nomenclature_data = {
            "name": "Интегральная проверка",
            "account_name": "Тест интеграции",
            "is_budget": True
        }

        # Create first nomenclature
        response1 = authenticated_client.post("/api/nomenclatures/", json=nomenclature_data)
        assert response1.status_code == status.HTTP_200_OK

        # Concurrent creation attempt should trigger integrity error handling
        response2 = authenticated_client.post("/api/nomenclatures/", json=nomenclature_data)
        assert response2.status_code == status.HTTP_400_BAD_REQUEST

        error_data = response2.json()
        assert "уже существует" in error_data["detail"]


class TestNomenclaturesReadOperations:
    """Test reading and retrieving nomenclatures."""

    def test_get_all_nomenclatures(self, authenticated_client: TestClient):
        """Test retrieving all nomenclatures for user."""
        # Create multiple nomenclatures
        nomenclatures_data = [
            {"name": "Еда", "is_budget": True, "is_fact": True},
            {"name": "Транспорт", "is_budget": True, "is_fact": False},
            {"name": "Развлечения", "is_budget": False, "is_fact": True}
        ]

        created_ids = []
        for nomenclature_data in nomenclatures_data:
            response = authenticated_client.post("/api/nomenclatures/", json=nomenclature_data)
            assert response.status_code == status.HTTP_200_OK
            created_ids.append(response.json()["id"])

        # Get all nomenclatures
        response = authenticated_client.get("/api/nomenclatures/")
        assert response.status_code == status.HTTP_200_OK

        nomenclatures = response.json()
        assert len(nomenclatures) == 3

        # Check they are ordered by name
        names = [n["name"] for n in nomenclatures]
        assert names == sorted(names)

    def test_get_nomenclatures_with_filters(self, authenticated_client: TestClient):
        """Test retrieving nomenclatures with budget/fact filters."""
        # Create nomenclatures with different flags
        nomenclatures_data = [
            {"name": "Только бюджет", "is_budget": True, "is_fact": False},
            {"name": "Только факт", "is_budget": False, "is_fact": True},
            {"name": "Бюджет и факт", "is_budget": True, "is_fact": True},
            {"name": "Ни бюджет ни факт", "is_budget": False, "is_fact": False}
        ]

        for nomenclature_data in nomenclatures_data:
            response = authenticated_client.post("/api/nomenclatures/", json=nomenclature_data)
            assert response.status_code == status.HTTP_200_OK

        # Filter by is_budget=True
        response = authenticated_client.get("/api/nomenclatures/?is_budget=true")
        assert response.status_code == status.HTTP_200_OK
        budget_nomenclatures = response.json()
        assert len(budget_nomenclatures) == 2
        for nom in budget_nomenclatures:
            assert nom["is_budget"] is True

        # Filter by is_fact=True
        response = authenticated_client.get("/api/nomenclatures/?is_fact=true")
        assert response.status_code == status.HTTP_200_OK
        fact_nomenclatures = response.json()
        assert len(fact_nomenclatures) == 2
        for nom in fact_nomenclatures:
            assert nom["is_fact"] is True

        # Filter by both
        response = authenticated_client.get("/api/nomenclatures/?is_budget=true&is_fact=true")
        assert response.status_code == status.HTTP_200_OK
        both_nomenclatures = response.json()
        assert len(both_nomenclatures) == 1
        assert both_nomenclatures[0]["name"] == "Бюджет и факт"

    def test_get_nomenclature_by_id(self, authenticated_client: TestClient):
        """Test retrieving specific nomenclature by ID."""
        nomenclature_data = {
            "name": "Коммунальные услуги",
            "account_name": "ЖКХ счет",
            "bill_name": "Оплата ЖКХ",
            "is_budget": True,
            "is_fact": True
        }

        # Create nomenclature
        create_response = authenticated_client.post("/api/nomenclatures/", json=nomenclature_data)
        assert create_response.status_code == status.HTTP_200_OK
        nomenclature_id = create_response.json()["id"]

        # Get by ID
        get_response = authenticated_client.get(f"/api/nomenclatures/{nomenclature_id}")
        assert get_response.status_code == status.HTTP_200_OK

        data = get_response.json()
        assert data["id"] == nomenclature_id
        assert data["name"] == nomenclature_data["name"]
        assert data["account_name"] == nomenclature_data["account_name"]

    def test_get_nonexistent_nomenclature(self, authenticated_client: TestClient):
        """Test retrieving non-existent nomenclature returns 404."""
        response = authenticated_client.get("/api/nomenclatures/99999")
        assert response.status_code == status.HTTP_404_NOT_FOUND

        error_data = response.json()
        assert "not found" in error_data["detail"].lower()


class TestNomenclaturesUpdateOperations:
    """Test nomenclature update operations."""

    def test_update_nomenclature_success(self, authenticated_client: TestClient):
        """Test successful nomenclature update."""
        # Create nomenclature
        nomenclature_data = {
            "name": "Обновляемая номенклатура",
            "account_name": "Старый счет",
            "is_budget": True,
            "is_fact": False
        }
        create_response = authenticated_client.post("/api/nomenclatures/", json=nomenclature_data)
        assert create_response.status_code == status.HTTP_200_OK
        nomenclature_id = create_response.json()["id"]

        # Update nomenclature
        update_data = {
            "name": "Обновленная номенклатура",
            "account_name": "Новый счет",
            "is_fact": True
        }
        response = authenticated_client.put(f"/api/nomenclatures/{nomenclature_id}", json=update_data)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert data["name"] == update_data["name"]
        assert data["account_name"] == update_data["account_name"]
        assert data["is_budget"] is True  # Should remain unchanged
        assert data["is_fact"] is True   # Should be updated

    def test_update_nomenclature_duplicate_name(self, authenticated_client: TestClient):
        """Test updating nomenclature to existing name fails."""
        # Create two nomenclatures
        nomenclature1_data = {"name": "Первая номенклатура"}
        nomenclature2_data = {"name": "Вторая номенклатура"}

        response1 = authenticated_client.post("/api/nomenclatures/", json=nomenclature1_data)
        response2 = authenticated_client.post("/api/nomenclatures/", json=nomenclature2_data)

        assert response1.status_code == status.HTTP_200_OK
        assert response2.status_code == status.HTTP_200_OK

        nomenclature2_id = response2.json()["id"]

        # Try to update second nomenclature to have same name as first
        update_data = {"name": "Первая номенклатура"}
        response = authenticated_client.put(f"/api/nomenclatures/{nomenclature2_id}", json=update_data)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

        error_data = response.json()
        assert "уже существует" in error_data["detail"]

    def test_update_nonexistent_nomenclature(self, authenticated_client: TestClient):
        """Test updating non-existent nomenclature returns 404."""
        update_data = {"name": "Обновленное название"}

        response = authenticated_client.put("/api/nomenclatures/99999", json=update_data)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_update_nomenclature_partial(self, authenticated_client: TestClient):
        """Test partial update of nomenclature fields."""
        # Create nomenclature
        nomenclature_data = {
            "name": "Частичное обновление",
            "account_name": "Исходный счет",
            "bill_name": "Исходный счет-фактура",
            "is_budget": True,
            "is_fact": False
        }
        create_response = authenticated_client.post("/api/nomenclatures/", json=nomenclature_data)
        nomenclature_id = create_response.json()["id"]

        # Update only is_fact field
        update_data = {"is_fact": True}
        response = authenticated_client.put(f"/api/nomenclatures/{nomenclature_id}", json=update_data)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        # Updated field
        assert data["is_fact"] is True
        # Unchanged fields
        assert data["name"] == nomenclature_data["name"]
        assert data["account_name"] == nomenclature_data["account_name"]
        assert data["is_budget"] is True


class TestNomenclaturesDeleteOperations:
    """Test nomenclature deletion operations."""

    def test_delete_nomenclature_success(self, authenticated_client: TestClient):
        """Test successful nomenclature deletion."""
        # Create nomenclature
        nomenclature_data = {
            "name": "Удаляемая номенклатура",
            "is_budget": True
        }
        create_response = authenticated_client.post("/api/nomenclatures/", json=nomenclature_data)
        assert create_response.status_code == status.HTTP_200_OK
        nomenclature_id = create_response.json()["id"]

        # Delete nomenclature
        delete_response = authenticated_client.delete(f"/api/nomenclatures/{nomenclature_id}")
        assert delete_response.status_code == status.HTTP_200_OK

        delete_data = delete_response.json()
        assert "deleted successfully" in delete_data["message"]

        # Verify deletion
        get_response = authenticated_client.get(f"/api/nomenclatures/{nomenclature_id}")
        assert get_response.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_nonexistent_nomenclature(self, authenticated_client: TestClient):
        """Test deleting non-existent nomenclature returns 404."""
        response = authenticated_client.delete("/api/nomenclatures/99999")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_bulk_delete_nomenclatures_success(self, authenticated_client: TestClient):
        """Test successful bulk deletion of nomenclatures."""
        # Create multiple nomenclatures
        nomenclatures_data = [
            {"name": "Удаляемая 1", "is_budget": True},
            {"name": "Удаляемая 2", "is_budget": True},
            {"name": "Удаляемая 3", "is_budget": True}
        ]

        created_ids = []
        for nomenclature_data in nomenclatures_data:
            response = authenticated_client.post("/api/nomenclatures/", json=nomenclature_data)
            assert response.status_code == status.HTTP_200_OK
            created_ids.append(response.json()["id"])

        # Bulk delete
        response = authenticated_client.post("/api/nomenclatures/bulk-delete", json=created_ids)
        assert response.status_code == status.HTTP_200_OK

        delete_data = response.json()
        assert "Deleted 3 nomenclatures" in delete_data["message"]

        # Verify all are deleted
        for nomenclature_id in created_ids:
            get_response = authenticated_client.get(f"/api/nomenclatures/{nomenclature_id}")
            assert get_response.status_code == status.HTTP_404_NOT_FOUND

    def test_bulk_delete_nonexistent_nomenclatures(self, authenticated_client: TestClient):
        """Test bulk deletion of non-existent nomenclatures."""
        fake_ids = [99997, 99998, 99999]

        response = authenticated_client.post("/api/nomenclatures/bulk-delete", json=fake_ids)
        assert response.status_code == status.HTTP_404_NOT_FOUND

        error_data = response.json()
        assert "not found" in error_data["detail"].lower()


class TestNomenclaturesUserIsolation:
    """Test data isolation between users."""

    def test_nomenclatures_isolated_between_users(self, client: TestClient):
        """Test that users cannot see each other's nomenclatures."""
        # Create two users
        user1_data = {
            "username": "user1_nomenclatures",
            "password": "Password123!",
            "user_name": "User One",
            "email": "user1_nomenclatures@example.com"
        }
        user2_data = {
            "username": "user2_nomenclatures",
            "password": "Password123!",
            "user_name": "User Two",
            "email": "user2_nomenclatures@example.com"
        }

        # Register and login user1
        client.post("/api/auth/register", json=user1_data)
        response = client.post("/api/auth/login", json={
            "username": user1_data["username"],
            "password": user1_data["password"]
        })
        user1_cookies = response.cookies

        # Create nomenclature as user1
        client.cookies = user1_cookies
        nomenclature_data = {
            "name": "User1 Nomenclature",
            "is_budget": True
        }
        create_response = client.post("/api/nomenclatures/", json=nomenclature_data)
        assert create_response.status_code == status.HTTP_200_OK
        nomenclature_id = create_response.json()["id"]

        # Register and login user2
        client.post("/api/auth/register", json=user2_data)
        response = client.post("/api/auth/login", json={
            "username": user2_data["username"],
            "password": user2_data["password"]
        })
        user2_cookies = response.cookies

        # Try to access user1's nomenclature as user2
        client.cookies = user2_cookies
        get_response = client.get(f"/api/nomenclatures/{nomenclature_id}")
        assert get_response.status_code == status.HTTP_404_NOT_FOUND

        # Get all nomenclatures as user2 - should be empty
        list_response = client.get("/api/nomenclatures/")
        assert list_response.status_code == status.HTTP_200_OK
        nomenclatures = list_response.json()
        assert len(nomenclatures) == 0

    def test_same_nomenclature_name_different_users(self, client: TestClient):
        """Test that different users can have nomenclatures with same name."""
        # Create two users
        user1_data = {
            "username": "user1_same_nomenclature",
            "password": "Password123!",
            "user_name": "User One",
            "email": "user1_same_nomenclature@example.com"
        }
        user2_data = {
            "username": "user2_same_nomenclature",
            "password": "Password123!",
            "user_name": "User Two",
            "email": "user2_same_nomenclature@example.com"
        }

        # Same nomenclature data for both users
        nomenclature_data = {
            "name": "Общая номенклатура",
            "is_budget": True
        }

        # Register and login user1, create nomenclature
        client.post("/api/auth/register", json=user1_data)
        response = client.post("/api/auth/login", json={
            "username": user1_data["username"],
            "password": user1_data["password"]
        })
        client.cookies = response.cookies

        response1 = client.post("/api/nomenclatures/", json=nomenclature_data)
        assert response1.status_code == status.HTTP_200_OK

        # Register and login user2, create same nomenclature
        client.post("/api/auth/register", json=user2_data)
        response = client.post("/api/auth/login", json={
            "username": user2_data["username"],
            "password": user2_data["password"]
        })
        client.cookies = response.cookies

        response2 = client.post("/api/nomenclatures/", json=nomenclature_data)
        assert response2.status_code == status.HTTP_200_OK

        # Both should succeed because they belong to different users
        assert response1.json()["id"] != response2.json()["id"]


class TestNomenclaturesArticleRelationship:
    """Test nomenclature-article relationship functionality."""

    def test_update_nomenclature_article_id(self, authenticated_client: TestClient):
        """Test updating nomenclature's article_id."""
        # Create article
        article_data = {
            "code": "UPD001",
            "name": "Update Test Article",
            "description": "Article for update test",
            "is_active": True
        }
        article_response = authenticated_client.post("/api/articles/", json=article_data)
        article_id = article_response.json()["article_id"]

        # Create nomenclature without article
        nomenclature_data = {
            "name": "Номенклатура для обновления",
            "is_budget": True,
            "is_fact": True
        }
        nomenclature_response = authenticated_client.post("/api/nomenclatures/", json=nomenclature_data)
        nomenclature_id = nomenclature_response.json()["id"]

        # Update nomenclature to add article reference
        update_data = {"article_id": article_id}
        response = authenticated_client.put(f"/api/nomenclatures/{nomenclature_id}", json=update_data)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert data["article_id"] == article_id

    def test_get_nomenclatures_with_article_info(self, authenticated_client: TestClient):
        """Test retrieving nomenclatures includes article information."""
        # Create article
        article_data = {
            "code": "INFO001",
            "name": "Info Test Article",
            "description": "Article for info test",
            "is_active": True
        }
        article_response = authenticated_client.post("/api/articles/", json=article_data)
        article_id = article_response.json()["article_id"]

        # Create nomenclature with article
        nomenclature_data = {
            "name": "Номенклатура с информацией о статье",
            "is_budget": True,
            "is_fact": True,
            "article_id": article_id
        }
        authenticated_client.post("/api/nomenclatures/", json=nomenclature_data)

        # Get nomenclatures list
        response = authenticated_client.get("/api/nomenclatures/")
        assert response.status_code == status.HTTP_200_OK

        nomenclatures = response.json()
        # Find our nomenclature
        test_nomenclature = next(
            (n for n in nomenclatures if n["name"] == "Номенклатура с информацией о статье"),
            None
        )
        assert test_nomenclature is not None
        assert test_nomenclature["article_id"] == article_id

    def test_delete_article_with_nomenclatures(self, authenticated_client: TestClient):
        """Test behavior when trying to delete article that has associated nomenclatures."""
        # Create article
        article_data = {
            "code": "DEL001",
            "name": "Article to Delete",
            "description": "Article for deletion test",
            "is_active": True
        }
        article_response = authenticated_client.post("/api/articles/", json=article_data)
        article_id = article_response.json()["article_id"]

        # Create nomenclature with article reference
        nomenclature_data = {
            "name": "Зависимая номенклатура",
            "is_budget": True,
            "is_fact": True,
            "article_id": article_id
        }
        authenticated_client.post("/api/nomenclatures/", json=nomenclature_data)

        # Try to delete article
        response = authenticated_client.delete(f"/api/articles/{article_id}")
        # Should fail due to foreign key constraint
        assert response.status_code in [status.HTTP_400_BAD_REQUEST, status.HTTP_409_CONFLICT]

    def test_nomenclature_with_user_article(self, authenticated_client: TestClient):
        """Test creating nomenclature with reference to user's own article."""
        # Create user-specific article
        article_data = {
            "code": "USER001",
            "name": "User Article",
            "description": "Article for user nomenclature",
            "is_active": True
        }

        # Create article as authenticated user
        article_response = authenticated_client.post("/api/articles/", json=article_data)
        assert article_response.status_code == status.HTTP_200_OK
        article_id = article_response.json()["article_id"]

        # Create nomenclature referencing user's article
        nomenclature_data = {
            "name": "Номенклатура с пользовательской статьей",
            "is_budget": True,
            "is_fact": True,
            "article_id": article_id
        }

        response = authenticated_client.post("/api/nomenclatures/", json=nomenclature_data)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert data["article_id"] == article_id
        assert "user_id" in data
        assert data["user_id"] is not None


class TestNomenclaturesErrorHandling:
    """Test error handling and edge cases."""

    def test_unauthenticated_access(self, client: TestClient):
        """Test that unauthenticated requests are rejected."""
        nomenclature_data = {
            "name": "Тест без авторизации",
            "is_budget": True
        }

        # Try to create nomenclature without authentication
        response = client.post("/api/nomenclatures/", json=nomenclature_data)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

        # Try to get nomenclatures without authentication
        response = client.get("/api/nomenclatures/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_invalid_data_types(self, authenticated_client: TestClient):
        """Test handling of invalid data types."""
        invalid_data = {
            "name": ["invalid_name"],  # Should be string
            "is_budget": "invalid_boolean",  # Should be boolean
            "is_fact": None  # Should be boolean
        }

        response = authenticated_client.post("/api/nomenclatures/", json=invalid_data)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_pagination_parameters(self, authenticated_client: TestClient):
        """Test pagination with skip and limit parameters."""
        # Create multiple nomenclatures
        for i in range(5):
            nomenclature_data = {
                "name": f"Номенклатура {i:02d}",
                "is_budget": True
            }
            response = authenticated_client.post("/api/nomenclatures/", json=nomenclature_data)
            assert response.status_code == status.HTTP_200_OK

        # Test pagination
        response = authenticated_client.get("/api/nomenclatures/?skip=2&limit=2")
        assert response.status_code == status.HTTP_200_OK

        nomenclatures = response.json()
        assert len(nomenclatures) == 2

    def test_empty_name_handling(self, authenticated_client: TestClient):
        """Test handling of empty or whitespace-only names."""
        # Empty name
        response = authenticated_client.post("/api/nomenclatures/", json={"name": ""})
        assert response.status_code in [
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            status.HTTP_400_BAD_REQUEST
        ]

        # Whitespace-only name
        response = authenticated_client.post("/api/nomenclatures/", json={"name": "   "})
        assert response.status_code in [
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            status.HTTP_400_BAD_REQUEST
        ]


@pytest.mark.asyncio
class TestNomenclaturesAsyncOperations:
    """Test asynchronous operations on nomenclatures."""

    async def test_concurrent_nomenclature_creation(self, authenticated_async_client: AsyncClient):
        """Test handling of concurrent nomenclature creation attempts."""
        nomenclature_data = {
            "name": "Конкурентный тест",
            "is_budget": True
        }

        # Make concurrent requests
        import asyncio

        async def create_nomenclature():
            return await authenticated_async_client.post("/api/nomenclatures/", json=nomenclature_data)

        # Only one should succeed, others should get 400
        responses = await asyncio.gather(
            create_nomenclature(),
            create_nomenclature(),
            create_nomenclature(),
            return_exceptions=True
        )

        success_count = sum(1 for r in responses if r.status_code == status.HTTP_200_OK)
        conflict_count = sum(1 for r in responses if r.status_code == status.HTTP_400_BAD_REQUEST)

        assert success_count == 1
        assert conflict_count == 2