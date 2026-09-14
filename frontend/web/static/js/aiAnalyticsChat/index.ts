/**
 * AI analytics chat (ai-analytics-chat).
 *
 * Standalone IIFE bundle for analytics.html. Reveals the chat card when
 * GET /api/v1/ai/status reports the text slot; a question (typed or
 * dictated) goes to POST /api/v1/ai/analytics-chat, which computes the
 * aggregates server-side and returns a grounded answer. Each question is
 * independent (no server-side conversation state); the log lives only on
 * the page.
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
    bubble.className =
        role === 'question'
            ? 'rounded-lg bg-primary/10 p-2 text-sm font-medium'
            : 'rounded-lg bg-base-200 p-2 text-sm';
    bubble.style.whiteSpace = 'pre-wrap';
    bubble.textContent = text;
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
