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

const STATUS_URL = '/api/v1/ai/status';
const PARSE_URL = '/api/v1/ai/parse-transaction';

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

    // 3. Category — options load asynchronously after the account change.
    const articleSelect = form.querySelector<HTMLSelectElement>(
        'select[name="article_id"]'
    );
    if (articleSelect) {
        const ok = await waitForOption(articleSelect, String(draft.article_id));
        if (ok) {
            articleSelect.value = String(draft.article_id);
            articleSelect.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
            issues.push('Категория недоступна для выбранного счёта — выберите вручную');
        }
    }

    // 4. Plain fields.
    const dateInput = form.querySelector<HTMLInputElement>('input[name="fact_date"]');
    if (dateInput) {
        dateInput.value = isoToDisplayDate(draft.fact_date);
        dateInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const amountInput = form.querySelector<HTMLInputElement>('input[name="amount"]');
    if (amountInput) {
        amountInput.value = String(draft.amount);
        amountInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const descriptionInput = form.querySelector<HTMLTextAreaElement>(
        'textarea[name="description"]'
    );
    if (descriptionInput && draft.description) {
        descriptionInput.value = draft.description;
    }

    return issues;
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
            const body = (await response.json().catch(() => ({}))) as {
                message?: string;
                detail?: string;
            };
            setResult(
                block,
                body.message || body.detail || `Ошибка ${response.status}`,
                true
            );
            return;
        }
        const draft = (await response.json()) as TransactionDraft;
        const issues = await fillForm(form, draft);
        const summary = `→ ${draft.article_path} · ${draft.amount} ₽`;
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
        const status = (await response.json()) as { text: boolean };
        if (status.text) {
            blocks.forEach((b) => b.classList.remove('hidden'));
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
