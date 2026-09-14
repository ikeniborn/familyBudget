/**
 * AI bulk entry (ai-bulk-entry): the «Добавить с ИИ» FAB action.
 *
 * Standalone IIFE bundle loaded from base.html. Opens its own dialog
 * (modal_ai_bulk.html): text / voice / receipt photo -> POST
 * /api/v1/ai/parse-batch (or /parse-receipt for photos) -> an editable
 * table of fact/plan drafts, each row with its own type, date, amount,
 * category, account and description. Records are created via the normal
 * POST /api/v1/facts only after user confirmation — the LLM never writes
 * to the database.
 */

/* global MediaRecorder */

interface TransactionDraft {
    article_id: number;
    article_path: string;
    article_type: string;
    amount: number;
    fact_date: string;
    description: string | null;
    financial_center_id: number | null;
    financial_center_name: string | null;
    record_type: 'fact' | 'plan';
    confidence: 'high' | 'low';
    warnings: string[];
}

interface BatchDraft {
    items: TransactionDraft[];
    warnings: string[];
}

interface ReceiptItemDraft {
    name: string;
    amount: number;
    article_id: number | null;
    article_path: string | null;
    confidence: 'high' | 'low';
}

interface ReceiptDraft {
    store: string | null;
    receipt_date: string | null;
    items: ReceiptItemDraft[];
    total: number;
}

interface Option {
    id: number;
    name: string;
}

const STATUS_URL = '/api/v1/ai/status';
const BATCH_URL = '/api/v1/ai/parse-batch';
const RECEIPT_URL = '/api/v1/ai/parse-receipt';
const TRANSCRIBE_URL = '/api/v1/ai/transcribe';
const FACTS_URL = '/api/v1/facts';
const MAX_RECORDING_MS = 120_000;

let articleOptions: Option[] = [];
let centerOptions: Option[] = [];
let currentItems: TransactionDraft[] | null = null;
let activeRecorder: MediaRecorder | null = null;
let recorderStopTimer: number | undefined;

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
    }
    return `Ошибка ${status}`;
}

function el<T extends HTMLElement>(id: string): T | null {
    return document.getElementById(id) as T | null;
}

function setInputStatus(message: string, isError = false): void {
    const status = el<HTMLElement>('ai-bulk-input-status');
    if (status) {
        status.textContent = message;
        status.className = isError
            ? 'text-xs mt-1 text-error'
            : 'text-xs mt-1 text-base-content/70';
    }
}

function setResultStatus(message: string, isError = false): void {
    const status = el<HTMLElement>('ai-bulk-status');
    if (status) {
        status.textContent = message;
        status.className = isError ? 'text-xs text-error' : 'text-xs text-base-content/70';
    }
}

async function fetchList(url: string, key: string): Promise<Option[]> {
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) {
        return [];
    }
    const data: unknown = await response.json();
    const list = Array.isArray(data)
        ? data
        : ((data as Record<string, unknown>)[key] as Option[] | undefined) ?? [];
    return (list as Option[]).filter((o) => o && typeof o.id === 'number');
}

async function loadDictionaries(): Promise<void> {
    if (articleOptions.length === 0) {
        articleOptions = await fetchList('/api/v1/articles?limit=1000', 'articles');
    }
    if (centerOptions.length === 0) {
        centerOptions = await fetchList('/api/v1/financial-centers', 'financial_centers');
    }
}

function buildSelect(
    className: string,
    options: Option[],
    selectedId: number | null,
    index: number
): HTMLSelectElement {
    const select = document.createElement('select');
    select.className = className;
    select.dataset.index = String(index);
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '— выберите —';
    select.appendChild(placeholder);
    for (const option of options) {
        const optionEl = document.createElement('option');
        optionEl.value = String(option.id);
        optionEl.textContent = option.name;
        select.appendChild(optionEl);
    }
    if (selectedId !== null) {
        select.value = String(selectedId);
    }
    return select;
}

function isoToDisplay(iso: string): string {
    const [year, month, day] = iso.split('-');
    return year && month && day ? `${day}.${month}.${year}` : iso;
}

function fieldWrap(label: string, control: HTMLElement): HTMLElement {
    const wrap = document.createElement('div');
    const labelEl = document.createElement('div');
    labelEl.className = 'text-xs text-base-content/60 mb-1';
    labelEl.textContent = label;
    wrap.append(labelEl, control);
    return wrap;
}

/** Rewrite the collapsed one-line gist of a row from its current fields. */
function updateSummary(index: string): void {
    const pick = <T extends HTMLElement>(cls: string): T | null =>
        document.querySelector<T>(`.${cls}[data-index="${index}"]`);
    const summary = document.querySelector<HTMLElement>(
        `.ai-bulk-summary[data-index="${index}"]`
    );
    if (!summary) {
        return;
    }
    const typeValue = pick<HTMLSelectElement>('ai-bulk-type')?.value;
    const dateValue = pick<HTMLInputElement>('ai-bulk-date')?.value ?? '';
    const amount = pick<HTMLInputElement>('ai-bulk-amount')?.value || '?';
    const articleSelect = pick<HTMLSelectElement>('ai-bulk-article');
    const fcSelect = pick<HTMLSelectElement>('ai-bulk-fc');
    const articleName =
        articleSelect?.selectedOptions[0]?.value
            ? articleSelect.selectedOptions[0].textContent
            : '⚠ без категории';
    const fcName = fcSelect?.selectedOptions[0]?.value
        ? fcSelect.selectedOptions[0].textContent
        : '⚠ без счёта';
    summary.textContent = [
        typeValue === 'plan' ? '📅 План' : '💸 Факт',
        isoToDisplay(dateValue),
        `${amount} ₽`,
        articleName,
        fcName,
    ].join(' · ');
}

function renderItems(items: TransactionDraft[], warnings: string[]): void {
    currentItems = items;
    el<HTMLElement>('ai-bulk-input-step')?.classList.add('hidden');
    el<HTMLElement>('ai-bulk-result-step')?.classList.remove('hidden');

    const list = el<HTMLElement>('ai-bulk-list');
    if (!list) {
        return;
    }
    list.innerHTML = '';
    items.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'flex items-start gap-2';

        // The include checkbox lives OUTSIDE the <details> so toggling it
        // never expands/collapses the row.
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'checkbox checkbox-sm mt-4 ai-bulk-include';
        checkbox.checked = true;
        checkbox.dataset.index = String(index);

        const details = document.createElement('details');
        details.className = 'collapse collapse-arrow bg-base-200 rounded-lg flex-1';

        const summary = document.createElement('summary');
        summary.className = 'collapse-title text-sm min-h-0 py-3 pr-10 cursor-pointer';
        const summaryText = document.createElement('span');
        summaryText.className = 'ai-bulk-summary';
        summaryText.dataset.index = String(index);
        summary.appendChild(summaryText);

        const content = document.createElement('div');
        content.className = 'collapse-content';
        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-2 gap-2';

        const typeSelect = document.createElement('select');
        typeSelect.className = 'select select-bordered select-sm w-full ai-bulk-type';
        typeSelect.dataset.index = String(index);
        for (const [value, label] of [
            ['fact', '💸 Факт'],
            ['plan', '📅 План'],
        ] as const) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            typeSelect.appendChild(option);
        }
        typeSelect.value = item.record_type;

        const dateInput = document.createElement('input');
        dateInput.type = 'date';
        dateInput.className = 'input input-bordered input-sm w-full ai-bulk-date';
        dateInput.value = item.fact_date;
        dateInput.dataset.index = String(index);

        const amountInput = document.createElement('input');
        amountInput.type = 'number';
        amountInput.min = '1';
        amountInput.step = '1';
        amountInput.className = 'input input-bordered input-sm w-full ai-bulk-amount';
        amountInput.value = String(item.amount);
        amountInput.dataset.index = String(index);

        const articleSelect = buildSelect(
            'select select-bordered select-sm w-full ai-bulk-article',
            articleOptions,
            item.article_id,
            index
        );
        if (item.confidence === 'low') {
            articleSelect.classList.add('select-warning');
            articleSelect.title = 'Проверь категорию';
        }

        const fcSelect = buildSelect(
            'select select-bordered select-sm w-full ai-bulk-fc',
            centerOptions,
            item.financial_center_id,
            index
        );

        const descriptionInput = document.createElement('input');
        descriptionInput.type = 'text';
        descriptionInput.className =
            'input input-bordered input-sm w-full ai-bulk-description';
        descriptionInput.value = item.description ?? '';
        descriptionInput.maxLength = 1000;
        descriptionInput.dataset.index = String(index);

        grid.append(
            fieldWrap('Тип', typeSelect),
            fieldWrap('Дата', dateInput),
            fieldWrap('Сумма, ₽', amountInput),
            fieldWrap('Категория', articleSelect),
            fieldWrap('Счёт', fcSelect),
            fieldWrap('Описание', descriptionInput)
        );
        content.appendChild(grid);
        details.append(summary, content);
        row.append(checkbox, details);
        list.appendChild(row);
        updateSummary(String(index));
    });

    const rowWarnings = items.flatMap((i) => i.warnings);
    setResultStatus([...warnings, ...rowWarnings].join('; '));
}

async function parseTextInput(): Promise<void> {
    const textarea = el<HTMLTextAreaElement>('ai-bulk-text');
    const button = el<HTMLButtonElement>('ai-bulk-parse');
    const text = textarea?.value.trim() ?? '';
    if (!text) {
        setInputStatus('Опишите операции, например: «кофе 350, интернет 900 в октябре»', true);
        return;
    }
    if (button) {
        button.disabled = true;
    }
    setInputStatus('Разбираю…');
    try {
        const [response] = await Promise.all([
            fetch(BATCH_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text }),
            }),
            loadDictionaries(),
        ]);
        if (!response.ok) {
            const body: unknown = await response.json().catch(() => ({}));
            setInputStatus(extractErrorMessage(body, response.status), true);
            return;
        }
        const draft = (await response.json()) as BatchDraft;
        renderItems(draft.items, draft.warnings);
    } catch {
        setInputStatus('Сеть недоступна — попробуйте позже', true);
    } finally {
        if (button) {
            button.disabled = false;
        }
    }
}

async function parsePhoto(file: File): Promise<void> {
    setInputStatus('Распознаю чек…');
    try {
        const formData = new FormData();
        formData.append('file', file);
        const [response] = await Promise.all([
            fetch(RECEIPT_URL, { method: 'POST', body: formData }),
            loadDictionaries(),
        ]);
        if (!response.ok) {
            const body: unknown = await response.json().catch(() => ({}));
            setInputStatus(extractErrorMessage(body, response.status), true);
            return;
        }
        const receipt = (await response.json()) as ReceiptDraft;
        const today = new Date().toISOString().slice(0, 10);
        const items: TransactionDraft[] = receipt.items.map((item) => ({
            article_id: item.article_id ?? 0,
            article_path: item.article_path ?? '',
            article_type: 'expense',
            amount: item.amount,
            fact_date: receipt.receipt_date ?? today,
            description: receipt.store ? `${item.name} (${receipt.store})` : item.name,
            financial_center_id: null,
            financial_center_name: null,
            record_type: 'fact',
            confidence: item.confidence,
            warnings: [],
        }));
        if (items.length === 0) {
            setInputStatus('На чеке не распознано ни одной позиции', true);
            return;
        }
        renderItems(items, ['Выберите счёт для позиций чека']);
    } catch {
        setInputStatus('Сеть недоступна — попробуйте позже', true);
    }
}

async function createRecords(): Promise<void> {
    if (!currentItems) {
        return;
    }
    const button = el<HTMLButtonElement>('ai-bulk-create');
    if (button) {
        button.disabled = true;
    }

    let created = 0;
    let skipped = 0;
    let failed = 0;
    const rows = document.querySelectorAll<HTMLInputElement>('.ai-bulk-include');
    for (const checkbox of Array.from(rows)) {
        if (!checkbox.checked) {
            continue;
        }
        const index = checkbox.dataset.index ?? '';
        const pick = <T extends HTMLElement>(cls: string): T | null =>
            document.querySelector<T>(`.${cls}[data-index="${index}"]`);
        const recordType = pick<HTMLSelectElement>('ai-bulk-type')?.value || 'fact';
        const factDate = pick<HTMLInputElement>('ai-bulk-date')?.value || '';
        const amount = Number(pick<HTMLInputElement>('ai-bulk-amount')?.value || 0);
        const articleId = Number(pick<HTMLSelectElement>('ai-bulk-article')?.value || 0);
        const fcId = Number(pick<HTMLSelectElement>('ai-bulk-fc')?.value || 0);
        const description =
            pick<HTMLInputElement>('ai-bulk-description')?.value.trim() || null;
        if (!factDate || amount <= 0 || !articleId || !fcId) {
            skipped += 1;
            continue;
        }
        try {
            const response = await fetch(FACTS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    article_id: articleId,
                    fact_date: factDate,
                    amount,
                    description,
                    financial_center_id: fcId,
                    record_type: recordType,
                }),
            });
            if (response.ok) {
                created += 1;
                checkbox.checked = false;
                checkbox.parentElement?.classList.add('opacity-40');
            } else {
                failed += 1;
            }
        } catch {
            failed += 1;
        }
    }

    const parts = [`создано: ${created}`];
    if (skipped > 0) {
        parts.push(`пропущено (нет счёта/категории/суммы): ${skipped}`);
    }
    if (failed > 0) {
        parts.push(`ошибок: ${failed}`);
    }
    setResultStatus(parts.join(' · '), failed > 0 || skipped > 0);
    if (button) {
        button.disabled = false;
    }

    // Everything selected was saved — close the dialog, the job is done.
    if (created > 0 && failed === 0 && skipped === 0) {
        const toast = (
            window as unknown as { showToast?: (m: string, t?: string) => void }
        ).showToast;
        toast?.(`Создано записей: ${created}`, 'success');
        (document.getElementById('modal_ai_bulk') as HTMLDialogElement | null)?.close();
    }
}

// ==================== Voice recording ====================

function setVoiceLabel(button: HTMLButtonElement, recording: boolean): void {
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

async function handleVoice(button: HTMLButtonElement): Promise<void> {
    if (activeRecorder) {
        stopRecording();
        return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        setInputStatus('Запись звука не поддерживается этим браузером', true);
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
            setVoiceLabel(button, false);
            const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
            void uploadRecording(blob);
        };
        activeRecorder = recorder;
        recorder.start();
        button.classList.add('btn-error');
        setVoiceLabel(button, true);
        setInputStatus('Говорите… (нажмите ⏹, чтобы закончить)');
        recorderStopTimer = window.setTimeout(stopRecording, MAX_RECORDING_MS);
    } catch {
        setInputStatus('Нет доступа к микрофону', true);
    }
}

async function uploadRecording(blob: Blob): Promise<void> {
    setInputStatus('Распознаю речь (первый запуск может занять минуту)…');
    const formData = new FormData();
    const extension = blob.type.includes('mp4') ? 'm4a' : 'webm';
    formData.append('file', blob, `voice.${extension}`);
    try {
        const response = await fetch(TRANSCRIBE_URL, { method: 'POST', body: formData });
        if (!response.ok) {
            const body: unknown = await response.json().catch(() => ({}));
            setInputStatus(extractErrorMessage(body, response.status), true);
            return;
        }
        const data = (await response.json()) as { text: string };
        const text = data.text.trim();
        if (!text) {
            setInputStatus('Ничего не расслышал — попробуйте ещё раз', true);
            return;
        }
        const textarea = el<HTMLTextAreaElement>('ai-bulk-text');
        if (textarea) {
            textarea.value = textarea.value.trim()
                ? `${textarea.value.trim()}, ${text}`
                : text;
        }
        await parseTextInput();
    } catch {
        setInputStatus('Сеть недоступна — попробуйте позже', true);
    }
}

function openModal(): void {
    const dialog = document.getElementById('modal_ai_bulk') as HTMLDialogElement | null;
    if (!dialog) {
        return;
    }
    currentItems = null;
    el<HTMLElement>('ai-bulk-input-step')?.classList.remove('hidden');
    el<HTMLElement>('ai-bulk-result-step')?.classList.add('hidden');
    const textarea = el<HTMLTextAreaElement>('ai-bulk-text');
    if (textarea) {
        textarea.value = '';
    }
    const photoInput = el<HTMLInputElement>('ai-bulk-photo');
    if (photoInput) {
        photoInput.value = '';
    }
    setInputStatus('');
    setResultStatus('');
    dialog.showModal();
}

async function revealIfAvailable(): Promise<void> {
    if (!document.getElementById('modal_ai_bulk')) {
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
            image: boolean;
        };
        if (status.text) {
            document
                .querySelectorAll<HTMLElement>('.ai-bulk-fab-item')
                .forEach((item) => item.classList.remove('hidden'));
        }
        if (status.text && status.voice) {
            el<HTMLElement>('ai-bulk-voice')?.classList.remove('hidden');
        }
        if (status.text && status.image) {
            el<HTMLElement>('ai-bulk-photo-btn')?.classList.remove('hidden');
        }
    } catch {
        // AI unavailable — the buttons stay hidden, manual entry unaffected.
    }
}

function init(): void {
    (window as unknown as Record<string, unknown>).openAIBulkModal = openModal;
    document.addEventListener('click', (event) => {
        const target = event.target as HTMLElement | null;
        if (target?.closest('#ai-bulk-parse')) {
            void parseTextInput();
            return;
        }
        if (target?.closest('#ai-bulk-create')) {
            void createRecords();
            return;
        }
        if (target?.closest('#ai-bulk-back')) {
            el<HTMLElement>('ai-bulk-input-step')?.classList.remove('hidden');
            el<HTMLElement>('ai-bulk-result-step')?.classList.add('hidden');
            return;
        }
        if (target?.closest('#ai-bulk-photo-btn')) {
            el<HTMLInputElement>('ai-bulk-photo')?.click();
            return;
        }
        const voiceButton = target?.closest<HTMLButtonElement>('#ai-bulk-voice');
        if (voiceButton) {
            void handleVoice(voiceButton);
        }
    });
    document.addEventListener('change', (event) => {
        const target = event.target as HTMLInputElement | null;
        if (target?.id === 'ai-bulk-photo' && target.files?.[0]) {
            void parsePhoto(target.files[0]);
            return;
        }
        // Any edit inside an accordion row refreshes its collapsed gist.
        if (
            target?.dataset.index !== undefined &&
            target.className.includes('ai-bulk-') &&
            !target.className.includes('ai-bulk-include')
        ) {
            updateSummary(target.dataset.index);
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
