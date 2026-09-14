"""
Async client for the OpenAI-compatible GPU API (framework project).

Wire format follows the OpenAI HTTP API:
    GET  {endpoint}/models
    POST {endpoint}/chat/completions
    POST {endpoint}/audio/transcriptions   (custom shape: WAV only, {"text": ...})

Retry policy: 503 responses (model cold start / restore in progress) are
retried up to MAX_RETRIES_503 times with backoff; every other failure is
surfaced immediately as AIProviderError. No provider call is ever made from
existing (non-AI) request paths.
"""
import asyncio
import logging
import re
from typing import Any

import httpx

logger = logging.getLogger(__name__)

CONNECT_TIMEOUT = 5.0
# Cold start of an unloaded local model can take minutes; keep read generous.
READ_TIMEOUT = 120.0
MAX_RETRIES_503 = 2
RETRY_BACKOFF_SECONDS = (1.0, 3.0)


class AIProviderError(Exception):
    """Provider call failed after retries; carries HTTP status when known."""

    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


class AIProviderClient:
    """Thin wrapper over httpx for one configured provider endpoint."""

    def __init__(
        self,
        endpoint_url: str,
        api_token: str | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
    ):
        self.endpoint_url = endpoint_url.rstrip("/")
        self._transport = transport  # test seam (httpx.MockTransport)
        self._headers: dict[str, str] = {}
        if api_token:
            self._headers["Authorization"] = f"Bearer {api_token}"

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=self.endpoint_url,
            headers=self._headers,
            timeout=httpx.Timeout(READ_TIMEOUT, connect=CONNECT_TIMEOUT),
            transport=self._transport,
        )

    async def _request_with_retry(
        self, method: str, path: str, **kwargs: Any
    ) -> httpx.Response:
        last_error: Exception | None = None
        async with self._client() as client:
            for attempt in range(MAX_RETRIES_503 + 1):
                try:
                    response = await client.request(method, path, **kwargs)
                except httpx.HTTPError as exc:
                    raise AIProviderError(f"Provider unreachable: {exc}") from exc

                if response.status_code == 503 and attempt < MAX_RETRIES_503:
                    # Expected during model restore / cold start.
                    delay = RETRY_BACKOFF_SECONDS[
                        min(attempt, len(RETRY_BACKOFF_SECONDS) - 1)
                    ]
                    logger.info(
                        "AI provider 503 on %s (attempt %d), retrying in %.1fs",
                        path,
                        attempt + 1,
                        delay,
                    )
                    last_error = AIProviderError(
                        "Provider busy (503)", status_code=503
                    )
                    await asyncio.sleep(delay)
                    continue

                if response.status_code >= 400:
                    raise AIProviderError(
                        f"Provider error {response.status_code}: "
                        f"{response.text[:300]}",
                        status_code=response.status_code,
                    )
                return response

        raise last_error or AIProviderError("Provider call failed")

    async def list_models(self) -> list[dict[str, Any]]:
        """Return raw model entries from GET /models (id + optional metadata)."""
        response = await self._request_with_retry("GET", "/models")
        payload = response.json()
        return payload.get("data", [])

    async def chat_completions(
        self,
        model: str,
        messages: list[dict[str, Any]],
        response_format: dict[str, Any] | None = None,
        max_tokens: int = 1024,
        temperature: float = 0.1,
    ) -> str:
        """Run a chat completion and return the assistant message content."""
        body: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        if response_format:
            body["response_format"] = response_format

        response = await self._request_with_retry(
            "POST", "/chat/completions", json=body
        )
        payload = response.json()
        try:
            content = payload["choices"][0]["message"]["content"] or ""
        except (KeyError, IndexError, TypeError) as exc:
            raise AIProviderError(
                f"Unexpected chat response shape: {payload!r:.300}"
            ) from exc
        # Reasoning models (qwen3 thinking variants) wrap or prepend their
        # chain of thought in <think>...</think>; strip it so callers see
        # only the final answer. An unclosed tag means the model spent the
        # whole budget thinking — treat as empty.
        if "<think>" in content:
            content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL)
            content = re.sub(r"<think>.*\Z", "", content, flags=re.DOTALL)
        return content.strip()

    async def transcribe(
        self, wav_bytes: bytes, model: str, language: str = "ru"
    ) -> str:
        """Transcribe a WAV payload; provider returns exactly {"text": ...}."""
        response = await self._request_with_retry(
            "POST",
            "/audio/transcriptions",
            files={"file": ("audio.wav", wav_bytes, "audio/wav")},
            data={
                "model": model,
                "language": language,
                "response_format": "json",
            },
        )
        payload = response.json()
        text = payload.get("text")
        if text is None:
            raise AIProviderError(
                f"Unexpected transcription response shape: {payload!r:.300}"
            )
        return text
