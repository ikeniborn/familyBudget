"""
Integration tests for Shopping Lists API - DELETE endpoint.

Tests DELETE /api/v1/shopping-lists/{id} endpoint with:
- Success case (owner deletes list)
- Permission checks (non-owner cannot delete)
- 404 handling (list not found)
- Cascade deletion (items deleted with list)
- WebSocket broadcast (shopping_list_deleted event)
"""

from datetime import datetime
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from backend.app.models.shopping_list import ShoppingList
from backend.app.models.shopping_list_item import ShoppingListItem
from backend.app.models.user import User


@pytest.mark.integration
@pytest.mark.backend
@pytest.mark.destructive
class TestShoppingListDelete:
    """Test DELETE /api/v1/shopping-lists/{id} endpoint."""

    @pytest.fixture
    async def creator_user(self, db_session: AsyncSession):
        """Create user who will own the shopping list."""
        user = User(
            telegram_id=111111111,
            username="listcreator",
            first_name="List",
            last_name="Creator",
            is_admin=False,
            is_active=True,
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        return user

    @pytest.fixture
    async def other_user(self, db_session: AsyncSession):
        """Create another user who is NOT the list owner."""
        user = User(
            telegram_id=222222222,
            username="otheruser",
            first_name="Other",
            last_name="User",
            is_admin=False,
            is_active=True,
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        return user

    @pytest.fixture
    async def shopping_list(self, db_session: AsyncSession, creator_user: User):
        """Create test shopping list owned by creator_user."""
        shopping_list = ShoppingList(
            creator_id=creator_user.id,
            name="Test Shopping List",
            description="Integration test shopping list",
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db_session.add(shopping_list)
        await db_session.commit()
        await db_session.refresh(shopping_list)
        return shopping_list

    @pytest.fixture
    async def shopping_list_with_items(self, db_session: AsyncSession, shopping_list: ShoppingList):
        """Create shopping list with 5 items for cascade delete test."""
        items = []
        for i in range(5):
            item = ShoppingListItem(
                shopping_list_id=shopping_list.id,
                product_name=f"Test Product {i+1}",
                quantity=i + 1,
                price_cents=100 * (i + 1),  # 100, 200, 300, 400, 500 cents
                is_completed=False,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db_session.add(item)
            items.append(item)

        await db_session.commit()
        for item in items:
            await db_session.refresh(item)

        return shopping_list, items

    def create_auth_headers(self, user_id: int) -> dict:
        """
        Create authentication headers for test user.

        Note: This is a simplified version. In real implementation,
        you would generate a proper JWT token.
        """
        # TODO: Replace with actual JWT token generation when auth is fully implemented
        return {"X-User-ID": str(user_id)}

    async def test_delete_shopping_list_success(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        shopping_list: ShoppingList,
        creator_user: User,
    ):
        """
        DELETE /shopping-lists/{id} should return 204 when owner deletes list.

        Given: Shopping list exists, user is the creator (owner)
        When: DELETE request is sent
        Then:
          - Response: 204 No Content
          - List is deleted from database
          - WebSocket broadcast is called
        """
        headers = self.create_auth_headers(creator_user.id)

        # Mock WebSocket broadcast to verify it's called
        with patch(
            'backend.app.api.v1.endpoints.shopping_lists.broadcast_shopping_list_deleted',
            new_callable=AsyncMock
        ) as mock_broadcast:
            # When: DELETE request
            response = await client.delete(
                f"/api/v1/shopping-lists/{shopping_list.id}",
                headers=headers,
            )

            # Then: 204 No Content
            assert response.status_code == 204
            assert response.text == ""

            # Verify list deleted from database
            query = select(ShoppingList).where(ShoppingList.id == shopping_list.id)
            result = await db_session.execute(query)
            deleted_list = result.scalar_one_or_none()
            assert deleted_list is None, "Shopping list should be deleted from database"

            # Verify WebSocket broadcast was called
            mock_broadcast.assert_awaited_once_with(shopping_list.id)

    async def test_delete_shopping_list_not_owner_forbidden(
        self,
        client: AsyncClient,
        shopping_list: ShoppingList,
        other_user: User,
    ):
        """
        DELETE /shopping-lists/{id} should return 403 when non-owner tries to delete.

        Given: Shopping list exists, user is NOT the creator
        When: DELETE request is sent
        Then:
          - Response: 403 Forbidden
          - Error message: "Only the list creator can delete it"
        """
        headers = self.create_auth_headers(other_user.id)

        # When: DELETE request from non-owner
        response = await client.delete(
            f"/api/v1/shopping-lists/{shopping_list.id}",
            headers=headers,
        )

        # Then: 403 Forbidden
        assert response.status_code == 403
        error_data = response.json()
        assert "creator" in error_data["detail"].lower() or "owner" in error_data["detail"].lower()

    async def test_delete_shopping_list_not_found(
        self,
        client: AsyncClient,
        creator_user: User,
    ):
        """
        DELETE /shopping-lists/{id} should return 404 when list doesn't exist.

        Given: Shopping list with ID 99999 does not exist
        When: DELETE request is sent
        Then:
          - Response: 404 Not Found
          - Error message contains "not found"
        """
        headers = self.create_auth_headers(creator_user.id)
        non_existent_id = 99999

        # When: DELETE non-existent list
        response = await client.delete(
            f"/api/v1/shopping-lists/{non_existent_id}",
            headers=headers,
        )

        # Then: 404 Not Found
        assert response.status_code == 404
        error_data = response.json()
        assert "not found" in error_data["detail"].lower()
        assert str(non_existent_id) in error_data["detail"]

    async def test_delete_shopping_list_cascades_items(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        shopping_list_with_items,
        creator_user: User,
    ):
        """
        DELETE /shopping-lists/{id} should cascade delete all items.

        Given: Shopping list with 5 items exists
        When: DELETE request is sent
        Then:
          - Response: 204 No Content
          - List is deleted from database
          - All 5 items are deleted from database (cascade)
        """
        shopping_list, items = shopping_list_with_items
        headers = self.create_auth_headers(creator_user.id)

        # Verify items exist before deletion
        items_query = select(ShoppingListItem).where(
            ShoppingListItem.shopping_list_id == shopping_list.id
        )
        result = await db_session.execute(items_query)
        existing_items = result.scalars().all()
        assert len(existing_items) == 5, "Should have 5 items before deletion"

        # When: DELETE list
        response = await client.delete(
            f"/api/v1/shopping-lists/{shopping_list.id}",
            headers=headers,
        )

        # Then: 204 No Content
        assert response.status_code == 204

        # Verify list deleted
        list_query = select(ShoppingList).where(ShoppingList.id == shopping_list.id)
        result = await db_session.execute(list_query)
        deleted_list = result.scalar_one_or_none()
        assert deleted_list is None, "Shopping list should be deleted"

        # Verify all items cascade deleted
        items_query = select(ShoppingListItem).where(
            ShoppingListItem.shopping_list_id == shopping_list.id
        )
        result = await db_session.execute(items_query)
        remaining_items = result.scalars().all()
        assert len(remaining_items) == 0, "All items should be cascade deleted"

    async def test_delete_shopping_list_broadcasts_websocket(
        self,
        client: AsyncClient,
        shopping_list: ShoppingList,
        creator_user: User,
    ):
        """
        DELETE /shopping-lists/{id} should broadcast shopping_list_deleted event.

        Given: Shopping list exists
        When: DELETE request is sent
        Then:
          - WebSocket broadcast function is called
          - Event type: "shopping_list_deleted"
          - Event data: {"id": shopping_list_id}
        """
        headers = self.create_auth_headers(creator_user.id)

        # Mock WebSocket broadcast to capture call arguments
        with patch(
            'backend.app.api.v1.endpoints.shopping_lists.broadcast_shopping_list_deleted',
            new_callable=AsyncMock
        ) as mock_broadcast:
            # When: DELETE request
            response = await client.delete(
                f"/api/v1/shopping-lists/{shopping_list.id}",
                headers=headers,
            )

            # Then: Success
            assert response.status_code == 204

            # Verify WebSocket broadcast called with correct list ID
            mock_broadcast.assert_awaited_once()
            call_args = mock_broadcast.call_args
            assert call_args[0][0] == shopping_list.id, "Broadcast should be called with list ID"

    async def test_delete_shopping_list_already_deleted(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        shopping_list: ShoppingList,
        creator_user: User,
    ):
        """
        DELETE /shopping-lists/{id} should return 404 on second delete attempt.

        Given: Shopping list was already deleted
        When: DELETE request is sent again
        Then:
          - Response: 404 Not Found
          - Error message: "not found"

        This tests the scenario from the bug report where user tries
        to delete the same list twice (e.g., in different tabs).
        """
        headers = self.create_auth_headers(creator_user.id)

        # First delete - should succeed
        response1 = await client.delete(
            f"/api/v1/shopping-lists/{shopping_list.id}",
            headers=headers,
        )
        assert response1.status_code == 204

        # Second delete - should return 404
        response2 = await client.delete(
            f"/api/v1/shopping-lists/{shopping_list.id}",
            headers=headers,
        )
        assert response2.status_code == 404
        error_data = response2.json()
        assert "not found" in error_data["detail"].lower()


@pytest.mark.integration
@pytest.mark.backend
class TestShoppingListDeleteEdgeCases:
    """Test edge cases and error handling for DELETE endpoint."""

    @pytest.fixture
    async def test_user(self, db_session: AsyncSession):
        """Create test user."""
        user = User(
            telegram_id=333333333,
            username="edgecaseuser",
            first_name="Edge",
            last_name="Case",
            is_admin=False,
            is_active=True,
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        return user

    def create_auth_headers(self, user_id: int) -> dict:
        """Create auth headers for test user."""
        return {"X-User-ID": str(user_id)}

    async def test_delete_with_invalid_id_format(
        self,
        client: AsyncClient,
        test_user: User,
    ):
        """
        DELETE /shopping-lists/{id} should handle invalid ID format.

        Given: ID is not a valid integer
        When: DELETE request with invalid ID
        Then: 422 Validation Error (FastAPI auto-validation)
        """
        headers = self.create_auth_headers(test_user.id)

        # When: DELETE with invalid ID format
        response = await client.delete(
            "/api/v1/shopping-lists/not-a-number",
            headers=headers,
        )

        # Then: 422 Validation Error
        assert response.status_code == 422

    async def test_delete_websocket_broadcast_failure_does_not_block(
        self,
        client: AsyncClient,
        db_session: AsyncSession,
        test_user: User,
    ):
        """
        DELETE should succeed even if WebSocket broadcast fails.

        Given: Shopping list exists, WebSocket broadcast will fail
        When: DELETE request is sent
        Then:
          - Response: 204 No Content (success)
          - List is deleted from database
          - Error is logged but doesn't block deletion

        This ensures resilience - WebSocket is nice-to-have, not critical.
        """
        # Create shopping list
        shopping_list = ShoppingList(
            creator_id=test_user.id,
            name="Test List for Broadcast Failure",
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db_session.add(shopping_list)
        await db_session.commit()
        await db_session.refresh(shopping_list)

        headers = self.create_auth_headers(test_user.id)

        # Mock WebSocket broadcast to raise exception
        with patch(
            'backend.app.api.v1.endpoints.shopping_lists.broadcast_shopping_list_deleted',
            new_callable=AsyncMock,
            side_effect=Exception("WebSocket server unavailable")
        ):
            # When: DELETE request (broadcast will fail)
            response = await client.delete(
                f"/api/v1/shopping-lists/{shopping_list.id}",
                headers=headers,
            )

            # Then: Should still succeed
            assert response.status_code == 204

            # Verify list deleted despite broadcast failure
            query = select(ShoppingList).where(ShoppingList.id == shopping_list.id)
            result = await db_session.execute(query)
            deleted_list = result.scalar_one_or_none()
            assert deleted_list is None, "List should be deleted even if broadcast fails"
