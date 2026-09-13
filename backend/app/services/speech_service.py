"""
Speech service: client audio (webm/ogg/mp4) -> WAV 16 kHz mono -> STT text.

The provider's /audio/transcriptions accepts WAV only (RIFF-checked), so the
browser uploads whatever MediaRecorder produced and the conversion happens
here via the static ffmpeg binary shipped by imageio-ffmpeg (works in the
distroless runtime image, which has no package manager).

Audio is processed in memory and discarded — never persisted (family
privacy, hard constraint of the intent).
"""
import asyncio
import logging

import imageio_ffmpeg

from backend.app.models.ai_settings import AISettings
from backend.app.services.ai_provider_client import AIProviderClient

logger = logging.getLogger(__name__)

MAX_UPLOAD_BYTES = 15 * 1024 * 1024   # raw client recording
MAX_WAV_BYTES = 50 * 1024 * 1024      # provider hard limit
FFMPEG_TIMEOUT_SECONDS = 60


class SpeechError(Exception):
    """Audio conversion or validation failed (user-facing, honest)."""


async def convert_to_wav(data: bytes) -> bytes:
    """Convert arbitrary browser audio to WAV 16 kHz mono PCM16."""
    if data.startswith(b"RIFF"):
        return data

    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    process = await asyncio.create_subprocess_exec(
        ffmpeg,
        "-hide_banner",
        "-loglevel", "error",
        "-i", "pipe:0",
        "-f", "wav",
        "-ar", "16000",
        "-ac", "1",
        "-acodec", "pcm_s16le",
        "pipe:1",
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await asyncio.wait_for(
            process.communicate(input=data), timeout=FFMPEG_TIMEOUT_SECONDS
        )
    except asyncio.TimeoutError:
        process.kill()
        raise SpeechError("Конвертация аудио заняла слишком долго")

    if process.returncode != 0 or not stdout:
        logger.warning(
            "ffmpeg conversion failed rc=%s stderr=%s",
            process.returncode,
            (stderr or b"")[:200],
        )
        raise SpeechError("Не удалось обработать аудиозапись — неподдерживаемый формат")
    return stdout


async def transcribe_audio(
    settings: AISettings, data: bytes, language: str = "ru"
) -> str:
    """Validate size, convert to WAV, and transcribe via the voice model."""
    if not data:
        raise SpeechError("Пустая аудиозапись")
    if len(data) > MAX_UPLOAD_BYTES:
        raise SpeechError("Аудиозапись слишком большая (лимит 15 МБ)")

    wav = await convert_to_wav(data)
    if len(wav) > MAX_WAV_BYTES:
        raise SpeechError("Аудиозапись слишком длинная")

    client = AIProviderClient(settings.endpoint_url, settings.api_token)
    return await client.transcribe(
        wav, model=settings.model_voice or "", language=language
    )
