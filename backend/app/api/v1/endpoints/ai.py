"""
AI module endpoints: admin settings, provider model discovery, health check.

All routes are admin-only in phase 1. User-facing AI endpoints
(parse-transaction, transcribe, parse-receipt, categorize-import) arrive in
later phases and will reuse the same settings + provider client.
"""
import io
import struct
import time
import wave

from fastapi import APIRouter, Depends, File, Request, UploadFile
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.dependencies import CurrentAdmin, CurrentUser, get_session
from backend.app.core.exceptions import (
    ServiceUnavailableException,
    UnprocessableEntityException,
)
from backend.app.middleware.rate_limiter import limiter
from backend.app.schemas.ai import (
    AIHealthCheckResponse,
    AIModelInfo,
    AIModelsResponse,
    AISettingsResponse,
    AISettingsUpdate,
    AIStatusResponse,
    ParseTransactionRequest,
    SlotHealth,
    TransactionDraft,
)
from backend.app.schemas.errors import get_common_responses
from backend.app.services import ai_settings_service, llm_parse_service, speech_service
from backend.app.services.ai_provider_client import AIProviderClient, AIProviderError
from backend.app.services.llm_parse_service import AIParseError
from backend.app.services.speech_service import SpeechError

router = APIRouter(prefix="/ai", tags=["AI"])

# 1x1 transparent PNG for the vision-slot canned check.
_TEST_PNG_BASE64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk"
    "YPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
)


def _settings_response(settings) -> AISettingsResponse:
    return AISettingsResponse(
        enabled=settings.enabled,
        endpoint_url=settings.endpoint_url,
        token_masked=ai_settings_service.mask_token(settings.api_token),
        model_text=settings.model_text,
        model_image=settings.model_image,
        model_voice=settings.model_voice,
        confidence_threshold=settings.confidence_threshold,
        updated_at=settings.updated_at,
    )


def _test_wav_bytes() -> bytes:
    """0.5 s of 16 kHz mono PCM16 silence — a valid RIFF/WAVE payload."""
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16000)
        wav.writeframes(struct.pack("<h", 0) * 8000)
    return buffer.getvalue()


@router.get(
    "/settings",
    response_model=AISettingsResponse,
    responses=get_common_responses(include_403=True),
)
async def get_ai_settings(
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session),
) -> AISettingsResponse:
    settings = await ai_settings_service.get_settings(session)
    return _settings_response(settings)


@router.put(
    "/settings",
    response_model=AISettingsResponse,
    responses=get_common_responses(include_403=True),
)
async def update_ai_settings(
    data: AISettingsUpdate,
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session),
) -> AISettingsResponse:
    settings = await ai_settings_service.update_settings(
        session, data, updated_by=current_admin.id
    )
    return _settings_response(settings)


@router.get(
    "/models",
    response_model=AIModelsResponse,
    responses=get_common_responses(include_403=True),
)
async def list_provider_models(
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session),
) -> AIModelsResponse:
    """Proxy the provider's live model list for the settings UI selects."""
    settings = await ai_settings_service.get_settings(session)
    client = AIProviderClient(settings.endpoint_url, settings.api_token)
    try:
        raw_models = await client.list_models()
    except AIProviderError as exc:
        raise ServiceUnavailableException(f"AI provider unavailable: {exc}")

    models = [
        AIModelInfo(
            id=entry.get("id", ""),
            capabilities=entry.get("capabilities", []) or [],
        )
        for entry in raw_models
        if entry.get("id")
    ]
    return AIModelsResponse(models=models)


@router.get("/status", response_model=AIStatusResponse)
async def ai_status(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> AIStatusResponse:
    """Which AI features are available; drives visibility of UI buttons."""
    settings = await ai_settings_service.get_settings_cached(session)
    return AIStatusResponse(
        enabled=settings.enabled,
        text=settings.enabled and bool(settings.model_text),
        image=settings.enabled and bool(settings.model_image),
        voice=settings.enabled and bool(settings.model_voice),
    )


@router.post(
    "/parse-transaction",
    response_model=TransactionDraft,
    responses=get_common_responses(include_422=True),
)
@limiter.limit("20/minute")
async def parse_transaction(
    request: Request,
    data: ParseTransactionRequest,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> TransactionDraft:
    """Parse a free-text phrase into a transaction draft (user confirms)."""
    settings = await ai_settings_service.get_settings_cached(session)
    if not settings.enabled or not settings.model_text:
        raise ServiceUnavailableException(
            "AI-функции выключены или текстовая модель не настроена"
        )
    try:
        return await llm_parse_service.parse_transaction_text(
            session, settings, data.text
        )
    except AIParseError:
        raise UnprocessableEntityException(f"Не понял: «{data.text}»")
    except AIProviderError as exc:
        raise ServiceUnavailableException(f"AI-провайдер недоступен: {exc}")


@router.post(
    "/transcribe",
    responses=get_common_responses(include_422=True),
)
@limiter.limit("10/minute")
async def transcribe(
    request: Request,
    current_user: CurrentUser,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
) -> dict[str, str]:
    """Transcribe a browser voice recording; audio is processed and discarded."""
    settings = await ai_settings_service.get_settings_cached(session)
    if not settings.enabled or not settings.model_voice:
        raise ServiceUnavailableException(
            "AI-функции выключены или голосовая модель не настроена"
        )
    data = await file.read()
    try:
        text = await speech_service.transcribe_audio(settings, data)
    except SpeechError as exc:
        raise UnprocessableEntityException(str(exc))
    except AIProviderError as exc:
        raise ServiceUnavailableException(f"AI-провайдер недоступен: {exc}")
    return {"text": text}


async def _check_text_slot(client: AIProviderClient, model: str) -> SlotHealth:
    started = time.monotonic()
    content = await client.chat_completions(
        model=model,
        messages=[{"role": "user", "content": "Reply with exactly: OK"}],
        max_tokens=16,
    )
    latency = int((time.monotonic() - started) * 1000)
    if not content.strip():
        return SlotHealth(status="error", latency_ms=latency, detail="Empty response")
    return SlotHealth(status="ok", latency_ms=latency)


async def _check_image_slot(client: AIProviderClient, model: str) -> SlotHealth:
    started = time.monotonic()
    content = await client.chat_completions(
        model=model,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Describe this image in one word."},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{_TEST_PNG_BASE64}"
                        },
                    },
                ],
            }
        ],
        max_tokens=32,
    )
    latency = int((time.monotonic() - started) * 1000)
    if not content.strip():
        return SlotHealth(status="error", latency_ms=latency, detail="Empty response")
    return SlotHealth(status="ok", latency_ms=latency)


async def _check_voice_slot(client: AIProviderClient, model: str) -> SlotHealth:
    started = time.monotonic()
    # Silence transcribes to empty/near-empty text; reaching the provider and
    # getting a JSON body back is the health signal here.
    await client.transcribe(_test_wav_bytes(), model=model)
    latency = int((time.monotonic() - started) * 1000)
    return SlotHealth(status="ok", latency_ms=latency)


@router.post(
    "/health-check",
    response_model=AIHealthCheckResponse,
    responses=get_common_responses(include_403=True),
)
async def health_check(
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session),
) -> AIHealthCheckResponse:
    """Probe each configured model slot with a built-in canned example."""
    settings = await ai_settings_service.get_settings(session)
    client = AIProviderClient(settings.endpoint_url, settings.api_token)

    async def run_slot(model: str | None, checker) -> SlotHealth:
        if not model:
            return SlotHealth(status="not_configured")
        try:
            return await checker(client, model)
        except AIProviderError as exc:
            return SlotHealth(status="error", detail=str(exc)[:300])

    return AIHealthCheckResponse(
        text=await run_slot(settings.model_text, _check_text_slot),
        image=await run_slot(settings.model_image, _check_image_slot),
        voice=await run_slot(settings.model_voice, _check_voice_slot),
    )
