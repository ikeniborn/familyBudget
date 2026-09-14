/**
 * AI quick-add for the fact modal (phase 2 of ai-assisted-transaction-input).
 *
 * Standalone IIFE bundle shared by every page that renders the modal_fact
 * macro (dashboard, facts, plan). The block inside fact_transaction_tab.html
 * stays hidden until GET /api/v1/ai/status reports the text slot available;
 * clicking "Разобрать" sends the phrase to POST /api/v1/ai/parse-transaction
 * and fills the surrounding form with the returned draft. The user still
 * confirms with the normal save button — nothing is created automatically.
 */

/* global MediaRecorder */

interface TransactionDraft {
    article_id: number;
    article_path: string;
    article_type: string;
    amount: number | null;
    fact_date: string;
    description: string | null;
    financial_center_id: number | null;
    financial_center_name: string | null;
    record_type: 'fact' | 'plan';
    confidence: 'high' | 'low';
    warnings: string[];
}

const STATUS_URL = '/api/v1/ai/status';
const PARSE_URL = '/api/v1/ai/parse-transaction';

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
const TRANSCRIBE_URL = '/api/v1/ai/transcribe';
const MAX_RECORDING_MS = 120_000;

let activeRecorder: MediaRecorder | null = null;
let recorderStopTimer: number | undefined;

function isoToDisplayDate(iso: string): string {
    const [year, month, day] = iso.split('-');
    return `${day}.${month}.${year}`;
}

function setResult(block: HTMLElement, message: string, isError = false): void {
    const result = block.querySelector<HTMLElement>('.ai-quickadd-result');
    if (result) {
        result.textContent = message;
        result.className = isError
            ? 'ai-quickadd-result text-xs mt-1 text-error'
            : 'ai-quickadd-result text-xs mt-1 text-base-content/70';
    }
}

function waitForOption(
    select: HTMLSelectElement,
    value: string,
    timeoutMs = 3000
): Promise<boolean> {
    return new Promise((resolve) => {
        const started = Date.now();
        const tick = (): void => {
            const found = Array.from(select.options).some((o) => o.value === value);
            if (found) {
                resolve(true);
                return;
            }
            if (Date.now() - started > timeoutMs) {
                resolve(false);
                return;
            }
            window.setTimeout(tick, 100);
        };
        tick();
    });
}

interface CategoryWidget {
    setSelectedCategory(id: number): Promise<void>;
    getSelectedCategory(): { id: number } | null;
    waitForReady?(): Promise<void>;
}

/** The plan modal keeps its own widget instance (planCategoryTreeSelect);
 *  the fact modal uses transactionCategoryTreeSelect. */
function isPlanForm(form: HTMLFormElement): boolean {
    return (
        form.querySelector<HTMLInputElement>('input[name="context"]')?.value ===
        'plan'
    );
}

function resolveCategoryWidget(form: HTMLFormElement): CategoryWidget | undefined {
    const w = window as unknown as {
        transactionCategoryTreeSelect?: CategoryWidget;
        planCategoryTreeSelect?: CategoryWidget;
    };
    return isPlanForm(form) ? w.planCategoryTreeSelect : w.transactionCategoryTreeSelect;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/** Set the parsed category and make it STICK.
 *
 *  The category control is the ChoicesCategoryTree widget
 *  (window.transactionCategoryTreeSelect); writing into the raw hidden
 *  <select> does not update it. Worse, our own account-change event kicks
 *  off an async updateFinancialCenter() which, in mode='create' on the
 *  initial account selection, force-clears any selection after reloading
 *  the option list — a race that silently erases a value set once.
 *  So: retry the set until it survives a settle window unchanged. */
async function trySetCategory(
    form: HTMLFormElement,
    draft: TransactionDraft
): Promise<boolean> {
    const widget = resolveCategoryWidget(form);
    const target = String(draft.article_id);
    const articleSelect = form.querySelector<HTMLSelectElement>(
        'select[name="article_id"]'
    );

    const isHeld = (): boolean =>
        widget
            ? widget.getSelectedCategory()?.id === draft.article_id
            : articleSelect?.value === target;

    for (let attempt = 0; attempt < 8; attempt++) {
        if (widget?.setSelectedCategory) {
            try {
                await widget.waitForReady?.();
                await widget.setSelectedCategory(draft.article_id);
            } catch {
                /* option list may still be reloading — retry below */
            }
        } else if (articleSelect) {
            const ok = await waitForOption(articleSelect, target, 1000);
            if (ok) {
                articleSelect.value = target;
                articleSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
        } else {
            return false;
        }

        // Survive one settle window: background category reloads (account /
        // type change handlers) clear the selection when they finish.
        await sleep(400);
        if (isHeld()) {
            await sleep(300);
            if (isHeld()) {
                return true;
            }
        }
    }
    return false;
}

async function fillForm(form: HTMLFormElement, draft: TransactionDraft): Promise<string[]> {
    const issues: string[] = [...draft.warnings];

    // 1. Operation type — click the styled radio label so existing widget
    //    logic (colors, category filtering) reacts as if the user clicked.
    const typeValue = draft.article_type === 'income' ? 'income' : 'expense';
    const typeLabel = form.querySelector<HTMLElement>(
        `.transaction-type-btn[data-type="${typeValue}"]`
    );
    typeLabel?.click();

    // 2. Financial center; change event triggers the category reload.
    const fcSelect = form.querySelector<HTMLSelectElement>(
        'select[name="financial_center_id"]'
    );
    if (fcSelect && draft.financial_center_id !== null) {
        fcSelect.value = String(draft.financial_center_id);
        fcSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // 3. Plain fields first — they have no async reload interplay.
    //    The fact form has a date input; the plan form has month-period
    //    buttons instead (offset 0..2 from the current month).
    const dateInput = form.querySelector<HTMLInputElement>('input[name="fact_date"]');
    if (dateInput) {
        dateInput.value = isoToDisplayDate(draft.fact_date);
        dateInput.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (isPlanForm(form)) {
        const now = new Date();
        const [draftYear, draftMonth] = draft.fact_date.split('-').map(Number);
        const offset =
            (draftYear - now.getFullYear()) * 12 + (draftMonth - 1 - now.getMonth());
        if (offset >= 0 && offset <= 2) {
            form.querySelector<HTMLElement>(
                `.period-btn[data-offset="${offset}"]`
            )?.click();
        } else if (offset !== 0) {
            issues.push('Период вне доступных месяцев — выберите вручную');
        }
    }
    const amountInput = form.querySelector<HTMLInputElement>('input[name="amount"]');
    if (amountInput && draft.amount !== null) {
        amountInput.value = String(draft.amount);
        amountInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const descriptionInput = form.querySelector<HTMLTextAreaElement>(
        'textarea[name="description"]'
    );
    if (descriptionInput && draft.description) {
        descriptionInput.value = draft.description;
    }

    // 4. Category LAST. The account change above kicked off an async
    //    category reload whose network fetch can take seconds and clears
    //    the selection when it lands — give it a head start, then set the
    //    category and keep a guard re-applying it if a late reload wipes it.
    await sleep(800);
    const categorySet = await trySetCategory(form, draft);
    if (categorySet) {
        startCategoryGuard(form, draft);
    } else {
        issues.push(
            `Категория «${draft.article_path}» не подставилась (возможно, не привязана к счёту) — выберите вручную`
        );
        // Retry once automatically after the user picks an account: the
        // category widget reloads its options on account change.
        const fcSelectForRetry = form.querySelector<HTMLSelectElement>(
            'select[name="financial_center_id"]'
        );
        fcSelectForRetry?.addEventListener(
            'change',
            () => {
                window.setTimeout(() => {
                    void trySetCategory(form, draft);
                }, 500);
            },
            { once: true }
        );
    }

    return issues;
}

/** Late background reloads (slow updateFinancialCenter fetch) can still wipe
 *  the selection AFTER trySetCategory confirmed it. Watch for ~6 s and
 *  re-apply; reloads are finite, so the last write wins. */
function startCategoryGuard(form: HTMLFormElement, draft: TransactionDraft): void {
    const widget = resolveCategoryWidget(form);
    const articleSelect = form.querySelector<HTMLSelectElement>(
        'select[name="article_id"]'
    );
    const target = String(draft.article_id);
    let ticks = 0;
    const timer = window.setInterval(() => {
        ticks += 1;
        if (ticks > 12) {
            window.clearInterval(timer);
            return;
        }
        const held = widget
            ? widget.getSelectedCategory()?.id === draft.article_id
            : articleSelect?.value === target;
        if (!held) {
            if (widget?.setSelectedCategory) {
                void widget.setSelectedCategory(draft.article_id);
            } else if (articleSelect) {
                articleSelect.value = target;
                articleSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    }, 500);
}

async function handleParseClick(button: HTMLButtonElement): Promise<void> {
    const block = button.closest<HTMLElement>('.ai-quickadd');
    const form = button.closest<HTMLFormElement>('form');
    if (!block || !form) {
        return;
    }
    const input = block.querySelector<HTMLInputElement>('.ai-quickadd-input');
    const text = input?.value.trim() ?? '';
    if (!text) {
        setResult(block, 'Введите фразу, например: «кофе 350»', true);
        return;
    }

    button.disabled = true;
    setResult(block, 'Разбираю…');
    try {
        const response = await fetch(PARSE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
        });
        if (!response.ok) {
            const body: unknown = await response.json().catch(() => ({}));
            setResult(block, extractErrorMessage(body, response.status), true);
            return;
        }
        const draft = (await response.json()) as TransactionDraft;
        const issues = await fillForm(form, draft);
        const summary =
            draft.amount !== null
                ? `→ ${draft.article_path} · ${draft.amount} ₽`
                : `→ ${draft.article_path}`;
        if (issues.length > 0) {
            setResult(block, `${summary} · ⚠ ${issues.join('; ')}`, draft.confidence === 'low');
        } else {
            setResult(block, summary);
        }
    } catch {
        setResult(block, 'Сеть недоступна — попробуйте позже', true);
    } finally {
        button.disabled = false;
    }
}

/** Keep the sm:hidden label span so the button stays icon-only on mobile. */
function setVoiceButtonLabel(button: HTMLButtonElement, recording: boolean): void {
    button.innerHTML = recording
        ? '⏹ <span class="hidden sm:inline">Стоп</span>'
        : '🎤 <span class="hidden sm:inline">Голос</span>';
}

function stopRecording(): void {
    if (activeRecorder && activeRecorder.state !== 'inactive') {
        activeRecorder.stop();
    }
    window.clearTimeout(recorderStopTimer);
}

async function uploadRecording(block: HTMLElement, blob: Blob): Promise<void> {
    setResult(block, 'Распознаю речь (первый запуск может занять минуту)…');
    const formData = new FormData();
    const extension = blob.type.includes('mp4') ? 'm4a' : 'webm';
    formData.append('file', blob, `voice.${extension}`);
    try {
        const response = await fetch(TRANSCRIBE_URL, { method: 'POST', body: formData });
        if (!response.ok) {
            const body: unknown = await response.json().catch(() => ({}));
            setResult(block, extractErrorMessage(body, response.status), true);
            return;
        }
        const data = (await response.json()) as { text: string };
        const input = block.querySelector<HTMLInputElement>('.ai-quickadd-input');
        if (input) {
            input.value = data.text;
        }
        if (data.text.trim()) {
            const parseButton = block.querySelector<HTMLButtonElement>('.ai-quickadd-btn');
            if (parseButton) {
                await handleParseClick(parseButton);
            }
        } else {
            setResult(block, 'Ничего не расслышал — попробуйте ещё раз', true);
        }
    } catch {
        setResult(block, 'Сеть недоступна — попробуйте позже', true);
    }
}

async function handleVoiceClick(button: HTMLButtonElement): Promise<void> {
    const block = button.closest<HTMLElement>('.ai-quickadd');
    if (!block) {
        return;
    }
    if (activeRecorder) {
        // Second tap stops the active recording.
        stopRecording();
        return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        setResult(block, 'Запись звука не поддерживается этим браузером', true);
        return;
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        const chunks: Blob[] = [];
        recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                chunks.push(event.data);
            }
        };
        recorder.onstop = () => {
            stream.getTracks().forEach((track) => track.stop());
            activeRecorder = null;
            button.classList.remove('btn-error');
            setVoiceButtonLabel(button, false);
            const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
            void uploadRecording(block, blob);
        };
        activeRecorder = recorder;
        recorder.start();
        button.classList.add('btn-error');
        setVoiceButtonLabel(button, true);
        setResult(block, 'Говорите… (нажмите ⏹, чтобы закончить)');
        recorderStopTimer = window.setTimeout(stopRecording, MAX_RECORDING_MS);
    } catch {
        setResult(block, 'Нет доступа к микрофону', true);
    }
}

async function revealIfAvailable(): Promise<void> {
    const blocks = document.querySelectorAll<HTMLElement>('.ai-quickadd');
    if (blocks.length === 0) {
        return;
    }
    try {
        const response = await fetch(STATUS_URL);
        if (!response.ok) {
            return;
        }
        const status = (await response.json()) as {
            text: boolean;
            voice: boolean;
        };
        if (status.text) {
            blocks.forEach((b) => b.classList.remove('hidden'));
        }
        if (status.text && status.voice) {
            document
                .querySelectorAll<HTMLElement>('.ai-voice-btn')
                .forEach((b) => b.classList.remove('hidden'));
        }
    } catch {
        // AI unavailable — blocks stay hidden, manual entry unaffected.
    }
}

function init(): void {
    document.addEventListener('click', (event) => {
        const target = event.target as HTMLElement | null;
        const button = target?.closest<HTMLButtonElement>('.ai-quickadd-btn');
        if (button) {
            void handleParseClick(button);
            return;
        }
        const voiceButton = target?.closest<HTMLButtonElement>('.ai-voice-btn');
        if (voiceButton) {
            void handleVoiceClick(voiceButton);
        }
    });
    void revealIfAvailable();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export {};
