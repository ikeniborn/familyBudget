"""Regression tests for make_telegram_client proxy construction.

httpx >= 0.28 removed the `AsyncClient(proxies=...)` kwarg. The old code passed
`proxies={"all://": url}`, which raised
``TypeError: AsyncClient.__init__() got an unexpected keyword argument 'proxies'``
at runtime and broke every Telegram API caller (auth, notifications, avatars,
plan reminders). These tests ensure the client constructs cleanly with and
without a configured proxy.
"""

import pytest

from backend.app.services import telegram_auth


@pytest.mark.asyncio
async def test_make_telegram_client_without_proxy(monkeypatch):
    """No proxy configured -> plain AsyncClient, no error."""
    monkeypatch.setattr(telegram_auth.settings, "TELEGRAM_PROXY_URL", None)

    client = telegram_auth.make_telegram_client()
    try:
        assert client is not None
    finally:
        await client.aclose()


@pytest.mark.asyncio
async def test_make_telegram_client_with_proxy(monkeypatch):
    """Proxy configured -> AsyncClient(proxy=...) constructs without TypeError.

    Under the old `proxies=` kwarg this raised on httpx >= 0.28.
    """
    monkeypatch.setattr(
        telegram_auth.settings, "TELEGRAM_PROXY_URL", "http://proxy.example.com:8080"
    )

    client = telegram_auth.make_telegram_client()
    try:
        assert client is not None
    finally:
        await client.aclose()
