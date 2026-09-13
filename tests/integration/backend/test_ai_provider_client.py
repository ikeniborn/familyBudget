"""
Unit tests for AIProviderClient (OpenAI-compatible GPU API wrapper).

Uses httpx.MockTransport via the client's transport test seam — no network.
Pins the provider contract from the intent/HLD:

1. list_models returns the entries from GET /models "data".
2. chat_completions extracts choices[0].message.content and sends Bearer auth.
3. transcribe posts WAV multipart and reads the custom {"text": ...} shape.
4. 503 is retried (cold start) and succeeds when the provider recovers.
5. 503 beyond the retry budget and 4xx errors raise AIProviderError.
"""

import httpx
import pytest

from backend.app.services import ai_provider_client as apc
from backend.app.services.ai_provider_client import AIProviderClient, AIProviderError

pytestmark = [pytest.mark.unit, pytest.mark.asyncio]

ENDPOINT = "https://gpu.test/v1"


def make_client(handler) -> AIProviderClient:
    return AIProviderClient(
        ENDPOINT, api_token="secret-token", transport=httpx.MockTransport(handler)
    )


async def test_list_models_returns_data_entries():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/v1/models"
        assert request.headers["Authorization"] == "Bearer secret-token"
        return httpx.Response(
            200,
            json={"data": [{"id": "qwen", "capabilities": ["chat"]}]},
        )

    models = await make_client(handler).list_models()
    assert models == [{"id": "qwen", "capabilities": ["chat"]}]


async def test_chat_completions_returns_content():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/v1/chat/completions"
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": "OK"}}]},
        )

    content = await make_client(handler).chat_completions(
        model="qwen", messages=[{"role": "user", "content": "hi"}]
    )
    assert content == "OK"


async def test_transcribe_posts_wav_and_reads_text():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/v1/audio/transcriptions"
        body = request.read()
        assert b"audio.wav" in body
        assert b"whisper-large-v3" in body
        return httpx.Response(200, json={"text": "привет"})

    text = await make_client(handler).transcribe(
        b"RIFFfakewav", model="whisper-large-v3"
    )
    assert text == "привет"


async def test_503_retried_then_succeeds(monkeypatch):
    monkeypatch.setattr(apc, "RETRY_BACKOFF_SECONDS", (0.0, 0.0))
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if calls["n"] == 1:
            return httpx.Response(503, json={"error": "model_restore_in_progress"})
        return httpx.Response(200, json={"data": []})

    models = await make_client(handler).list_models()
    assert models == []
    assert calls["n"] == 2


async def test_503_exhausts_retries(monkeypatch):
    monkeypatch.setattr(apc, "RETRY_BACKOFF_SECONDS", (0.0, 0.0))
    monkeypatch.setattr(apc, "MAX_RETRIES_503", 1)

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, json={"error": "insufficient_memory"})

    with pytest.raises(AIProviderError) as exc_info:
        await make_client(handler).list_models()
    assert exc_info.value.status_code == 503


async def test_4xx_raises_without_retry():
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return httpx.Response(401, json={"error": "unauthorized"})

    with pytest.raises(AIProviderError) as exc_info:
        await make_client(handler).list_models()
    assert exc_info.value.status_code == 401
    assert calls["n"] == 1
