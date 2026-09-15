/**
 * AI shopping list assist (ai-assist-plan-lists).
 *
 * Standalone IIFE bundle for lists.html. Reveals the ✨ FAB button when
 * GET /api/v1/ai/status reports the text slot available; "Разобрать" sends
 * the phrase to POST /api/v1/ai/parse-list and renders an editable draft
 * table (name, quantity, unit, product group, per-item store — the model
 * maps store mentions like «в Пятёрочке» onto real stores). Items are
 * created via the normal POST /api/v1/shopping-list-items only after user
 * confirmation — the LLM never writes to the database.
 */

/* global MediaRecorder */

interface ListItemDraft {
    product_name: string;
    quantity: number | null;
    unit: string | null;
    product_group_id: number | null;
    product_group_path: string | null;
    store_id: number | null;
    store_name: string | null;
    confidence: 'high' | 'low';
}

interface ListDraft {
    items: ListItemDraft[];
    warnings: string[];
}

interface Option {
    id: number;
    name: string;
    parent_id?: number | null;
}

interface ListsManagerBridge {
    getCurrentListId?: () => number | null;
    reloadItems?: (listId: number) => Promise<void>;
}

const STATUS_URL = '/api/v1/ai/status';
const PARSE_URL = '/api/v1/ai/parse-list';
const TRANSCRIBE_URL = '/api/v1/ai/transcribe';
const ITEMS_URL = '/api/v1/shopping-list-items';
const UNITS = ['шт', 'кг', 'г', 'л', 'мл', 'уп', 'пач'];
const MAX_RECORDING_MS = 120_000;

let storeOptions: Option[] = [];
let groupOptions: Option[] = [];
let currentDraft: ListDraft | null = null;
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

function setStatus(message: string, isError = false): void {
    const status = el<HTMLElement>('ai-list-status');
    if (status) {
        status.textContent = message;
        status.className = isError ? 'text-xs text-error' : 'text-xs text-base-content/70';
    }
}

function bridge(): ListsManagerBridge {
    return ((window as unknown as { listsManager?: ListsManagerBridge }).listsManager ?? {});
}

async function fetchOptions(url: string, key: string): Promise<Option[]> {
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

/** Product groups form a tree (parent_id); show "Parent › Child" paths. */
function groupLabel(group: Option, byId: Map<number, Option>): string {
    const parts: string[] = [];
    let current: Option | undefined = group;
    for (let i = 0; i < 10 && current; i++) {
        parts.push(current.name);
        current = current.parent_id ? byId.get(current.parent_id) : undefined;
    }
    return parts.reverse().join(' › ');
}

async function loadDictionaries(): Promise<void> {
    if (storeOptions.length === 0) {
        storeOptions = await fetchOptions('/api/v1/stores', 'stores');
    }
    if (groupOptions.length === 0) {
        groupOptions = await fetchOptions('/api/v1/product-groups', 'product_groups');
    }
}

function buildStoreSelect(className: string, selectedId: number | null): HTMLSelectElement {
    const select = document.createElement('select');
    select.className = className;
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '— выберите —';
    select.appendChild(placeholder);
    for (const store of storeOptions) {
        const option = document.createElement('option');
        option.value = String(store.id);
        option.textContent = store.name;
        select.appendChild(option);
    }
    if (selectedId !== null) {
        select.value = String(selectedId);
    }
    return select;
}

/** The top select is the DEFAULT store: changing it fills every per-item
 *  select that has no value yet (recognized stores are not overwritten). */
function renderDefaultStoreSelect(): void {
    const holder = el<HTMLElement>('ai-list-store-holder');
    if (!holder) {
        return;
    }
    holder.innerHTML = '';
    const select = buildStoreSelect('select select-bordered select-sm', null);
    select.id = 'ai-list-store';
    if (storeOptions.length === 1) {
        select.value = String(storeOptions[0].id);
    }
    select.addEventListener('change', () => {
        if (!select.value) {
            return;
        }
        document
            .querySelectorAll<HTMLSelectElement>('.ai-list-item-store')
            .forEach((rowSelect) => {
                if (!rowSelect.value) {
                    rowSelect.value = select.value;
                }
            });
    });
    holder.appendChild(select);
}

function renderDraft(draft: ListDraft): void {
    currentDraft = draft;
    el<HTMLElement>('ai-list-input-step')?.classList.add('hidden');
    el<HTMLElement>('ai-list-result-step')?.classList.remove('hidden');
    renderDefaultStoreSelect();

    const byId = new Map(groupOptions.map((g) => [g.id, g]));
    const sortedGroups = groupOptions
        .map((g) => ({ id: g.id, label: groupLabel(g, byId) }))
        .sort((a, b) => a.label.localeCompare(b.label, 'ru'));

    const tbody = document.querySelector<HTMLElement>('#ai-list-table tbody');
    if (!tbody) {
        return;
    }
    tbody.innerHTML = '';
    draft.items.forEach((item, index) => {
        const row = document.createElement('tr');

        const checkCell = document.createElement('td');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'checkbox checkbox-sm ai-list-include';
        checkbox.checked = true;
        checkbox.dataset.index = String(index);
        checkCell.appendChild(checkbox);

        const nameCell = document.createElement('td');
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'input input-bordered input-xs w-36 ai-list-name';
        nameInput.value = item.product_name;
        nameInput.maxLength = 255;
        nameInput.dataset.index = String(index);
        nameCell.appendChild(nameInput);

        const qtyCell = document.createElement('td');
        const qtyInput = document.createElement('input');
        qtyInput.type = 'number';
        qtyInput.min = '0';
        qtyInput.step = 'any';
        qtyInput.className = 'input input-bordered input-xs w-16 ai-list-qty';
        qtyInput.value = item.quantity !== null ? String(item.quantity) : '';
        qtyInput.dataset.index = String(index);
        qtyCell.appendChild(qtyInput);

        const unitCell = document.createElement('td');
        const unitSelect = document.createElement('select');
        unitSelect.className = 'select select-bordered select-xs ai-list-unit';
        unitSelect.dataset.index = String(index);
        const emptyUnit = document.createElement('option');
        emptyUnit.value = '';
        emptyUnit.textContent = '—';
        unitSelect.appendChild(emptyUnit);
        for (const unit of UNITS) {
            const option = document.createElement('option');
            option.value = unit;
            option.textContent = unit;
            unitSelect.appendChild(option);
        }
        unitSelect.value = item.unit ?? '';
        unitCell.appendChild(unitSelect);

        const groupCell = document.createElement('td');
        const groupSelect = document.createElement('select');
        groupSelect.className = 'select select-bordered select-xs ai-list-group';
        groupSelect.dataset.index = String(index);
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = '— выберите —';
        groupSelect.appendChild(placeholder);
        for (const group of sortedGroups) {
            const option = document.createElement('option');
            option.value = String(group.id);
            option.textContent = group.label;
            groupSelect.appendChild(option);
        }
        if (item.product_group_id !== null) {
            groupSelect.value = String(item.product_group_id);
        }
        if (item.confidence === 'low') {
            groupSelect.classList.add('select-warning');
            groupSelect.title = 'Проверь группу';
        }
        groupCell.appendChild(groupSelect);

        const storeCell = document.createElement('td');
        const storeSelect = buildStoreSelect(
            'select select-bordered select-xs ai-list-item-store',
            item.store_id
        );
        storeSelect.dataset.index = String(index);
        storeCell.appendChild(storeSelect);

        row.append(checkCell, nameCell, qtyCell, unitCell, groupCell, storeCell);
        tbody.appendChild(row);
    });

    setStatus(draft.warnings.join('; '));
}

async function parseText(): Promise<void> {
    const textarea = el<HTMLTextAreaElement>('ai-list-text');
    const button = el<HTMLButtonElement>('ai-list-parse');
    const text = textarea?.value.trim() ?? '';
    if (!text || !button) {
        return;
    }
    button.disabled = true;
    button.textContent = 'Разбираю…';
    try {
        const [response] = await Promise.all([
            fetch(PARSE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text }),
            }),
            loadDictionaries(),
        ]);
        if (!response.ok) {
            const body: unknown = await response.json().catch(() => ({}));
            window.alert(extractErrorMessage(body, response.status));
            return;
        }
        renderDraft((await response.json()) as ListDraft);
    } catch {
        window.alert('Сеть недоступна — попробуйте позже');
    } finally {
        button.disabled = false;
        button.textContent = '✨ Разобрать';
    }
}

async function createItems(): Promise<void> {
    if (!currentDraft) {
        return;
    }
    const listId = bridge().getCurrentListId?.() ?? null;
    if (!listId) {
        setStatus('Откройте список, в который добавлять товары', true);
        return;
    }
    const defaultStoreId = Number(el<HTMLSelectElement>('ai-list-store')?.value || 0);
    const button = el<HTMLButtonElement>('ai-list-create');
    if (button) {
        button.disabled = true;
    }

    let created = 0;
    let skipped = 0;
    let failed = 0;
    let noStore = 0;
    const rows = document.querySelectorAll<HTMLInputElement>('.ai-list-include');
    for (const checkbox of Array.from(rows)) {
        if (!checkbox.checked) {
            continue;
        }
        const index = checkbox.dataset.index ?? '';
        const name = document
            .querySelector<HTMLInputElement>(`.ai-list-name[data-index="${index}"]`)
            ?.value.trim();
        const qtyRaw = document.querySelector<HTMLInputElement>(
            `.ai-list-qty[data-index="${index}"]`
        )?.value;
        const unit = document.querySelector<HTMLSelectElement>(
            `.ai-list-unit[data-index="${index}"]`
        )?.value;
        const groupId = Number(
            document.querySelector<HTMLSelectElement>(
                `.ai-list-group[data-index="${index}"]`
            )?.value || 0
        );
        // Per-item store wins; the top select is only the default fallback.
        const storeId =
            Number(
                document.querySelector<HTMLSelectElement>(
                    `.ai-list-item-store[data-index="${index}"]`
                )?.value || 0
            ) || defaultStoreId;
        if (!storeId) {
            noStore += 1;
            continue;
        }
        if (!name || !groupId) {
            skipped += 1;
            continue;
        }
        const quantity = qtyRaw ? Number(qtyRaw) : null;
        try {
            const response = await fetch(ITEMS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    shopping_list_id: listId,
                    store_id: storeId,
                    product_group_id: groupId,
                    product_name: name,
                    quantity: quantity && quantity > 0 ? quantity : null,
                    unit: unit || null,
                }),
            });
            if (response.ok) {
                created += 1;
                checkbox.checked = false;
                checkbox.closest('tr')?.classList.add('opacity-40');
            } else {
                failed += 1;
            }
        } catch {
            failed += 1;
        }
    }

    const parts = [`добавлено: ${created}`];
    if (noStore > 0) {
        parts.push(`без магазина: ${noStore} — выберите магазин в строке или по умолчанию`);
    }
    if (skipped > 0) {
        parts.push(`пропущено (нет группы/названия): ${skipped}`);
    }
    if (failed > 0) {
        parts.push(`ошибок: ${failed}`);
    }
    setStatus(parts.join(' · '), failed > 0 || noStore > 0);
    if (created > 0) {
        void bridge().reloadItems?.(listId);
    }
    if (button) {
        button.disabled = false;
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

/** Record, transcribe, append the text to the textarea and auto-parse. */
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
            setVoiceLabel(button, false);
            const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
            void uploadRecording(blob);
        };
        activeRecorder = recorder;
        recorder.start();
        button.classList.add('btn-error');
        setVoiceLabel(button, true);
        setStatus('Говорите… (нажмите ⏹, чтобы закончить)');
        recorderStopTimer = window.setTimeout(stopRecording, MAX_RECORDING_MS);
    } catch {
        setStatus('Нет доступа к микрофону', true);
    }
}

async function uploadRecording(blob: Blob): Promise<void> {
    setStatus('Распознаю речь (первый запуск может занять минуту)…');
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
        const textarea = el<HTMLTextAreaElement>('ai-list-text');
        if (textarea) {
            textarea.value = textarea.value.trim()
                ? `${textarea.value.trim()}, ${text}`
                : text;
        }
        await parseText();
    } catch {
        setStatus('Сеть недоступна — попробуйте позже', true);
    }
}

function openModal(): void {
    const dialog = document.getElementById('modal_ai_list') as HTMLDialogElement | null;
    if (!dialog) {
        return;
    }
    currentDraft = null;
    el<HTMLElement>('ai-list-input-step')?.classList.remove('hidden');
    el<HTMLElement>('ai-list-result-step')?.classList.add('hidden');
    const textarea = el<HTMLTextAreaElement>('ai-list-text');
    if (textarea) {
        textarea.value = '';
    }
    setStatus('');
    dialog.showModal();
}

async function revealIfAvailable(): Promise<void> {
    if (!document.getElementById('modal_ai_list')) {
        return;
    }
    try {
        const response = await fetch(STATUS_URL);
        if (!response.ok) {
            return;
        }
        const status = (await response.json()) as { text: boolean; voice: boolean };
        if (status.text) {
            el<HTMLElement>('fab-item-ai-list')?.classList.remove('hidden');
        }
        if (status.text && status.voice) {
            el<HTMLElement>('ai-list-voice')?.classList.remove('hidden');
        }
    } catch {
        // AI unavailable — the buttons stay hidden, manual entry unaffected.
    }
}

function init(): void {
    (window as unknown as Record<string, unknown>).openAIListModal = openModal;
    document.addEventListener('click', (event) => {
        const target = event.target as HTMLElement | null;
        if (target?.closest('#ai-list-parse')) {
            void parseText();
            return;
        }
        if (target?.closest('#ai-list-create')) {
            void createItems();
            return;
        }
        if (target?.closest('#ai-list-back')) {
            el<HTMLElement>('ai-list-input-step')?.classList.remove('hidden');
            el<HTMLElement>('ai-list-result-step')?.classList.add('hidden');
            return;
        }
        const listVoice = target?.closest<HTMLButtonElement>('#ai-list-voice');
        if (listVoice) {
            void handleVoice(listVoice);
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
