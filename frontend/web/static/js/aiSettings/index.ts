/**
 * AI Settings admin page (/admin/ai-settings).
 *
 * Loads current settings, fills the form, loads live model aliases from the
 * provider (via backend proxy), saves partial updates, and runs the per-slot
 * health check with canned examples. Admin-only page; API is cookie-JWT
 * authenticated like every other page bundle.
 */

interface AISettings {
    enabled: boolean;
    endpoint_url: string;
    token_masked: string | null;
    model_text: string | null;
    model_image: string | null;
    model_voice: string | null;
    confidence_threshold: number;
    updated_at: string;
}

interface AIModelInfo {
    id: string;
    capabilities: string[];
}

interface SlotHealth {
    status: 'ok' | 'error' | 'not_configured';
    latency_ms: number | null;
    detail: string | null;
}

interface HealthCheckResponse {
    text: SlotHealth;
    image: SlotHealth;
    voice: SlotHealth;
}

const API_BASE = '/api/v1/ai';
const MODEL_SLOTS = ['text', 'image', 'voice'] as const;
type ModelSlot = (typeof MODEL_SLOTS)[number];

function el<T extends HTMLElement>(id: string): T {
    const node = document.getElementById(id);
    if (!node) {
        throw new Error(`AI settings: element #${id} not found`);
    }
    return node as T;
}

function setStatus(message: string, isError = false): void {
    const status = el<HTMLElement>('ai-settings-status');
    status.textContent = message;
    status.className = isError
        ? 'text-sm text-error'
        : 'text-sm text-base-content/70';
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...init,
    });
    if (!response.ok) {
        let detail = `HTTP ${response.status}`;
        try {
            const body = (await response.json()) as { message?: string; detail?: string };
            detail = body.message || body.detail || detail;
        } catch {
            /* keep the HTTP status as the message */
        }
        throw new Error(detail);
    }
    return (await response.json()) as T;
}

function fillForm(settings: AISettings): void {
    el<HTMLInputElement>('ai-enabled').checked = settings.enabled;
    el<HTMLInputElement>('ai-endpoint').value = settings.endpoint_url;
    el<HTMLInputElement>('ai-token').value = '';
    el<HTMLInputElement>('ai-token').placeholder = settings.token_masked
        ? `Сохранён: ${settings.token_masked} (оставьте пустым, чтобы не менять)`
        : 'Bearer-токен провайдера';
    el<HTMLInputElement>('ai-threshold').value = String(settings.confidence_threshold);
    for (const slot of MODEL_SLOTS) {
        setSelectValue(slot, settings[`model_${slot}`]);
    }
}

function makeOption(label: string, value: string): HTMLOptionElement {
    const option = document.createElement('option');
    option.textContent = label;
    option.value = value;
    return option;
}

function setSelectValue(slot: ModelSlot, value: string | null): void {
    const select = el<HTMLSelectElement>(`ai-model-${slot}`);
    if (value && !Array.from(select.options).some((o) => o.value === value)) {
        // Keep the stored alias visible even before the live list loads.
        select.add(makeOption(value, value));
    }
    select.value = value ?? '';
}

function fillModelSelects(models: AIModelInfo[]): void {
    for (const slot of MODEL_SLOTS) {
        const select = el<HTMLSelectElement>(`ai-model-${slot}`);
        const current = select.value;
        select.innerHTML = '';
        select.add(makeOption('— не выбрана —', ''));
        for (const model of models) {
            const caps = model.capabilities.length
                ? ` (${model.capabilities.join(', ')})`
                : '';
            select.add(makeOption(`${model.id}${caps}`, model.id));
        }
        setSelectValue(slot, current || null);
    }
}

async function loadSettings(): Promise<void> {
    const settings = await apiFetch<AISettings>('/settings');
    fillForm(settings);
}

async function loadModels(): Promise<void> {
    const button = el<HTMLButtonElement>('ai-load-models');
    button.disabled = true;
    setStatus('Загружаю список моделей…');
    try {
        const data = await apiFetch<{ models: AIModelInfo[] }>('/models');
        fillModelSelects(data.models);
        setStatus(`Моделей доступно: ${data.models.length}`);
    } catch (error) {
        setStatus(`Не удалось получить модели: ${(error as Error).message}`, true);
    } finally {
        button.disabled = false;
    }
}

async function saveSettings(): Promise<void> {
    const button = el<HTMLButtonElement>('ai-save');
    button.disabled = true;
    setStatus('Сохраняю…');

    const payload: Record<string, unknown> = {
        enabled: el<HTMLInputElement>('ai-enabled').checked,
        endpoint_url: el<HTMLInputElement>('ai-endpoint').value.trim(),
        model_text: el<HTMLSelectElement>('ai-model-text').value || null,
        model_image: el<HTMLSelectElement>('ai-model-image').value || null,
        model_voice: el<HTMLSelectElement>('ai-model-voice').value || null,
        confidence_threshold: Number(el<HTMLInputElement>('ai-threshold').value),
    };
    // Omitted token keeps the stored one; the explicit clear goes through
    // the dedicated button which sends an empty string.
    const token = el<HTMLInputElement>('ai-token').value.trim();
    if (token) {
        payload.api_token = token;
    }

    try {
        const settings = await apiFetch<AISettings>('/settings', {
            method: 'PUT',
            body: JSON.stringify(payload),
        });
        fillForm(settings);
        setStatus('Настройки сохранены.');
    } catch (error) {
        setStatus(`Ошибка сохранения: ${(error as Error).message}`, true);
    } finally {
        button.disabled = false;
    }
}

async function clearToken(): Promise<void> {
    try {
        const settings = await apiFetch<AISettings>('/settings', {
            method: 'PUT',
            body: JSON.stringify({ api_token: '' }),
        });
        fillForm(settings);
        setStatus('Токен удалён.');
    } catch (error) {
        setStatus(`Ошибка удаления токена: ${(error as Error).message}`, true);
    }
}

function renderSlotHealth(slot: ModelSlot, health: SlotHealth): void {
    const badge = el<HTMLElement>(`ai-health-${slot}`);
    const labels: Record<SlotHealth['status'], [string, string]> = {
        ok: ['badge-success', 'OK'],
        error: ['badge-error', 'Ошибка'],
        not_configured: ['badge-ghost', 'Не настроено'],
    };
    const [badgeClass, label] = labels[health.status];
    badge.className = `badge ${badgeClass}`;
    badge.textContent = health.latency_ms !== null
        ? `${label} · ${health.latency_ms} мс`
        : label;
    el<HTMLElement>(`ai-health-${slot}-detail`).textContent = health.detail ?? '';
}

async function runHealthCheck(): Promise<void> {
    const button = el<HTMLButtonElement>('ai-health-check');
    button.disabled = true;
    setStatus('Проверяю доступность (холодный старт модели может занять минуты)…');
    try {
        const result = await apiFetch<HealthCheckResponse>('/health-check', {
            method: 'POST',
        });
        for (const slot of MODEL_SLOTS) {
            renderSlotHealth(slot, result[slot]);
        }
        setStatus('Проверка завершена.');
    } catch (error) {
        setStatus(`Проверка не удалась: ${(error as Error).message}`, true);
    } finally {
        button.disabled = false;
    }
}

function init(): void {
    el<HTMLButtonElement>('ai-save').addEventListener('click', () => {
        void saveSettings();
    });
    el<HTMLButtonElement>('ai-load-models').addEventListener('click', () => {
        void loadModels();
    });
    el<HTMLButtonElement>('ai-health-check').addEventListener('click', () => {
        void runHealthCheck();
    });
    el<HTMLButtonElement>('ai-clear-token').addEventListener('click', () => {
        void clearToken();
    });

    loadSettings().catch((error: Error) => {
        setStatus(`Не удалось загрузить настройки: ${error.message}`, true);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export {};
