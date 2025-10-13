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
                cookies={"access_token": token}
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
                cookies={"access_token": token}
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
        description: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create new fact (income/expense record).

        Args:
            token: JWT access token
            article_id: Article ID
            fact_date: Fact date (ISO format: YYYY-MM-DD)
            amount: Amount (decimal string)
            description: Optional description

        Returns:
            Dict containing created fact data

        Raises:
            httpx.HTTPStatusError: If request fails
        """
        try:
            fact_data = {
                "article_id": article_id,
                "fact_date": fact_date,
                "amount": amount
            }
            if description:
                fact_data["description"] = description

            response = await self.client.post(
                "/facts",
                json=fact_data,
                cookies={"access_token": token}
            )
            response.raise_for_status()

            logger.info(f"Fact created: amount={amount}, article_id={article_id}")
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
        article_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get user's articles (categories).

        Args:
            token: JWT access token
            article_type: Filter by type ('income' or 'expense')

        Returns:
            Dict containing articles data

        Raises:
            httpx.HTTPStatusError: If request fails
        """
        try:
            params = {}
            if article_type:
                params["type"] = article_type

            response = await self.client.get(
                "/articles",
                params=params,
                cookies={"access_token": token}
            )
            response.raise_for_status()

            return response.json()

        except httpx.HTTPStatusError as e:
            logger.error(f"Get articles failed: {e.response.status_code}")
            raise

        except Exception as e:
            logger.error(f"Get articles error: {str(e)}")
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
