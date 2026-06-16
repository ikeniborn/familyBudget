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
