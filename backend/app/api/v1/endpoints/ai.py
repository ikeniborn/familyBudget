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
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.dependencies import CurrentAdmin, CurrentUser, get_session
from backend.app.core.exceptions import (
    ServiceUnavailableException,
    UnprocessableEntityException,
)
from backend.app.middleware.rate_limiter import limiter
from backend.app.models.import_staging import ImportStaging
from backend.app.schemas.ai import (
    AIHealthCheckResponse,
    AIModelInfo,
    AIModelsResponse,
    AISettingsResponse,
    AISettingsUpdate,
    AIStatusResponse,
    AnalyticsChatRequest,
    AnalyticsChatResponse,
    BatchDraft,
    CategorizeImportRequest,
    CategorizeImportResponse,
    ImportCategorySuggestion,
    ListDraft,
    ParseBatchRequest,
    ParseListRequest,
    ParseTransactionRequest,
    ReceiptDraft,
    SlotHealth,
    TransactionDraft,
)
from backend.app.schemas.errors import get_common_responses
from backend.app.services import (
    ai_analytics_service,
    ai_settings_service,
    llm_parse_service,
    speech_service,
    vision_receipt_service,
)
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
    "/analytics-chat",
    response_model=AnalyticsChatResponse,
    responses=get_common_responses(include_422=True),
)
@limiter.limit("10/minute")
async def analytics_chat(
    request: Request,
    data: AnalyticsChatRequest,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> AnalyticsChatResponse:
    """Answer a budget question from backend-computed aggregates (read-only)."""
    settings = await ai_settings_service.get_settings_cached(session)
    if not settings.enabled or not settings.model_text:
        raise ServiceUnavailableException(
            "AI-функции выключены или текстовая модель не настроена"
        )
    try:
        result = await ai_analytics_service.answer_question(
            session, settings, data.question
        )
    except AIParseError:
        raise UnprocessableEntityException(
            "Не понял вопрос — уточните период или категорию"
        )
    except AIProviderError as exc:
        raise ServiceUnavailableException(f"AI-провайдер недоступен: {exc}")
    return AnalyticsChatResponse(**result)


@router.post(
    "/parse-batch",
    response_model=BatchDraft,
    responses=get_common_responses(include_422=True),
)
@limiter.limit("10/minute")
async def parse_batch(
    request: Request,
    data: ParseBatchRequest,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> BatchDraft:
    """Parse free text into a list of fact/plan drafts (bulk AI entry)."""
    settings = await ai_settings_service.get_settings_cached(session)
    if not settings.enabled or not settings.model_text:
        raise ServiceUnavailableException(
            "AI-функции выключены или текстовая модель не настроена"
        )
    try:
        return await llm_parse_service.parse_transactions_batch(
            session, settings, data.text
        )
    except AIParseError:
        raise UnprocessableEntityException(f"Не понял: «{data.text[:100]}»")
    except AIProviderError as exc:
        raise ServiceUnavailableException(f"AI-провайдер недоступен: {exc}")


@router.post(
    "/parse-list",
    response_model=ListDraft,
    responses=get_common_responses(include_422=True),
)
@limiter.limit("10/minute")
async def parse_list(
    request: Request,
    data: ParseListRequest,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> ListDraft:
    """Parse a free-text product enumeration into shopping list item drafts."""
    settings = await ai_settings_service.get_settings_cached(session)
    if not settings.enabled or not settings.model_text:
        raise ServiceUnavailableException(
            "AI-функции выключены или текстовая модель не настроена"
        )
    try:
        return await llm_parse_service.parse_shopping_list_text(
            session, settings, data.text
        )
    except AIParseError:
        raise UnprocessableEntityException(f"Не понял: «{data.text}»")
    except AIProviderError as exc:
        raise ServiceUnavailableException(f"AI-провайдер недоступен: {exc}")


@router.post(
    "/categorize-import",
    response_model=CategorizeImportResponse,
    responses=get_common_responses(include_422=True),
)
@limiter.limit("10/minute")
async def categorize_import(
    request: Request,
    data: CategorizeImportRequest,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> CategorizeImportResponse:
    """Suggest articles for the user's uncategorized staging rows.

    Read-only: suggestions are returned, the client applies the accepted
    ones through the normal staging PATCH endpoints.
    """
    settings = await ai_settings_service.get_settings_cached(session)
    if not settings.enabled or not settings.model_text:
        raise ServiceUnavailableException(
            "AI-функции выключены или текстовая модель не настроена"
        )

    stmt = select(ImportStaging).where(
        ImportStaging.user_id == current_user.id,
        ImportStaging.article_id == None,  # noqa: E711
    )
    if data.staging_ids:
        stmt = stmt.where(ImportStaging.id.in_(data.staging_ids))
    rows = (await session.execute(stmt.limit(100))).scalars().all()

    def staging_text(row: ImportStaging) -> str:
        """Description plus the bank's own CSV category — the strongest
        classification signal the file carries («Оксана Т.» alone is
        unclassifiable, with «категория банка: Переводы» it is not)."""
        parts = [
            p
            for p in (
                (row.description or "").strip(),
                (row.budget_description or "").strip(),
            )
            if p
        ]
        csv_category = str((row.csv_metadata or {}).get("category") or "").strip()
        if csv_category:
            parts.append(f"категория банка: {csv_category}")
        return " · ".join(parts)

    inputs = [
        {"id": row.id, "text": text}
        for row in rows
        if (text := staging_text(row))
    ]
    try:
        raw = await llm_parse_service.categorize_texts(session, settings, inputs)
    except AIProviderError as exc:
        raise ServiceUnavailableException(f"AI-провайдер недоступен: {exc}")

    suggestions = [
        ImportCategorySuggestion(
            staging_id=item["id"],
            article_id=item["article_id"],
            article_path=item["article_path"],
            confidence=(
                "high"
                if item["confidence_value"] >= settings.confidence_threshold
                else "low"
            ),
        )
        for item in raw
    ]
    return CategorizeImportResponse(
        suggestions=suggestions,
        processed=len(inputs),
        unmatched=len(inputs) - len(suggestions),
    )


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


@router.post(
    "/parse-receipt",
    response_model=ReceiptDraft,
    responses=get_common_responses(include_422=True),
)
@limiter.limit("10/minute")
async def parse_receipt(
    request: Request,
    current_user: CurrentUser,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
) -> ReceiptDraft:
    """Recognize a receipt photo into an editable expense draft.

    Read-only: the client creates facts through the normal POST /facts
    after the user edits and confirms the item table. The image is
    processed in memory and discarded.
    """
    settings = await ai_settings_service.get_settings_cached(session)
    if not settings.enabled or not settings.model_image:
        raise ServiceUnavailableException(
            "AI-функции выключены или модель изображений не настроена"
        )
    data = await file.read()
    try:
        return await vision_receipt_service.parse_receipt(
            session, settings, data, file.content_type or ""
        )
    except AIParseError as exc:
        raise UnprocessableEntityException(f"Не удалось распознать чек: {exc}")
    except AIProviderError as exc:
        raise ServiceUnavailableException(f"AI-провайдер недоступен: {exc}")


async def _check_text_slot(client: AIProviderClient, model: str) -> SlotHealth:
    started = time.monotonic()
    content = await client.chat_completions(
        model=model,
        messages=[{"role": "user", "content": "Reply with exactly: OK"}],
        # Reasoning models spend tokens thinking before the visible answer;
        # a tiny budget yields an empty content and a false "Empty response".
        max_tokens=512,
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
        max_tokens=512,
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
