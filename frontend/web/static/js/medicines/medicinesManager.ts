// Medicines manager: catalog + stock pages. Fetch via REST, re-render, react to WS events.
// Public functions are attached to window in medicines-bundle.ts.

declare const showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;

interface Medicine { id: number; name: string; form: string; dosage: string | null; is_active: boolean; }
interface Stock {
  id: number; medicine_id: number; quantity_remaining: string; unit: string;
  expiry_date: string; location: string | null;
}

async function api<T>(url: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || res.statusText);
  return res.status === 204 ? (undefined as T) : res.json();
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

// ---------- Catalog ----------
export async function loadCatalog(): Promise<void> {
  const data = await api<{ medicines: Medicine[] }>('/api/v1/medicines?active_only=true&limit=500');
  renderCatalog(data.medicines);
}

function renderCatalog(meds: Medicine[]): void {
  const root = document.getElementById('medicines-catalog-body');
  if (!root) return;
  root.innerHTML = meds.map(m => `
    <tr data-id="${m.id}">
      <td>${escapeHtml(m.name)}</td>
      <td>${m.form}</td>
      <td>${escapeHtml(m.dosage ?? '')}</td>
      <td class="text-right">
        <button class="btn btn-ghost btn-xs" onclick="window.medicineArchive(${m.id})">Архив</button>
      </td>
    </tr>`).join('') || `<tr><td colspan="4" class="text-center opacity-60">Пусто</td></tr>`;
}

export async function createMedicineFromForm(): Promise<void> {
  const name = (document.getElementById('med-name') as HTMLInputElement)?.value.trim();
  const form = (document.getElementById('med-form') as HTMLSelectElement)?.value;
  const dosage = (document.getElementById('med-dosage') as HTMLInputElement)?.value.trim() || null;
  if (!name) { showToast('Введите название', 'warning'); return; }
  await api('/api/v1/medicines', { method: 'POST', body: JSON.stringify({ name, form, dosage }) });
  showToast('Лекарство добавлено', 'success');
  await loadCatalog();
}

export async function medicineArchive(id: number): Promise<void> {
  try {
    await api(`/api/v1/medicines/${id}`, { method: 'DELETE' });
    showToast('Архивировано', 'success');
    await loadCatalog();
  } catch (e) { showToast(String((e as Error).message), 'error'); }
}

// ---------- Stock ----------
const medicineNames = new Map<number, string>();

// Populate the medicine <select> + name cache (used to label stock rows).
export async function loadMedicineOptions(): Promise<void> {
  const sel = document.getElementById('stock-medicine') as HTMLSelectElement | null;
  const data = await api<{ medicines: Medicine[] }>('/api/v1/medicines?active_only=true&limit=500');
  medicineNames.clear();
  for (const m of data.medicines) medicineNames.set(m.id, m.name);
  if (sel) {
    sel.innerHTML = '<option value="">— лекарство —</option>' +
      data.medicines.map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('');
  }
}

export async function loadStock(expiringDays?: number): Promise<void> {
  if (medicineNames.size === 0) await loadMedicineOptions();
  const q = expiringDays != null ? `?expiring_in_days=${expiringDays}&limit=500` : '?limit=500';
  const data = await api<{ stock: Stock[] }>(`/api/v1/medicine-stock${q}`);
  renderStock(data.stock);
}

function renderStock(rows: Stock[]): void {
  const root = document.getElementById('medicines-stock-body');
  if (!root) return;
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  root.innerHTML = rows.map(s => {
    const badge = s.expiry_date <= soon
      ? `<span class="badge ${s.expiry_date <= today ? 'badge-error' : 'badge-warning'} badge-sm">⏰</span>` : '';
    const name = medicineNames.get(s.medicine_id) ?? `#${s.medicine_id}`;
    return `<tr data-id="${s.id}">
      <td>${escapeHtml(name)}</td>
      <td>${escapeHtml(s.unit)} · ${s.quantity_remaining}</td>
      <td>${s.expiry_date} ${badge}</td>
      <td>${escapeHtml(s.location ?? '')}</td>
      <td class="text-right">
        <button class="btn btn-ghost btn-xs" onclick="window.stockDelete(${s.id})">Удалить</button>
      </td></tr>`;
  }).join('') || `<tr><td colspan="5" class="text-center opacity-60">Пусто</td></tr>`;
}

export async function createStockFromForm(): Promise<void> {
  const medicineId = Number((document.getElementById('stock-medicine') as HTMLSelectElement)?.value);
  const qty = (document.getElementById('stock-qty') as HTMLInputElement)?.value.trim();
  const unit = (document.getElementById('stock-unit') as HTMLInputElement)?.value.trim();
  const expiry = (document.getElementById('stock-expiry') as HTMLInputElement)?.value;
  const location = (document.getElementById('stock-location') as HTMLInputElement)?.value.trim() || null;
  if (!medicineId) { showToast('Выберите лекарство', 'warning'); return; }
  if (!qty || Number(qty) <= 0) { showToast('Укажите количество', 'warning'); return; }
  if (!unit) { showToast('Укажите единицу', 'warning'); return; }
  if (!expiry) { showToast('Укажите срок годности', 'warning'); return; }
  try {
    await api('/api/v1/medicine-stock', {
      method: 'POST',
      body: JSON.stringify({
        medicine_id: medicineId, quantity_remaining: qty, quantity_initial: qty,
        unit, expiry_date: expiry, location,
      }),
    });
    showToast('Добавлено в аптечку', 'success');
    await loadStock();
  } catch (e) { showToast(String((e as Error).message), 'error'); }
}

export async function stockDelete(id: number): Promise<void> {
  await api(`/api/v1/medicine-stock/${id}`, { method: 'DELETE' });
  showToast('Удалено', 'success');
  await loadStock();
}

// ---------- WebSocket ----------
export function handleMedicineEvent(eventType: string): void {
  if (eventType === 'medicine_catalog_changed' && document.getElementById('medicines-catalog-body')) loadCatalog();
  if (eventType === 'medicine_stock_changed' && document.getElementById('medicines-stock-body')) loadStock();
}

// ---------- Dashboard (today) ----------
interface IntakeItem {
  id: number; course_id: number; patient_id: number; scheduled_at: string;
  status: string; version: number; medicine_name: string; patient_name: string;
  dose_amount: string; dose_unit: string; with_food: string | null;
}

export async function loadDashboard(patientId?: number): Promise<void> {
  const q = patientId != null ? `?date=today&patient_id=${patientId}` : '?date=today';
  const data = await api<{ intakes: IntakeItem[] }>(`/api/v1/medicine-intakes${q}`);
  renderDashboard(data.intakes);
}

function renderDashboard(items: IntakeItem[]): void {
  const root = document.getElementById('medicines-today-body');
  if (!root) return;
  root.innerHTML = items.map(i => {
    const time = i.scheduled_at.slice(11, 16);
    const done = i.status === 'taken' || i.status === 'skipped';
    return `<div class="card bg-base-100 shadow-sm ${done ? 'opacity-60' : ''}" data-id="${i.id}">
      <div class="card-body p-3 flex-row items-center justify-between gap-2">
        <div>
          <div class="font-semibold">${escapeHtml(i.medicine_name)}</div>
          <div class="text-sm opacity-70">👤 ${escapeHtml(i.patient_name)} · ⏰ ${time} · ${i.dose_amount} ${escapeHtml(i.dose_unit)}</div>
          <div class="text-xs ${i.status === 'late' ? 'text-error' : 'opacity-50'}">${i.status}</div>
        </div>
        <div class="flex gap-1">
          <button class="btn btn-success btn-xs" ${done ? 'disabled' : ''}
            onclick="window.intakeTake(${i.id}, ${i.version})">✅</button>
          <button class="btn btn-ghost btn-xs" ${done ? 'disabled' : ''}
            onclick="window.intakeSkip(${i.id}, ${i.version})">⏭</button>
        </div>
      </div>
    </div>`;
  }).join('') || `<div class="text-center opacity-60 py-8">На сегодня ничего нет</div>`;
}

// Reload whichever intake view is mounted (dashboard and/or course journal).
async function refreshIntakeViews(): Promise<void> {
  if (document.getElementById('medicines-today-body')) await loadDashboard();
  if (document.getElementById('medicines-course-journal')) await loadCourseDetail();
}

export async function intakeTake(id: number, version: number): Promise<void> {
  try {
    await api(`/api/v1/medicine-intakes/${id}/take`, { method: 'POST', body: JSON.stringify({ version }) });
    showToast('Принято', 'success');
    await refreshIntakeViews();
  } catch (e) {
    showToast(String((e as Error).message), 'error');
    await refreshIntakeViews();  // reload to resync version on 409
  }
}

export async function intakeSkip(id: number, version: number): Promise<void> {
  try {
    await api(`/api/v1/medicine-intakes/${id}/skip`, { method: 'POST', body: JSON.stringify({ version }) });
    showToast('Пропущено', 'info');
    await refreshIntakeViews();
  } catch (e) {
    showToast(String((e as Error).message), 'error');
    await refreshIntakeViews();
  }
}

// ---------- Courses ----------
interface Course {
  id: number; medicine_id: number; patient_id: number; dose_amount: string; dose_unit: string;
  intake_times: string[]; schedule_type: string; is_active: boolean;
  estimate: { remaining: string; intakes_left: number; days_left: number | null; in_stock: boolean } | null;
}

export async function loadCourses(): Promise<void> {
  const data = await api<{ courses: Course[] }>('/api/v1/medicine-courses?active_only=true&limit=500');
  const root = document.getElementById('medicines-courses-body');
  if (!root) return;
  root.innerHTML = data.courses.map(c => {
    const est = c.estimate;
    const estText = est
      ? (est.in_stock ? `хватит на ${est.intakes_left} приёмов${est.days_left != null ? ` (~${est.days_left} дн.)` : ''}`
                      : '<span class="text-warning">нет в аптечке</span>')
      : '';
    return `<tr data-id="${c.id}">
      <td>${c.intake_times.join(', ')}</td>
      <td>${c.dose_amount} ${escapeHtml(c.dose_unit)}</td>
      <td>${estText}</td>
      <td class="text-right">
        <a class="btn btn-ghost btn-xs" href="/medicines/courses/${c.id}">Открыть</a>
        <button class="btn btn-ghost btn-xs" onclick="window.coursePause(${c.id})">Пауза</button>
      </td></tr>`;
  }).join('') || `<tr><td colspan="4" class="text-center opacity-60">Нет активных курсов</td></tr>`;
}

export async function coursePause(id: number): Promise<void> {
  await api(`/api/v1/medicine-courses/${id}/pause`, { method: 'POST' });
  showToast('Курс приостановлен', 'info');
  await loadCourses();
}

// ---------- Course form (soft link to stock, decision #6) ----------
interface MedicineOpt { id: number; name: string; }
interface StockRow { medicine_id: number; quantity_remaining: string; }
interface MemberOpt { id: number; name: string; }

let _inStock = new Set<number>();

export async function openCourseForm(): Promise<void> {
  const [meds, stock, members] = await Promise.all([
    api<{ medicines: MedicineOpt[] }>('/api/v1/medicines?limit=1000'),
    api<{ stock: StockRow[] }>('/api/v1/medicine-stock?limit=1000'),
    api<{ family_members: MemberOpt[] }>('/api/v1/family-members'),
  ]);
  _inStock = new Set(stock.stock.filter(s => Number(s.quantity_remaining) > 0).map(s => s.medicine_id));
  const medSel = document.getElementById('course-medicine') as HTMLSelectElement | null;
  const memSel = document.getElementById('course-patient') as HTMLSelectElement | null;
  if (medSel) {
    const opts = [...meds.medicines].sort((a, b) =>
      Number(_inStock.has(b.id)) - Number(_inStock.has(a.id)) || a.name.localeCompare(b.name));
    medSel.innerHTML = opts.map(m =>
      `<option value="${m.id}">${escapeHtml(m.name)}${_inStock.has(m.id) ? ' · ✓ в аптечке' : ''}</option>`).join('');
    medSel.onchange = updateStockHint;
  }
  if (memSel) memSel.innerHTML = members.family_members.map(m =>
    `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('');
  updateStockHint();
  (document.getElementById('course-form-dialog') as HTMLDialogElement | null)?.showModal();
}

function updateStockHint(): void {
  const medSel = document.getElementById('course-medicine') as HTMLSelectElement | null;
  const hint = document.getElementById('course-stock-hint');
  if (!medSel || !hint) return;
  const id = Number(medSel.value);
  hint.innerHTML = _inStock.has(id)
    ? '<span class="text-success">✓ есть в аптечке</span>'
    : '<span class="text-warning">нет в аптечке</span> · <a class="link" href="/medicines/stock">добавить в аптечку</a>';
}

export async function createCourseFromForm(): Promise<void> {
  const val = (id: string) =>
    (document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null)?.value ?? '';
  const times = val('course-times').split(',').map(t => t.trim()).filter(Boolean);
  try {
    await api('/api/v1/medicine-courses', {
      method: 'POST',
      body: JSON.stringify({
        medicine_id: Number(val('course-medicine')),
        patient_id: Number(val('course-patient')),
        dose_amount: val('course-dose'),
        dose_unit: val('course-unit'),
        intake_times: times,
        start_date: val('course-start'),
        schedule_type: val('course-schedule') || 'daily',
      }),
    });
    (document.getElementById('course-form-dialog') as HTMLDialogElement | null)?.close();
    showToast('Курс создан', 'success');
    await loadCourses();
  } catch (e) {
    showToast(String((e as Error).message), 'error');
  }
}

// ---------- Course detail (card + journal) ----------
export async function loadCourseDetail(): Promise<void> {
  const meta = document.querySelector('meta[name="course-id"]') as HTMLMetaElement | null;
  const id = meta ? Number(meta.content) : NaN;
  if (!Number.isFinite(id)) return;
  const c = await api<Course>(`/api/v1/medicine-courses/${id}`);
  const card = document.getElementById('medicines-course-card');
  if (card) {
    const est = c.estimate;
    const estText = est
      ? (est.in_stock ? `хватит на ${est.intakes_left} приёмов${est.days_left != null ? ` (~${est.days_left} дн.)` : ''}`
                      : '<span class="text-warning">нет в аптечке</span>')
      : '';
    card.innerHTML = `<div class="card-body">
      <div class="font-semibold">${c.intake_times.join(', ')} · ${c.dose_amount} ${escapeHtml(c.dose_unit)}</div>
      <div class="text-sm opacity-70">${escapeHtml(c.schedule_type)}</div>
      <div class="text-sm">${estText}</div>
    </div>`;
  }
  const data = await api<{ intakes: IntakeItem[] }>(`/api/v1/medicine-intakes?course_id=${id}`);
  const journal = document.getElementById('medicines-course-journal');
  if (journal) renderJournal(journal, data.intakes);
}

function renderJournal(root: HTMLElement, items: IntakeItem[]): void {
  root.innerHTML = items.map(i => {
    const dt = `${i.scheduled_at.slice(0, 10)} ${i.scheduled_at.slice(11, 16)}`;
    const done = i.status === 'taken' || i.status === 'skipped';
    return `<div class="flex items-center justify-between gap-2 border-b border-base-200 py-1" data-id="${i.id}">
      <span class="text-sm">${dt} · <span class="${i.status === 'late' ? 'text-error' : 'opacity-70'}">${i.status}</span></span>
      <span class="flex gap-1">
        <button class="btn btn-success btn-xs" ${done ? 'disabled' : ''} onclick="window.intakeTake(${i.id}, ${i.version})">✅</button>
        <button class="btn btn-ghost btn-xs" ${done ? 'disabled' : ''} onclick="window.intakeSkip(${i.id}, ${i.version})">⏭</button>
      </span></div>`;
  }).join('') || '<div class="opacity-60">Журнал пуст</div>';
}

// extend WS handler
export function handleMedicineEventV2(eventType: string): void {
  if (eventType === 'medicine_intake_marked') {
    if (document.getElementById('medicines-today-body')) loadDashboard();
    if (document.getElementById('medicines-course-journal')) loadCourseDetail();
  }
  if (eventType === 'medicine_course_changed' && document.getElementById('medicines-courses-body')) loadCourses();
}
