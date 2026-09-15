/**
 * AI analytics chat (ai-analytics-chat, ai-analytics-chat-history).
 *
 * Standalone IIFE bundle for analytics.html. Reveals the chat card when
 * GET /api/v1/ai/status reports the text slot; a question (typed or
 * dictated) goes to POST /api/v1/ai/analytics-chat, which computes the
 * aggregates server-side and returns a grounded answer. Each question is
 * independent (no conversation state). Exchanges are persisted server-side
 * (t_f_ai_chat_log): the last ones replay into the chat on load, and the
 * «История» panel lists the recent ones from
 * GET /api/v1/ai/analytics-chat/history.
 */

/* global MediaRecorder */

interface ChatResponse {
    answer: string;
    period_start: string;
    period_end: string;
    record_type: 'fact' | 'plan';
    expense_total: number;
    income_total: number;
}

const STATUS_URL = '/api/v1/ai/status';
const CHAT_URL = '/api/v1/ai/analytics-chat';
const HISTORY_URL = '/api/v1/ai/analytics-chat/history';
const TRANSCRIBE_URL = '/api/v1/ai/transcribe';
const MAX_RECORDING_MS = 60_000;

let activeRecorder: MediaRecorder | null = null;
let recorderStopTimer: number | undefined;

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

function setStatus(message: string, isError = false): void {
    const status = el<HTMLElement>('ai-chat-status');
    if (status) {
        status.textContent = message;
        status.className = isError ? 'text-xs mt-1 text-error' : 'text-xs mt-1 text-base-content/70';
    }
}

// ==================== Lightweight markdown + history ====================

// How many past exchanges replay into the chat on page load, and how many
// the «История» panel lists.
const REPLAY_LIMIT = 5;
const HISTORY_PANEL_LIMIT = 20;

interface HistoryScope {
    period_start?: string;
    period_end?: string;
    record_type?: string;
    expense_total?: number;
    income_total?: number;
}

interface HistoryItem {
    id: number;
    question: string;
    answer: string | null;
    status: 'ok' | 'parse_error' | 'provider_error';
    scope: HistoryScope | null;
    created_at: string;
}

let historyPanelLoaded = false;

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/** Render the model's typical markdown subset (**bold**, "- " bullets)
 *  into safe HTML: everything is escaped first, then the two patterns
 *  are re-introduced as tags. */
function renderMarkdownLite(text: string): string {
    const bolded = escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    const lines = bolded.split('\n');
    const html: string[] = [];
    let listOpen = false;
    for (const line of lines) {
        const bullet = /^\s*[-•]\s+(.*)$/.exec(line);
        if (bullet) {
            if (!listOpen) {
                html.push('<ul class="list-disc list-inside my-1">');
                listOpen = true;
            }
            html.push(`<li>${bullet[1]}</li>`);
            continue;
        }
        if (listOpen) {
            html.push('</ul>');
            listOpen = false;
        }
        html.push(line.trim() === '' ? '<div class="h-2"></div>' : `<div>${line}</div>`);
    }
    if (listOpen) {
        html.push('</ul>');
    }
    return html.join('');
}

async function fetchHistory(limit: number): Promise<HistoryItem[]> {
    try {
        const response = await fetch(`${HISTORY_URL}?limit=${limit}`);
        if (!response.ok) {
            return [];
        }
        const data = (await response.json()) as { items?: HistoryItem[] };
        return Array.isArray(data.items) ? data.items : [];
    } catch {
        return [];
    }
}

function metaFromScope(scope: HistoryScope | null): string {
    if (!scope?.period_start || !scope.period_end) {
        return '';
    }
    return [
        `период ${isoToDisplay(scope.period_start)}–${isoToDisplay(scope.period_end)}`,
        scope.record_type === 'plan' ? 'план' : 'факт',
        `расход ${formatRub(scope.expense_total ?? 0)}`,
        (scope.income_total ?? 0) > 0 ? `доход ${formatRub(scope.income_total ?? 0)}` : '',
    ]
        .filter(Boolean)
        .join(' · ');
}

/** created_at is naive UTC from the backend — mark it so Date parses it
 *  as UTC and the display lands in the viewer's local time. */
function timestampToDisplay(createdAt: string): string {
    const iso = /Z|[+-]\d\d:\d\d$/.test(createdAt) ? createdAt : `${createdAt}Z`;
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) {
        return createdAt;
    }
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${pad(parsed.getDate())}.${pad(parsed.getMonth() + 1)}.${parsed.getFullYear()} ${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

function isoToDisplay(iso: string): string {
    const [year, month, day] = iso.split('-');
    return year && month && day ? `${day}.${month}.${year}` : iso;
}

function formatRub(value: number): string {
    return `${Math.round(value).toLocaleString('ru-RU')} ₽`;
}

function appendBubble(role: 'question' | 'answer', text: string, meta?: string): void {
    const log = el<HTMLElement>('ai-chat-log');
    if (!log) {
        return;
    }
    log.classList.remove('hidden');
    const bubble = document.createElement('div');
    if (role === 'question') {
        bubble.className = 'rounded-lg bg-primary/10 p-2 text-sm font-medium';
        bubble.style.whiteSpace = 'pre-wrap';
        bubble.textContent = text;
    } else {
        bubble.className = 'rounded-lg bg-base-200 p-2 text-sm';
        // Escaped first inside renderMarkdownLite — safe to assign.
        bubble.innerHTML = renderMarkdownLite(text);
    }
    if (meta) {
        const metaEl = document.createElement('div');
        metaEl.className = 'text-xs text-base-content/60 mt-1';
        metaEl.textContent = meta;
        bubble.appendChild(metaEl);
    }
    log.appendChild(bubble);
    log.scrollTop = log.scrollHeight;
}

async function ask(): Promise<void> {
    const input = el<HTMLInputElement>('ai-chat-input');
    const button = el<HTMLButtonElement>('ai-chat-send');
    const question = input?.value.trim() ?? '';
    if (!question) {
        setStatus('Задайте вопрос, например: «Какие затраты по продуктам за текущий месяц?»', true);
        return;
    }
    if (button) {
        button.disabled = true;
    }
    appendBubble('question', question);
    if (input) {
        input.value = '';
    }
    setStatus('Считаю и формулирую ответ…');
    try {
        const response = await fetch(CHAT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question }),
        });
        if (!response.ok) {
            const body: unknown = await response.json().catch(() => ({}));
            appendBubble('answer', `⚠ ${extractErrorMessage(body, response.status)}`);
            setStatus('');
            return;
        }
        const data = (await response.json()) as ChatResponse;
        const meta = [
            `период ${isoToDisplay(data.period_start)}–${isoToDisplay(data.period_end)}`,
            data.record_type === 'plan' ? 'план' : 'факт',
            `расход ${formatRub(data.expense_total)}`,
            data.income_total > 0 ? `доход ${formatRub(data.income_total)}` : '',
        ]
            .filter(Boolean)
            .join(' · ');
        appendBubble('answer', data.answer, meta);
        // The exchange is persisted server-side; refetch the panel next open.
        historyPanelLoaded = false;
        setStatus('');
    } catch {
        appendBubble('answer', '⚠ Сеть недоступна — попробуйте позже');
        setStatus('');
    } finally {
        if (button) {
            button.disabled = false;
        }
    }
}

// ==================== History panel ====================

function renderHistoryPanel(items: HistoryItem[]): void {
    const panel = el<HTMLElement>('ai-chat-history');
    if (!panel) {
        return;
    }
    panel.replaceChildren();
    if (items.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'text-xs text-base-content/60';
        empty.textContent = 'История пуста — задайте первый вопрос.';
        panel.appendChild(empty);
        return;
    }
    for (const item of items) {
        const entry = document.createElement('div');
        entry.className = 'rounded-lg bg-base-200 p-2 text-sm space-y-1';

        const header = document.createElement('div');
        header.className = 'text-xs text-base-content/60';
        header.textContent = timestampToDisplay(item.created_at);
        entry.appendChild(header);

        const question = document.createElement('div');
        question.className = 'font-medium';
        question.style.whiteSpace = 'pre-wrap';
        question.textContent = item.question;
        entry.appendChild(question);

        const answer = document.createElement('div');
        if (item.status === 'ok' && item.answer) {
            // Escaped first inside renderMarkdownLite — safe to assign.
            answer.innerHTML = renderMarkdownLite(item.answer);
            const meta = metaFromScope(item.scope);
            if (meta) {
                const metaEl = document.createElement('div');
                metaEl.className = 'text-xs text-base-content/60 mt-1';
                metaEl.textContent = meta;
                answer.appendChild(metaEl);
            }
        } else {
            answer.className = 'text-base-content/60';
            answer.textContent =
                item.status === 'provider_error'
                    ? '⚠ AI-провайдер был недоступен'
                    : '⚠ Вопрос не был понят';
        }
        entry.appendChild(answer);
        panel.appendChild(entry);
    }
}

async function toggleHistoryPanel(): Promise<void> {
    const panel = el<HTMLElement>('ai-chat-history');
    if (!panel) {
        return;
    }
    if (!panel.classList.contains('hidden')) {
        panel.classList.add('hidden');
        return;
    }
    panel.classList.remove('hidden');
    if (!historyPanelLoaded) {
        const loading = document.createElement('div');
        loading.className = 'text-xs text-base-content/60';
        loading.textContent = 'Загружаю историю…';
        panel.replaceChildren(loading);
        renderHistoryPanel(await fetchHistory(HISTORY_PANEL_LIMIT));
        historyPanelLoaded = true;
    }
}

// ==================== Voice ====================

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
        setStatus('Запись звука не поддерживается этим браузером', true);
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
            button.textContent = '🎤';
            const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
            void uploadRecording(blob);
        };
        activeRecorder = recorder;
        recorder.start();
        button.classList.add('btn-error');
        button.textContent = '⏹';
        setStatus('Говорите… (нажмите ⏹, чтобы закончить)');
        recorderStopTimer = window.setTimeout(stopRecording, MAX_RECORDING_MS);
    } catch {
        setStatus('Нет доступа к микрофону', true);
    }
}

async function uploadRecording(blob: Blob): Promise<void> {
    setStatus('Распознаю речь…');
    const formData = new FormData();
    const extension = blob.type.includes('mp4') ? 'm4a' : 'webm';
    formData.append('file', blob, `voice.${extension}`);
    try {
        const response = await fetch(TRANSCRIBE_URL, { method: 'POST', body: formData });
        if (!response.ok) {
            const body: unknown = await response.json().catch(() => ({}));
            setStatus(extractErrorMessage(body, response.status), true);
            return;
        }
        const data = (await response.json()) as { text: string };
        const text = data.text.trim();
        if (!text) {
            setStatus('Ничего не расслышал — попробуйте ещё раз', true);
            return;
        }
        const input = el<HTMLInputElement>('ai-chat-input');
        if (input) {
            input.value = text;
        }
        await ask();
    } catch {
        setStatus('Сеть недоступна — попробуйте позже', true);
    }
}

async function revealIfAvailable(): Promise<void> {
    if (!document.getElementById('ai-chat-card')) {
        return;
    }
    try {
        const response = await fetch(STATUS_URL);
        if (!response.ok) {
            return;
        }
        const status = (await response.json()) as { text: boolean; voice: boolean };
        if (status.text) {
            el<HTMLElement>('ai-chat-card')?.classList.remove('hidden');
            // Replay the last server-persisted exchanges (newest-first API
            // order reversed to chronological).
            const items = await fetchHistory(REPLAY_LIMIT);
            for (const item of items.reverse()) {
                if (item.status !== 'ok' || !item.answer) {
                    continue;
                }
                appendBubble('question', item.question);
                appendBubble('answer', item.answer, metaFromScope(item.scope));
            }
        }
        if (status.text && status.voice) {
            el<HTMLElement>('ai-chat-voice')?.classList.remove('hidden');
        }
    } catch {
        // AI unavailable — the card stays hidden, analytics unaffected.
    }
}

function init(): void {
    document.addEventListener('click', (event) => {
        const target = event.target as HTMLElement | null;
        if (target?.closest('#ai-chat-send')) {
            void ask();
            return;
        }
        if (target?.closest('#ai-chat-history-toggle')) {
            void toggleHistoryPanel();
            return;
        }
        const voiceButton = target?.closest<HTMLButtonElement>('#ai-chat-voice');
        if (voiceButton) {
            void handleVoice(voiceButton);
        }
    });
    document.addEventListener('keydown', (event) => {
        if (
            event.key === 'Enter' &&
            (event.target as HTMLElement | null)?.id === 'ai-chat-input'
        ) {
            event.preventDefault();
            void ask();
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
