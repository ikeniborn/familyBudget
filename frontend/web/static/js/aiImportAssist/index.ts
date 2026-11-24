/**
 * AI import assist (phase 4 of ai-assisted-transaction-input).
 *
 * On the import page (/admin/import) the "Подобрать категории с ИИ" button asks
 * POST /api/v1/ai/categorize-import for article suggestions covering the
 * eligible rows in the current preview, applies the high-confidence ones via
 * the normal PATCH /api/v1/staging/{id}, and reports the rest for manual
 * choice. Import itself still goes through the usual confirmation step, and
 * a missing/failed AI never blocks it.
 */

interface CategorySuggestion {
    staging_id: number;
    article_id: number;
    article_path: string;
    confidence: 'high' | 'low';
}

interface CategorizeResponse {
    suggestions: CategorySuggestion[];
    processed: number;
    unmatched: number;
}

declare global {
    interface Window {
        getImportAiStagingIds(): number[];
        loadStagingTable(): Promise<void>;
    }
}

const STATUS_URL = '/api/v1/ai/status';
const CATEGORIZE_URL = '/api/v1/ai/categorize-import';

/** Backend error envelope is {"detail": {"message": ...}} (APIException)
 *  or {"detail": "..."} (plain FastAPI); extract a human-readable string. */
function extractErrorMessage(body: unknown, status: number): string {
    if (body && typeof body === 'object') {
        const detail = (body as { detail?: unknown }).detail;
        if (detail && typeof detail === 'object') {
            const message = (detail as { message?: unknown }).message;
            if (typeof message === 'string' && message) {
                return message;
            }
        }
        if (typeof detail === 'string' && detail) {
            return detail;
        }
        const message = (body as { message?: unknown }).message;
        if (typeof message === 'string' && message) {
            return message;
        }
    }
    return `Ошибка ${status}`;
}

function setStatus(message: string, isError = false): void {
    const status = document.getElementById('ai-categorize-status');
    if (status) {
        status.textContent = message;
        status.className = isError
            ? 'text-xs text-error'
            : 'text-xs text-base-content/70';
    }
}

async function applySuggestion(suggestion: CategorySuggestion): Promise<boolean> {
    try {
        const response = await fetch(`/api/v1/staging/${suggestion.staging_id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ article_id: suggestion.article_id }),
        });
        return response.ok;
    } catch {
        return false;
    }
}

async function categorize(button: HTMLButtonElement): Promise<void> {
    const stagingIds = window.getImportAiStagingIds();
    if (stagingIds.length === 0) {
        setStatus('В текущем отборе нет строк для подбора категории');
        return;
    }
    button.disabled = true;
    setStatus('Подбираю категории…');
    try {
        const response = await fetch(CATEGORIZE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ staging_ids: stagingIds }),
        });
        if (!response.ok) {
            const body: unknown = await response.json().catch(() => ({}));
            setStatus(extractErrorMessage(body, response.status), true);
            return;
        }
        const data = (await response.json()) as CategorizeResponse;
        if (data.processed === 0) {
            setStatus('Нет строк без категории');
            return;
        }

        const high = data.suggestions.filter((s) => s.confidence === 'high');
        const low = data.suggestions.length - high.length;
        let applied = 0;
        for (const suggestion of high) {
            if (await applySuggestion(suggestion)) {
                applied += 1;
            }
        }

        const parts = [`Рекомендации: ${data.suggestions.length} из ${data.processed}`, `применено: ${applied}`];
        if (high.length > applied) parts.push(`не удалось сохранить: ${high.length - applied}`);
        if (low > 0) {
            parts.push(`неуверенных (проверь вручную): ${low}`);
        }
        if (data.unmatched > 0) {
            parts.push(`не распознано: ${data.unmatched}`);
        }
        setStatus(parts.join(' · '));

        if (applied > 0) await window.loadStagingTable();
    } catch {
        setStatus('Сеть недоступна — попробуйте позже', true);
    } finally {
        button.disabled = false;
    }
}

async function init(): Promise<void> {
    const button = document.getElementById('ai-categorize-btn') as
        | HTMLButtonElement
        | null;
    if (!button) {
        return;
    }
    try {
        const response = await fetch(STATUS_URL);
        if (!response.ok) throw new Error('Status unavailable');
        const status = (await response.json()) as { enabled: boolean; text: boolean };
        if (!status.text) {
            setStatus(status.enabled ? 'Текстовая модель не настроена' : 'ИИ выключен в настройках');
            document.getElementById('ai-categorize-settings')?.removeAttribute('hidden');
            return;
        }
        button.disabled = false;
        setStatus('');
        button.addEventListener('click', () => {
            void categorize(button);
        });
    } catch {
        setStatus('Не удалось проверить доступность ИИ', true);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        void init();
    });
} else {
    void init();
}

export {};
