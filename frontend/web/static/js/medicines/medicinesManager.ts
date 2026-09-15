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

// Confirm via the shared ConfirmDialog bundle when present (it falls back to
// native confirm() itself when its markup is missing).
async function confirmAction(message: string): Promise<boolean> {
  const dlg = (window as unknown as { showConfirmDialog?: (m: string) => Promise<boolean> }).showConfirmDialog;
  return dlg ? dlg(message) : Promise.resolve(window.confirm(message));
}

// ---------- Catalog ----------
export async function loadCatalog(q?: string): Promise<void> {
  const search = q ? `&q=${encodeURIComponent(q)}` : '';
  const data = await api<{ medicines: Medicine[] }>(`/api/v1/medicines?active_only=true&limit=500${search}`);
  renderCatalog(data.medicines);
}

export async function catalogSearch(): Promise<void> {
  const q = (document.getElementById('med-search') as HTMLInputElement | null)?.value.trim();
  await loadCatalog(q || undefined);
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
  if (!(await confirmAction('Архивировать лекарство?'))) return;
  try {
    await api(`/api/v1/medicines/${id}`, { method: 'DELETE' });
    showToast('Архивировано', 'success');
    await loadCatalog();
  } catch (e) { showToast(String((e as Error).message), 'error'); }
}

// ---------- Patients (family members) ----------
interface Patient { id: number; name: string; birth_date: string | null; notes: string | null; is_active: boolean; }
const patientCache = new Map<number, Patient>();

export async function loadPatients(): Promise<void> {
  const data = await api<{ family_members: Patient[] }>('/api/v1/family-members');
  patientCache.clear();
  for (const p of data.family_members) patientCache.set(p.id, p);
  renderPatients(data.family_members);
}

function renderPatients(rows: Patient[]): void {
  const root = document.getElementById('medicines-patients-body');
  if (!root) return;
  root.innerHTML = rows.map(p => `
    <tr data-id="${p.id}">
      <td>${escapeHtml(p.name)}</td>
      <td>${p.birth_date ?? ''}</td>
      <td>${escapeHtml(p.notes ?? '')}</td>
      <td class="text-right">
        <button class="btn btn-ghost btn-xs" onclick="window.openPatientEdit(${p.id})" title="Изменить">✏</button>
        <button class="btn btn-ghost btn-xs" onclick="window.patientArchive(${p.id})">Архив</button>
      </td></tr>`).join('') || `<tr><td colspan="4" class="text-center opacity-60">Пусто</td></tr>`;
}

export async function createPatientFromForm(): Promise<void> {
  const nameEl = document.getElementById('patient-name') as HTMLInputElement | null;
  const birthEl = document.getElementById('patient-birth') as HTMLInputElement | null;
  const notesEl = document.getElementById('patient-notes') as HTMLInputElement | null;
  const name = nameEl?.value.trim();
  if (!name) { showToast('Введите имя', 'warning'); return; }
  try {
    await api('/api/v1/family-members', {
      method: 'POST',
      body: JSON.stringify({ name, birth_date: birthEl?.value || null, notes: notesEl?.value.trim() || null }),
    });
    showToast('Пациент добавлен', 'success');
    if (nameEl) nameEl.value = '';
    if (birthEl) birthEl.value = '';
    if (notesEl) notesEl.value = '';
    await loadPatients();
  } catch (e) { showToast(String((e as Error).message), 'error'); }
}

export function openPatientEdit(id: number): void {
  const p = patientCache.get(id);
  if (!p) return;
  (document.getElementById('patient-edit-id') as HTMLInputElement).value = String(id);
  (document.getElementById('patient-edit-name') as HTMLInputElement).value = p.name;
  (document.getElementById('patient-edit-birth') as HTMLInputElement).value = p.birth_date ?? '';
  (document.getElementById('patient-edit-notes') as HTMLInputElement).value = p.notes ?? '';
  (document.getElementById('patient-edit-dialog') as HTMLDialogElement | null)?.showModal();
}

export async function savePatientEdit(): Promise<void> {
  const id = Number((document.getElementById('patient-edit-id') as HTMLInputElement)?.value);
  const name = (document.getElementById('patient-edit-name') as HTMLInputElement)?.value.trim();
  const birth = (document.getElementById('patient-edit-birth') as HTMLInputElement)?.value || null;
  const notes = (document.getElementById('patient-edit-notes') as HTMLInputElement)?.value.trim() || null;
  if (!name) { showToast('Введите имя', 'warning'); return; }
  try {
    await api(`/api/v1/family-members/${id}`, {
      method: 'PATCH', body: JSON.stringify({ name, birth_date: birth, notes }),
    });
    (document.getElementById('patient-edit-dialog') as HTMLDialogElement | null)?.close();
    showToast('Сохранено', 'success');
    await loadPatients();
  } catch (e) { showToast(String((e as Error).message), 'error'); }
}

export async function patientArchive(id: number): Promise<void> {
  try {
    await api(`/api/v1/family-members/${id}`, { method: 'DELETE' });
    showToast('Архивировано', 'success');
    await loadPatients();
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

const stockCache = new Map<number, Stock>();

export async function loadStock(expiringDays?: number): Promise<void> {
  if (medicineNames.size === 0) await loadMedicineOptions();
  const q = expiringDays != null ? `?expiring_in_days=${expiringDays}&limit=500` : '?limit=500';
  const data = await api<{ stock: Stock[] }>(`/api/v1/medicine-stock${q}`);
  stockCache.clear();
  for (const s of data.stock) stockCache.set(s.id, s);
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
        <button class="btn btn-ghost btn-xs" onclick="window.openStockEdit(${s.id})" title="Изменить">✏</button>
        <button class="btn btn-ghost btn-xs" onclick="window.stockDelete(${s.id})">Удалить</button>
      </td></tr>`;
  }).join('') || `<tr><td colspan="5" class="text-center opacity-60">Пусто</td></tr>`;
}

export function openStockEdit(id: number): void {
  const s = stockCache.get(id);
  if (!s) return;
  (document.getElementById('stock-edit-id') as HTMLInputElement).value = String(id);
  (document.getElementById('stock-edit-qty') as HTMLInputElement).value = s.quantity_remaining;
  (document.getElementById('stock-edit-expiry') as HTMLInputElement).value = s.expiry_date;
  (document.getElementById('stock-edit-location') as HTMLInputElement).value = s.location ?? '';
  (document.getElementById('stock-edit-dialog') as HTMLDialogElement | null)?.showModal();
}

export async function saveStockEdit(): Promise<void> {
  const id = Number((document.getElementById('stock-edit-id') as HTMLInputElement)?.value);
  const qty = (document.getElementById('stock-edit-qty') as HTMLInputElement)?.value.trim();
  const expiry = (document.getElementById('stock-edit-expiry') as HTMLInputElement)?.value;
  const location = (document.getElementById('stock-edit-location') as HTMLInputElement)?.value.trim();
  if (!qty || Number(qty) < 0) { showToast('Укажите остаток', 'warning'); return; }
  if (!expiry) { showToast('Укажите срок годности', 'warning'); return; }
  try {
    await api(`/api/v1/medicine-stock/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity_remaining: qty, expiry_date: expiry, location: location || null }),
    });
    (document.getElementById('stock-edit-dialog') as HTMLDialogElement | null)?.close();
    showToast('Сохранено', 'success');
    await loadStock();
  } catch (e) { showToast(String((e as Error).message), 'error'); }
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
  if (!(await confirmAction('Удалить партию из аптечки?'))) return;
  await api(`/api/v1/medicine-stock/${id}`, { method: 'DELETE' });
  showToast('Удалено', 'success');
  await loadStock();
}

// ---------- Purchase analytics (module-only, decision: not wired to the budget) ----------
interface StockAnalytics {
  total_spent: string;
  by_medicine: { medicine_id: number; medicine_name: string; total_spent: string; package_count: number }[];
}

export async function loadStockAnalytics(): Promise<void> {
  const root = document.getElementById('stock-analytics');
  if (!root) return;
  try {
    const data = await api<StockAnalytics>('/api/v1/medicine-stock/analytics');
    const rows = data.by_medicine.map(m =>
      `<tr><td>${escapeHtml(m.medicine_name)}</td><td>${m.package_count}</td><td class="text-right">${m.total_spent}</td></tr>`
    ).join('');
    root.innerHTML = rows
      ? `<table class="table table-xs">
          <thead><tr><th>Лекарство</th><th>Партий</th><th class="text-right">Потрачено</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr><th colspan="2">Итого</th><th class="text-right">${data.total_spent}</th></tr></tfoot>
        </table>`
      : '<div class="opacity-60">Цены покупок не заполнены</div>';
  } catch {
    root.innerHTML = '<div class="opacity-60">Не удалось загрузить</div>';
  }
}

// ---------- WebSocket (single dispatcher for all medicine events) ----------
export function handleMedicineEvent(eventType: string): void {
  if (eventType === 'medicine_catalog_changed' && document.getElementById('medicines-catalog-body')) loadCatalog();
  if (eventType === 'medicine_stock_changed') {
    if (document.getElementById('medicines-stock-body')) loadStock();
    if (document.getElementById('stock-analytics')) loadStockAnalytics();
  }
  if (eventType === 'medicine_family_member_changed' && document.getElementById('medicines-patients-body')) loadPatients();
  if (eventType === 'medicine_intake_marked') {
    if (document.getElementById('medicines-today-body')) loadDashboard();
    if (document.getElementById('medicines-course-journal')) loadCourseDetail();
  }
  if (eventType === 'medicine_course_changed' && document.getElementById('medicines-courses-body')) loadCourses();
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

// Populate the patient filter once, then load with the current selection.
export async function initDashboard(): Promise<void> {
  const sel = document.getElementById('dashboard-patient-filter') as HTMLSelectElement | null;
  if (sel && sel.options.length <= 1) {
    const data = await api<{ family_members: Patient[] }>('/api/v1/family-members');
    sel.innerHTML = '<option value="">Все члены семьи</option>' +
      data.family_members.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  }
  await dashboardFilterChanged();
}

export async function dashboardFilterChanged(): Promise<void> {
  const v = (document.getElementById('dashboard-patient-filter') as HTMLSelectElement | null)?.value;
  await loadDashboard(v ? Number(v) : undefined);
}

function renderIntakeCard(i: IntakeItem): string {
  const time = i.scheduled_at.slice(11, 16);
  const done = i.status === 'taken' || i.status === 'skipped';
  return `<div class="card bg-base-100 shadow-sm ${done ? 'opacity-60' : ''}" data-id="${i.id}">
    <div class="card-body p-3 flex-row items-center justify-between gap-2">
      <div>
        <div class="font-semibold">${escapeHtml(i.medicine_name)}</div>
        <div class="text-sm opacity-70">⏰ ${time} · ${i.dose_amount} ${escapeHtml(i.dose_unit)}</div>
        <div class="text-xs ${i.status === 'late' ? 'text-error' : 'opacity-50'}">${i.status}</div>
      </div>
      <div class="flex gap-1">
        <button class="btn btn-success btn-xs" ${done ? 'disabled' : ''}
          onclick="window.intakeTake(${i.id}, ${i.version})">✅</button>
        <button class="btn btn-ghost btn-xs" ${done ? 'disabled' : ''}
          onclick="window.intakeSkip(${i.id}, ${i.version})">⏭</button>
        <button class="btn btn-ghost btn-xs" ${done ? 'disabled' : ''} title="Отложить"
          onclick="window.intakeSnooze(${i.id})">🕐</button>
      </div>
    </div>
  </div>`;
}

// Group today's doses by family member (spec: dashboard is per-member, not flat).
function renderDashboard(items: IntakeItem[]): void {
  const root = document.getElementById('medicines-today-body');
  if (!root) return;
  const byPatient = new Map<string, IntakeItem[]>();
  for (const i of items) {
    const list = byPatient.get(i.patient_name) ?? [];
    list.push(i);
    byPatient.set(i.patient_name, list);
  }
  root.innerHTML = [...byPatient.entries()].map(([name, list]) =>
    `<div class="space-y-2">
      <h2 class="font-semibold opacity-70 pt-2">👤 ${escapeHtml(name)}</h2>
      ${list.map(renderIntakeCard).join('')}
    </div>`
  ).join('') || `<div class="text-center opacity-60 py-8">На сегодня ничего нет</div>`;
}

export async function intakeSnooze(id: number): Promise<void> {
  try {
    await api(`/api/v1/medicine-intakes/${id}/snooze`, { method: 'POST' });
    showToast('Напоминание отложено', 'info');
  } catch (e) { showToast(String((e as Error).message), 'error'); }
}

// Reload whichever intake view is mounted (dashboard and/or course journal).
async function refreshIntakeViews(): Promise<void> {
  if (document.getElementById('medicines-today-body')) await loadDashboard();
  if (document.getElementById('medicines-course-journal')) await loadCourseDetail();
}

export async function intakeTake(id: number, version: number): Promise<void> {
  try {
    const res = await api<{ stock_id: number | null }>(
      `/api/v1/medicine-intakes/${id}/take`, { method: 'POST', body: JSON.stringify({ version }) });
    // stock_id === null ⇒ out of stock: server auto-added the medicine to «Аптечка — докупить»
    showToast(res.stock_id == null ? 'Принято. Лекарство закончилось — добавлено в список покупок' : 'Принято',
              res.stock_id == null ? 'warning' : 'success');
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
  intake_times: string[]; schedule_type: string; schedule_config: { n?: number; days?: string[] } | null;
  is_active: boolean; end_date: string | null; with_food: string | null; reminders_enabled: boolean;
  estimate: { remaining: string; intakes_left: number; days_left: number | null; in_stock: boolean } | null;
}

const courseCache = new Map<number, Course>();
const memberNames = new Map<number, string>();

function estimateText(est: Course['estimate']): string {
  if (!est) return '';
  return est.in_stock
    ? `хватит на ${est.intakes_left} приёмов${est.days_left != null ? ` (~${est.days_left} дн.)` : ''}`
    : '<span class="text-warning">нет в аптечке</span>';
}

async function loadNameMaps(): Promise<void> {
  const [meds, members] = await Promise.all([
    medicineNames.size ? Promise.resolve(null) : api<{ medicines: Medicine[] }>('/api/v1/medicines?limit=1000'),
    memberNames.size ? Promise.resolve(null) : api<{ family_members: Patient[] }>('/api/v1/family-members'),
  ]);
  if (meds) for (const m of meds.medicines) medicineNames.set(m.id, m.name);
  if (members) for (const p of members.family_members) memberNames.set(p.id, p.name);
}

export async function loadCourses(): Promise<void> {
  const showPaused = (document.getElementById('course-show-paused') as HTMLInputElement | null)?.checked;
  await loadNameMaps();
  const data = await api<{ courses: Course[] }>(
    `/api/v1/medicine-courses?active_only=${showPaused ? 'false' : 'true'}&limit=500`);
  const root = document.getElementById('medicines-courses-body');
  if (!root) return;
  courseCache.clear();
  for (const c of data.courses) courseCache.set(c.id, c);
  root.innerHTML = data.courses.map(c => {
    const estText = estimateText(c.estimate);
    const pausedBadge = c.is_active ? '' : ' <span class="badge badge-warning badge-sm">пауза</span>';
    const toggleBtn = c.is_active
      ? `<button class="btn btn-ghost btn-xs" onclick="window.coursePause(${c.id})">Пауза</button>`
      : `<button class="btn btn-ghost btn-xs" onclick="window.courseResume(${c.id})">Возобновить</button>`;
    return `<tr data-id="${c.id}">
      <td>${escapeHtml(medicineNames.get(c.medicine_id) ?? `#${c.medicine_id}`)}${pausedBadge}</td>
      <td>${escapeHtml(memberNames.get(c.patient_id) ?? `#${c.patient_id}`)}</td>
      <td>${c.intake_times.join(', ')}</td>
      <td>${c.dose_amount} ${escapeHtml(c.dose_unit)}</td>
      <td>${estText}</td>
      <td class="text-right whitespace-nowrap">
        <a class="btn btn-ghost btn-xs" href="/medicines/courses/${c.id}">Открыть</a>
        <button class="btn btn-ghost btn-xs" onclick="window.openCourseEdit(${c.id})" title="Изменить">✏</button>
        ${toggleBtn}
        <button class="btn btn-ghost btn-xs" onclick="window.courseComplete(${c.id})">Завершить</button>
      </td></tr>`;
  }).join('') || `<tr><td colspan="6" class="text-center opacity-60">Нет курсов</td></tr>`;
}

export async function coursePause(id: number): Promise<void> {
  if (!(await confirmAction('Приостановить курс? Напоминания будут отменены.'))) return;
  await api(`/api/v1/medicine-courses/${id}/pause`, { method: 'POST' });
  showToast('Курс приостановлен', 'info');
  await loadCourses();
}

export async function courseResume(id: number): Promise<void> {
  await api(`/api/v1/medicine-courses/${id}/resume`, { method: 'POST' });
  showToast('Курс возобновлён', 'success');
  await loadCourses();
}

export async function courseComplete(id: number): Promise<void> {
  if (!(await confirmAction('Завершить курс? Он исчезнет из списка, журнал сохранится.'))) return;
  await api(`/api/v1/medicine-courses/${id}/complete`, { method: 'POST' });
  showToast('Курс завершён', 'success');
  await loadCourses();
}

// ---------- Course form (soft link to stock, decision #6) ----------
interface MedicineOpt { id: number; name: string; }
interface StockRow { medicine_id: number; quantity_remaining: string; }
interface MemberOpt { id: number; name: string; }

let _inStock = new Set<number>();

async function populateCourseForm(): Promise<void> {
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
  const schedSel = document.getElementById('course-schedule') as HTMLSelectElement | null;
  if (schedSel) schedSel.onchange = updateScheduleConfigVisibility;
  updateScheduleConfigVisibility();
}

function setVal(id: string, value: string): void {
  const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
  if (el) el.value = value;
}

export async function openCourseForm(): Promise<void> {
  await populateCourseForm();
  setVal('course-edit-id', '');
  const title = document.getElementById('course-form-title');
  if (title) title.textContent = 'Новый курс';
  for (const sel of ['course-medicine', 'course-patient'])
    (document.getElementById(sel) as HTMLSelectElement | null)?.removeAttribute('disabled');
  setVal('course-end', '');
  setVal('course-food', '');
  const rem = document.getElementById('course-reminders') as HTMLInputElement | null;
  if (rem) rem.checked = true;
  (document.getElementById('course-form-dialog') as HTMLDialogElement | null)?.showModal();
}

export async function openCourseEdit(id: number): Promise<void> {
  const c = courseCache.get(id);
  if (!c) return;
  await populateCourseForm();
  setVal('course-edit-id', String(id));
  const title = document.getElementById('course-form-title');
  if (title) title.textContent = 'Изменить курс';
  setVal('course-medicine', String(c.medicine_id));
  setVal('course-patient', String(c.patient_id));
  // medicine/patient are not part of MedicineCourseUpdate — freeze them in edit mode
  for (const sel of ['course-medicine', 'course-patient'])
    (document.getElementById(sel) as HTMLSelectElement | null)?.setAttribute('disabled', '');
  setVal('course-dose', c.dose_amount);
  setVal('course-unit', c.dose_unit);
  setVal('course-times', c.intake_times.join(', '));
  setVal('course-schedule', c.schedule_type);
  setVal('course-schedule-n', String(c.schedule_config?.n ?? 2));
  document.querySelectorAll<HTMLInputElement>('.course-day').forEach(el => {
    el.checked = (c.schedule_config?.days ?? []).includes(el.value);
  });
  setVal('course-end', c.end_date ?? '');
  setVal('course-food', c.with_food ?? '');
  const rem = document.getElementById('course-reminders') as HTMLInputElement | null;
  if (rem) rem.checked = c.reminders_enabled;
  updateScheduleConfigVisibility();
  (document.getElementById('course-form-dialog') as HTMLDialogElement | null)?.showModal();
}

// Show the config inputs matching the selected schedule type.
function updateScheduleConfigVisibility(): void {
  const type = (document.getElementById('course-schedule') as HTMLSelectElement | null)?.value ?? 'daily';
  document.getElementById('course-schedule-n-wrap')?.classList.toggle('hidden', type !== 'every_n_days');
  document.getElementById('course-schedule-days-wrap')?.classList.toggle('hidden', type !== 'weekdays');
}

// Build schedule_config for the selected type; null for daily.
// Throws a user-facing message when the config is missing/invalid (server rejects it too).
function buildScheduleConfig(type: string): { n: number } | { days: string[] } | null {
  if (type === 'every_n_days') {
    const n = Number((document.getElementById('course-schedule-n') as HTMLInputElement | null)?.value);
    if (!Number.isInteger(n) || n < 1) throw new Error('Укажите интервал в днях (N ≥ 1)');
    return { n };
  }
  if (type === 'weekdays') {
    const days = Array.from(document.querySelectorAll<HTMLInputElement>('.course-day:checked'))
      .map(el => el.value);
    if (days.length === 0) throw new Error('Выберите хотя бы один день недели');
    return { days };
  }
  return null;
}

// Inline "add patient" from the course form: create, then refresh + select in the dropdown.
export function openQuickPatient(): void {
  for (const id of ['quick-patient-name', 'quick-patient-birth', 'quick-patient-notes']) {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el) el.value = '';
  }
  (document.getElementById('quick-patient-dialog') as HTMLDialogElement | null)?.showModal();
}

export async function saveQuickPatient(): Promise<void> {
  const name = (document.getElementById('quick-patient-name') as HTMLInputElement)?.value.trim();
  const birth = (document.getElementById('quick-patient-birth') as HTMLInputElement)?.value || null;
  const notes = (document.getElementById('quick-patient-notes') as HTMLInputElement)?.value.trim() || null;
  if (!name) { showToast('Введите имя', 'warning'); return; }
  try {
    const created = await api<{ id: number }>('/api/v1/family-members', {
      method: 'POST', body: JSON.stringify({ name, birth_date: birth, notes }),
    });
    (document.getElementById('quick-patient-dialog') as HTMLDialogElement | null)?.close();
    showToast('Пациент добавлен', 'success');
    const memSel = document.getElementById('course-patient') as HTMLSelectElement | null;
    if (memSel) {
      const members = await api<{ family_members: MemberOpt[] }>('/api/v1/family-members');
      memSel.innerHTML = members.family_members.map(m =>
        `<option value="${m.id}"${m.id === created.id ? ' selected' : ''}>${escapeHtml(m.name)}</option>`).join('');
    }
  } catch (e) { showToast(String((e as Error).message), 'error'); }
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
    const editId = val('course-edit-id');
    const scheduleType = val('course-schedule') || 'daily';
    const reminders = (document.getElementById('course-reminders') as HTMLInputElement | null)?.checked ?? true;
    const common = {
      dose_amount: val('course-dose'),
      dose_unit: val('course-unit'),
      intake_times: times,
      schedule_type: scheduleType,
      schedule_config: buildScheduleConfig(scheduleType),
      end_date: val('course-end') || null,
      with_food: val('course-food') || null,
      reminders_enabled: reminders,
    };
    if (editId) {
      await api(`/api/v1/medicine-courses/${editId}`, {
        method: 'PATCH', body: JSON.stringify(common),
      });
    } else {
      await api('/api/v1/medicine-courses', {
        method: 'POST',
        body: JSON.stringify({
          ...common,
          medicine_id: Number(val('course-medicine')),
          patient_id: Number(val('course-patient')),
          start_date: val('course-start'),
        }),
      });
    }
    (document.getElementById('course-form-dialog') as HTMLDialogElement | null)?.close();
    showToast(editId ? 'Курс обновлён' : 'Курс создан', 'success');
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
    const estText = estimateText(c.estimate);
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

