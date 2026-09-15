// Minimal 5-step medicine import wizard for stock | courses. Mirrors the shopping CSV flow.
declare const showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;

type Entity = 'stock' | 'courses';
const BASE: Record<Entity, string> = {
  stock: '/api/v1/medicine-stock',
  courses: '/api/v1/medicine-courses',
};
// Target fields per entity — drives the column-mapping <select> options.
const FIELDS: Record<Entity, string[]> = {
  stock: ['name', 'inn', 'form', 'dosage', 'quantity', 'unit',
          'expiry_date', 'purchase_date', 'purchase_price', 'location'],
  courses: ['patient', 'medicine', 'dose_amount', 'dose_unit', 'intake_times',
            'schedule_type', 'start_date', 'end_date', 'with_food', 'notification_channels'],
};

interface AnalyzeResult {
  delimiter: string; encoding: string; has_header: boolean;
  detected_columns: string[]; auto_mapping: Record<string, string | null>;
  sample_rows: Record<string, unknown>[]; total_rows: number; confidence: number;
}

let state: { entity: Entity; content: string; analyze: AnalyzeResult | null;
             mapping: Record<string, string> } | null = null;

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || res.statusText);
  return res.json();
}

function modal(): HTMLElement {
  let el = document.getElementById('medicine-import-modal');
  if (!el) {
    el = document.createElement('dialog');
    el.id = 'medicine-import-modal';
    el.className = 'modal';
    document.body.appendChild(el);
  }
  return el;
}

export function openImportWizard(entity: Entity): void {
  state = { entity, content: '', analyze: null, mapping: {} };
  const el = modal() as HTMLDialogElement;
  el.innerHTML = `
    <div class="modal-box">
      <h3 class="font-bold text-lg">Импорт (${entity === 'stock' ? 'аптечка' : 'курсы'})</h3>
      <div class="py-2 space-y-2">
        <input type="file" id="med-import-file" accept=".csv" class="file-input file-input-bordered w-full" />
        <div class="divider">или Google Sheets</div>
        <input id="med-import-gs" class="input input-bordered w-full" placeholder="https://docs.google.com/spreadsheets/..." />
        <button class="btn btn-sm" onclick="window.medicineImportGoogleSheets()">Загрузить из Google Sheets</button>
      </div>
      <div id="med-import-step" class="text-sm"></div>
      <div class="modal-action">
        <button class="btn btn-primary btn-sm" onclick="window.medicineImportAnalyze()">Далее</button>
        <form method="dialog"><button class="btn btn-ghost btn-sm">Закрыть</button></form>
      </div>
    </div>`;
  el.showModal();
  const file = el.querySelector('#med-import-file') as HTMLInputElement;
  file.addEventListener('change', async () => {
    if (file.files?.[0]) state!.content = await fileToBase64(file.files[0]);
  });
}

export async function medicineImportGoogleSheets(): Promise<void> {
  if (!state) return;
  const url = (document.getElementById('med-import-gs') as HTMLInputElement)?.value.trim();
  if (!url) { showToast('Вставьте ссылку', 'warning'); return; }
  try {
    const r = await post<{ file_content: string }>(`${BASE[state.entity]}/google-sheets/fetch`, { url });
    state.content = r.file_content;
    showToast('Таблица загружена', 'success');
  } catch (e) { showToast(String((e as Error).message), 'error'); }
}

export async function medicineImportAnalyze(): Promise<void> {
  if (!state || !state.content) { showToast('Выберите файл или ссылку', 'warning'); return; }
  try {
    state.analyze = await post<AnalyzeResult>(`${BASE[state.entity]}/import/analyze`, { file_content: state.content });
    renderMapping();
  } catch (e) { showToast(String((e as Error).message), 'error'); }
}

// Step «map»: editable column→field table, pre-filled from auto_mapping; user can correct before preview.
function renderMapping(): void {
  if (!state?.analyze) return;
  const a = state.analyze;
  state.mapping = Object.fromEntries(
    Object.entries(a.auto_mapping).filter(([, v]) => v)) as Record<string, string>;
  const options = (sel: string | null) =>
    ['<option value="">— пропустить —</option>']
      .concat(FIELDS[state!.entity].map(f =>
        `<option value="${f}" ${f === sel ? 'selected' : ''}>${f}</option>`)).join('');
  const rows = a.detected_columns.map(col => `
    <tr><td class="text-sm">${col}</td>
    <td><select class="select select-bordered select-sm w-full" data-col="${col}">
      ${options(a.auto_mapping[col] ?? null)}</select></td></tr>`).join('');
  const step = document.getElementById('med-import-step');
  if (step) step.innerHTML = `
    <div class="text-sm font-semibold mt-2">Сопоставление колонок</div>
    <table class="table table-xs"><thead><tr><th>CSV</th><th>Поле</th></tr></thead>
      <tbody>${rows}</tbody></table>
    <button class="btn btn-primary btn-sm" onclick="window.medicineImportPreview()">Предпросмотр</button>`;
}

// Step «preview»: collect the (possibly edited) mapping, dry-run, show counts + Import button.
export async function medicineImportPreview(): Promise<void> {
  if (!state?.analyze) return;
  const mapping: Record<string, string> = {};
  document.querySelectorAll('#med-import-step select[data-col]').forEach(s => {
    const el = s as HTMLSelectElement;
    if (el.value) mapping[el.dataset.col as string] = el.value;
  });
  state.mapping = mapping;
  const a = state.analyze;
  const body = { file_content: state.content, delimiter: a.delimiter, encoding: a.encoding,
                 has_header: a.has_header, column_mapping: mapping };
  try {
    const preview = await post<{ valid_rows: number; invalid_rows: number; is_valid: boolean }>(
      `${BASE[state.entity]}/import/preview`, body);
    const step = document.getElementById('med-import-step');
    if (step) step.insertAdjacentHTML('beforeend', `
      <div class="alert ${preview.is_valid ? 'alert-success' : 'alert-warning'} my-2">
        Готово к импорту: ${preview.valid_rows}, ошибок: ${preview.invalid_rows}
      </div>
      <button class="btn btn-success btn-sm" ${preview.valid_rows === 0 ? 'disabled' : ''}
        onclick="window.medicineImportExecute()">Импортировать ${preview.valid_rows}</button>`);
  } catch (e) { showToast(String((e as Error).message), 'error'); }
}

export async function medicineImportExecute(): Promise<void> {
  if (!state?.analyze) return;
  const a = state.analyze;
  const body = { file_content: state.content, delimiter: a.delimiter, encoding: a.encoding,
                 has_header: a.has_header, column_mapping: state.mapping };
  try {
    const res = await post<{ imported_count: number }>(`${BASE[state.entity]}/import/execute`, body);
    showToast(`Импортировано: ${res.imported_count}`, 'success');
    (modal() as HTMLDialogElement).close();
    // refresh underlying page
    if (state.entity === 'stock' && (window as any).loadStock) (window as any).loadStock();
    if (state.entity === 'courses' && (window as any).loadCourses) (window as any).loadCourses();
  } catch (e) { showToast(String((e as Error).message), 'error'); }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
