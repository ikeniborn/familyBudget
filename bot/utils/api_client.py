"""
HTTP client for communication with backend API.

Provides methods to interact with backend endpoints
using JWT tokens for authentication.
"""

from typing import Any, Dict, Optional

import httpx

from bot.config.settings import get_settings
from bot.utils.logger import get_logger

settings = get_settings()
logger = get_logger(__name__)


class APIClient:
    """
    HTTP client for backend API communication.

    Handles authentication, requests, and error handling.
    """

    def __init__(self, base_url: Optional[str] = None, timeout: Optional[int] = None):
        """
        Initialize API client.

        Args:
            base_url: Backend API base URL (defaults to settings.BACKEND_API_URL)
            timeout: Request timeout in seconds (defaults to settings.BACKEND_TIMEOUT)
        """
        self.base_url = base_url or settings.BACKEND_API_URL
        self.timeout = timeout or settings.BACKEND_TIMEOUT
        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=self.timeout,
            follow_redirects=True
        )
        logger.info(f"API Client initialized: {self.base_url}")

    async def close(self):
        """Close HTTP client connection."""
        await self.client.aclose()
        logger.info("API Client closed")

    async def get(
        self,
        endpoint: str,
        token: Optional[str] = None,
        params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Universal GET request method.

        Args:
            endpoint: API endpoint path (e.g., "/articles" or "/api/v1/articles")
            token: JWT access token (optional)
            params: Query parameters (optional)

        Returns:
            Dict containing response data

        Raises:
            httpx.HTTPStatusError: If request fails
        """
        try:
            kwargs = {}
            if params:
                kwargs["params"] = params
            if token:
                # SECURITY: Use Authorization header instead of cookies
                # This prevents token from being logged in access logs
                kwargs["headers"] = {"Authorization": f"Bearer {token}"}

            response = await self.client.get(endpoint, **kwargs)
            response.raise_for_status()

            return response.json()

        except httpx.HTTPStatusError as e:
            logger.error(f"GET {endpoint} failed: {e.response.status_code} - {e.response.text}")
            raise

        except Exception as e:
            logger.error(f"GET {endpoint} error: {str(e)}")
            raise

    async def post(
        self,
        endpoint: str,
        token: Optional[str] = None,
        json: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Universal POST request method.

        Args:
            endpoint: API endpoint path
            token: JWT access token (optional)
            json: Request body as dict (optional)

        Returns:
            Dict containing response data

        Raises:
            httpx.HTTPStatusError: If request fails
        """
        try:
            kwargs: Dict[str, Any] = {}
            if json is not None:
                kwargs["json"] = json
            if token:
                kwargs["headers"] = {"Authorization": f"Bearer {token}"}

            response = await self.client.post(endpoint, **kwargs)
            response.raise_for_status()

            return response.json()

        except httpx.HTTPStatusError as e:
            logger.error(f"POST {endpoint} failed: {e.response.status_code} - {e.response.text}")
            raise

        except Exception as e:
            logger.error(f"POST {endpoint} error: {str(e)}")
            raise

    async def authenticate_telegram_user(self, telegram_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Authenticate user via Telegram OAuth.

        Args:
            telegram_data: Telegram user data (id, first_name, hash, etc.)

        Returns:
            Dict containing user data and JWT token

        Raises:
            httpx.HTTPStatusError: If authentication fails
        """
        try:
            response = await self.client.post(
                "/auth/telegram",
                json=telegram_data
            )
            response.raise_for_status()

            data = response.json()
            logger.info(f"User authenticated: telegram_id={telegram_data.get('id')}")
            return data

        except httpx.HTTPStatusError as e:
            logger.error(f"Authentication failed: {e.response.status_code} - {e.response.text}")
            raise

        except Exception as e:
            logger.error(f"Authentication error: {str(e)}")
            raise

    async def list_facts(
        self,
        token: str,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        article_id: Optional[int] = None,
        limit: int = 1000
    ) -> Dict[str, Any]:
        """
        List user's facts with filtering.

        Args:
            token: JWT access token
            date_from: Start date filter (ISO format: YYYY-MM-DD)
            date_to: End date filter (ISO format: YYYY-MM-DD)
            article_id: Filter by article ID
            limit: Maximum number of records to return

        Returns:
            Dict containing facts list and pagination info

        Raises:
            httpx.HTTPStatusError: If request fails
        """
        try:
            params = {}
            if date_from:
                params["date_from"] = date_from
            if date_to:
                params["date_to"] = date_to
            if article_id:
                params["article_id"] = article_id
            if limit:
                params["limit"] = limit

            response = await self.client.get(
                "/facts",
                params=params,
                headers={"Authorization": f"Bearer {token}"}
            )
            response.raise_for_status()

            return response.json()

        except httpx.HTTPStatusError as e:
            logger.error(f"List facts failed: {e.response.status_code}")
            raise

        except Exception as e:
            logger.error(f"List facts error: {str(e)}")
            raise

    async def get_user_facts(
        self,
        token: str,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        article_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Get user's facts (income/expense records).

        Args:
            token: JWT access token
            date_from: Start date filter (ISO format: YYYY-MM-DD)
            date_to: End date filter (ISO format: YYYY-MM-DD)
            article_id: Filter by article ID

        Returns:
            Dict containing facts data

        Raises:
            httpx.HTTPStatusError: If request fails
        """
        try:
            params = {}
            if date_from:
                params["date_from"] = date_from
            if date_to:
                params["date_to"] = date_to
            if article_id:
                params["article_id"] = article_id

            response = await self.client.get(
                "/facts",
                params=params,
                headers={"Authorization": f"Bearer {token}"}
            )
            response.raise_for_status()

            return response.json()

        except httpx.HTTPStatusError as e:
            logger.error(f"Get facts failed: {e.response.status_code}")
            raise

        except Exception as e:
            logger.error(f"Get facts error: {str(e)}")
            raise

    async def get_facts_summary(
        self,
        token: str,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get aggregated summary of user's facts.

        Args:
            token: JWT access token
            date_from: Start date filter
            date_to: End date filter

        Returns:
            Dict containing summary (total_income, total_expense, balance)

        Raises:
            httpx.HTTPStatusError: If request fails
        """
        try:
            params = {}
            if date_from:
                params["date_from"] = date_from
            if date_to:
                params["date_to"] = date_to

            response = await self.client.get(
                "/facts/summary",
                params=params,
                headers={"Authorization": f"Bearer {token}"}
            )
            response.raise_for_status()

            return response.json()

        except httpx.HTTPStatusError as e:
            logger.error(f"Get summary failed: {e.response.status_code}")
            raise

        except Exception as e:
            logger.error(f"Get summary error: {str(e)}")
            raise

    async def create_fact(
        self,
        token: str,
        article_id: int,
        fact_date: str,
        amount: str,
        description: Optional[str] = None,
        record_type: str = "fact",
        financial_center_id: Optional[int] = None,
        cost_center_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Create new fact (income/expense record or budget plan).

        Args:
            token: JWT access token
            article_id: Article ID
            fact_date: Fact date (ISO format: YYYY-MM-DD)
            amount: Amount (decimal string, ALWAYS POSITIVE, sign determined by article_type)
            description: Optional description
            record_type: 'fact' for actual transactions, 'plan' for budget plans (default: 'fact')
            financial_center_id: Optional financial center ID (ЦФО)
            cost_center_id: Optional cost center ID (МВЗ)

        Returns:
            Dict containing created fact data

        Raises:
            httpx.HTTPStatusError: If request fails
        """
        try:
            fact_data = {
                "article_id": article_id,
                "fact_date": fact_date,
                "amount": amount,
                "record_type": record_type
            }
            if description:
                fact_data["description"] = description
            if financial_center_id:
                fact_data["financial_center_id"] = financial_center_id
            if cost_center_id:
                fact_data["cost_center_id"] = cost_center_id

            response = await self.client.post(
                "/facts",
                json=fact_data,
                headers={"Authorization": f"Bearer {token}"}
            )
            response.raise_for_status()

            logger.info(f"Fact created: amount={amount}, article_id={article_id}, fin_center={financial_center_id}, cost_center={cost_center_id}")
            return response.json()

        except httpx.HTTPStatusError as e:
            logger.error(f"Create fact failed: {e.response.status_code} - {e.response.text}")
            raise

        except Exception as e:
            logger.error(f"Create fact error: {str(e)}")
            raise

    async def get_articles(
        self,
        token: str,
        article_type: Optional[str] = None,
        parent_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Get user's articles (categories).

        Args:
            token: JWT access token
            article_type: Filter by type ('income' or 'expense')
            parent_id: Filter by parent article ID (None for root articles)

        Returns:
            Dict containing articles data

        Raises:
            httpx.HTTPStatusError: If request fails
        """
        try:
            params = {}
            if article_type:
                params["type"] = article_type
            if parent_id is not None:
                params["parent_id"] = parent_id

            response = await self.client.get(
                "/articles",
                params=params,
                headers={"Authorization": f"Bearer {token}"}
            )
            response.raise_for_status()

            return response.json()

        except httpx.HTTPStatusError as e:
            logger.error(f"Get articles failed: {e.response.status_code}")
            raise

        except Exception as e:
            logger.error(f"Get articles error: {str(e)}")
            raise

    async def list_articles(
        self,
        token: str,
        limit: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        List user's articles (alias for get_articles with pagination).

        Args:
            token: JWT access token
            limit: Maximum number of articles to return

        Returns:
            Dict containing articles list

        Raises:
            httpx.HTTPStatusError: If request fails
        """
        try:
            params = {}
            if limit:
                params["limit"] = limit

            response = await self.client.get(
                "/articles",
                params=params,
                headers={"Authorization": f"Bearer {token}"}
            )
            response.raise_for_status()

            return response.json()

        except httpx.HTTPStatusError as e:
            logger.error(f"List articles failed: {e.response.status_code}")
            raise

        except Exception as e:
            logger.error(f"List articles error: {str(e)}")
            raise

    async def get_article(
        self,
        token: str,
        article_id: int
    ) -> Dict[str, Any]:
        """
        Get single article by ID.

        Args:
            token: JWT access token
            article_id: Article ID

        Returns:
            Dict containing article data

        Raises:
            httpx.HTTPStatusError: If request fails
        """
        try:
            response = await self.client.get(
                f"/articles/{article_id}",
                headers={"Authorization": f"Bearer {token}"}
            )
            response.raise_for_status()

            return response.json()

        except httpx.HTTPStatusError as e:
            logger.error(f"Get article failed: {e.response.status_code}")
            raise

        except Exception as e:
            logger.error(f"Get article error: {str(e)}")
            raise

    async def get_fact(
        self,
        token: str,
        fact_id: int
    ) -> Dict[str, Any]:
        """
        Get single fact by ID.

        Args:
            token: JWT access token
            fact_id: Fact ID

        Returns:
            Dict containing fact data

        Raises:
            httpx.HTTPStatusError: If request fails
        """
        try:
            response = await self.client.get(
                f"/facts/{fact_id}",
                headers={"Authorization": f"Bearer {token}"}
            )
            response.raise_for_status()

            return response.json()

        except httpx.HTTPStatusError as e:
            logger.error(f"Get fact failed: {e.response.status_code}")
            raise

        except Exception as e:
            logger.error(f"Get fact error: {str(e)}")
            raise

    async def update_fact(
        self,
        token: str,
        fact_id: int,
        **update_data
    ) -> Dict[str, Any]:
        """
        Update fact fields.

        Args:
            token: JWT access token
            fact_id: Fact ID
            **update_data: Fields to update (amount, fact_date, description, article_id, etc.)

        Returns:
            Dict containing updated fact data

        Raises:
            httpx.HTTPStatusError: If request fails
        """
        try:
            response = await self.client.put(
                f"/facts/{fact_id}",
                json=update_data,
                headers={"Authorization": f"Bearer {token}"}
            )
            response.raise_for_status()

            logger.info(f"Fact {fact_id} updated")
            return response.json()

        except httpx.HTTPStatusError as e:
            logger.error(f"Update fact failed: {e.response.status_code} - {e.response.text}")
            raise

        except Exception as e:
            logger.error(f"Update fact error: {str(e)}")
            raise

    async def delete_fact(
        self,
        token: str,
        fact_id: int
    ) -> None:
        """
        Delete fact by ID.

        Args:
            token: JWT access token
            fact_id: Fact ID

        Raises:
            httpx.HTTPStatusError: If request fails
        """
        try:
            response = await self.client.delete(
                f"/facts/{fact_id}",
                headers={"Authorization": f"Bearer {token}"}
            )
            response.raise_for_status()

            logger.info(f"Fact {fact_id} deleted")

        except httpx.HTTPStatusError as e:
            logger.error(f"Delete fact failed: {e.response.status_code} - {e.response.text}")
            raise

        except Exception as e:
            logger.error(f"Delete fact error: {str(e)}")
            raise

    async def get_financial_centers(
        self,
        token: str,
        limit: int = 1000,
        include_global: bool = True
    ) -> Dict[str, Any]:
        """
        Get user's financial centers (ЦФО - Центры финансового учета).

        Args:
            token: JWT access token
            limit: Maximum number of results (default: 1000)
            include_global: Include global centers (default: True)

        Returns:
            Dict containing financial centers list

        Raises:
            httpx.HTTPStatusError: If request fails
        """
        try:
            params = {
                "limit": limit,
                "include_global": str(include_global).lower()
            }

            response = await self.client.get(
                "/financial-centers",
                params=params,
                headers={"Authorization": f"Bearer {token}"}
            )
            response.raise_for_status()

            return response.json()

        except httpx.HTTPStatusError as e:
            logger.error(f"Get financial centers failed: {e.response.status_code}")
            raise

        except Exception as e:
            logger.error(f"Get financial centers error: {str(e)}")
            raise

    async def get_cost_centers(
        self,
        token: str,
        limit: int = 1000,
        include_global: bool = True
    ) -> Dict[str, Any]:
        """
        Get user's cost centers (МВЗ - Места возникновения затрат).

        Args:
            token: JWT access token
            limit: Maximum number of results (default: 1000)
            include_global: Include global centers (default: True)

        Returns:
            Dict containing cost centers list

        Raises:
            httpx.HTTPStatusError: If request fails
        """
        try:
            params = {
                "limit": limit,
                "include_global": str(include_global).lower()
            }

            response = await self.client.get(
                "/cost-centers",
                params=params,
                headers={"Authorization": f"Bearer {token}"}
            )
            response.raise_for_status()

            return response.json()

        except httpx.HTTPStatusError as e:
            logger.error(f"Get cost centers failed: {e.response.status_code}")
            raise

        except Exception as e:
            logger.error(f"Get cost centers error: {str(e)}")
            raise

    async def check_duplicate_notification(
        self,
        article_id: int,
        notification_type: str,
        period_start: str,
        period_end: str
    ) -> bool:
        """
        Check if broadcast notification already exists for this period.

        Args:
            article_id: Budget category/article ID
            notification_type: Notification type (budget_threshold, budget_exceeded, etc.)
            period_start: Period start date (YYYY-MM-DD)
            period_end: Period end date (YYYY-MM-DD)

        Returns:
            bool: True if notification exists (do not send), False otherwise

        Raises:
            httpx.HTTPStatusError: If request fails
        """
        try:
            params = {
                "article_id": article_id,
                "notification_type": notification_type,
                "period_start": period_start,
                "period_end": period_end
            }

            headers = {"X-Api-Key": settings.API_INTERNAL_KEY}

            response = await self.client.get(
                "/notifications/check-duplicate",
                params=params,
                headers=headers
            )
            response.raise_for_status()

            return response.json()

        except httpx.HTTPStatusError as e:
            logger.error(f"Check duplicate notification failed: {e.response.status_code}")
            raise

        except Exception as e:
            logger.error(f"Check duplicate notification error: {str(e)}")
            raise

    async def create_notification(
        self,
        article_id: int,
        notification_type: str,
        threshold_percent: int,
        plan_amount: str,
        actual_amount: str,
        period_start: str,
        period_end: str,
        user_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Create notification record.

        Args:
            article_id: Budget category/article ID
            notification_type: Notification type
            threshold_percent: Threshold percentage that triggered notification
            plan_amount: Planned budget amount (decimal string)
            actual_amount: Actual spent amount (decimal string)
            period_start: Period start date (YYYY-MM-DD)
            period_end: Period end date (YYYY-MM-DD)
            user_id: User ID for user-specific notification (None = broadcast)

        Returns:
            Dict containing created notification data

        Raises:
            httpx.HTTPStatusError: If request fails
        """
        try:
            notification_data = {
                "article_id": article_id,
                "notification_type": notification_type,
                "threshold_percent": threshold_percent,
                "plan_amount": plan_amount,
                "actual_amount": actual_amount,
                "period_start": period_start,
                "period_end": period_end
            }
            if user_id is not None:
                notification_data["user_id"] = user_id

            headers = {"X-Api-Key": settings.API_INTERNAL_KEY}

            response = await self.client.post(
                "/notifications",
                json=notification_data,
                headers=headers
            )
            response.raise_for_status()

            logger.info(f"Notification created: type={notification_type}, article_id={article_id}")
            return response.json()

        except httpx.HTTPStatusError as e:
            logger.error(f"Create notification failed: {e.response.status_code} - {e.response.text}")
            raise

        except Exception as e:
            logger.error(f"Create notification error: {str(e)}")
            raise

    async def get_all_telegram_ids(self) -> list[Dict[str, int]]:
        """
        Get telegram_id for all active users (for broadcast notifications).

        Returns:
            List of dicts with telegram_id for each active user

        Raises:
            httpx.HTTPStatusError: If request fails
        """
        try:
            response = await self.client.get("/users/telegram-ids")
            response.raise_for_status()

            return response.json()

        except httpx.HTTPStatusError as e:
            logger.error(f"Get telegram IDs failed: {e.response.status_code}")
            raise

        except Exception as e:
            logger.error(f"Get telegram IDs error: {str(e)}")
            raise


# Global API client instance
api_client = APIClient()


async def get_api_client() -> APIClient:
    """
    Get API client instance.

    Returns:
        APIClient: API client instance
    """
    return api_client
