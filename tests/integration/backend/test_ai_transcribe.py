"""
Tests for POST /api/v1/ai/transcribe and the WAV conversion pipeline.

Provider mocked at AIProviderClient.transcribe. Conversion is exercised for
both branches: RIFF passthrough (no ffmpeg) and a real ffmpeg round-trip
(WAV -> ogg/opus -> WAV) using the bundled imageio-ffmpeg binary.
"""
import asyncio
import io
import struct
import subprocess
import wave

import imageio_ffmpeg
import pytest
from httpx import AsyncClient

from backend.app.services import ai_settings_service, speech_service
from backend.app.services.ai_provider_client import AIProviderClient

pytestmark = [pytest.mark.integration, pytest.mark.destructive]


def make_wav(seconds: float = 0.3) -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16000)
        wav.writeframes(struct.pack("<h", 0) * int(16000 * seconds))
    return buffer.getvalue()


async def enable_voice(admin_client: AsyncClient) -> None:
    ai_settings_service.invalidate_cache()
    response = await admin_client.put(
        "/api/v1/ai/settings",
        json={"enabled": True, "model_voice": "whisper-large-v3"},
    )
    assert response.status_code == 200


def mock_transcribe(monkeypatch, text: str) -> None:
    async def fake_transcribe(self, wav_bytes, model, language="ru"):
        assert wav_bytes.startswith(b"RIFF")
        return text

    monkeypatch.setattr(AIProviderClient, "transcribe", fake_transcribe)


async def test_transcribe_disabled_returns_503(authenticated_client: AsyncClient):
    ai_settings_service.invalidate_cache()
    response = await authenticated_client.post(
        "/api/v1/ai/transcribe",
        files={"file": ("audio.wav", make_wav(), "audio/wav")},
    )
    assert response.status_code == 503


async def test_transcribe_wav_passthrough(
    authenticated_client: AsyncClient,
    authenticated_admin_client: AsyncClient,
    monkeypatch,
):
    await enable_voice(authenticated_admin_client)
    mock_transcribe(monkeypatch, "кофе триста пятьдесят")

    response = await authenticated_client.post(
        "/api/v1/ai/transcribe",
        files={"file": ("audio.wav", make_wav(), "audio/wav")},
    )
    assert response.status_code == 200
    assert response.json() == {"text": "кофе триста пятьдесят"}


async def test_transcribe_empty_file_is_422(
    authenticated_client: AsyncClient,
    authenticated_admin_client: AsyncClient,
):
    await enable_voice(authenticated_admin_client)
    response = await authenticated_client.post(
        "/api/v1/ai/transcribe",
        files={"file": ("audio.webm", b"", "audio/webm")},
    )
    assert response.status_code == 422


async def test_transcribe_garbage_audio_is_422(
    authenticated_client: AsyncClient,
    authenticated_admin_client: AsyncClient,
):
    await enable_voice(authenticated_admin_client)
    response = await authenticated_client.post(
        "/api/v1/ai/transcribe",
        files={"file": ("audio.webm", b"not-audio-at-all", "audio/webm")},
    )
    assert response.status_code == 422


def test_convert_roundtrip_via_ffmpeg():
    """WAV -> ogg/opus (browser-like) -> convert_to_wav produces RIFF."""
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    ogg = subprocess.run(
        [ffmpeg, "-hide_banner", "-loglevel", "error",
         "-f", "wav", "-i", "pipe:0", "-c:a", "libopus", "-f", "ogg", "pipe:1"],
        input=make_wav(0.5), capture_output=True, check=True,
    ).stdout
    assert not ogg.startswith(b"RIFF")

    wav = asyncio.get_event_loop().run_until_complete(
        speech_service.convert_to_wav(ogg)
    )
    assert wav.startswith(b"RIFF")
