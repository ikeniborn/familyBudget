const KEY = 'fb_tab_id';
let _id: string | null = null;

export function getTabId(): string {
  if (_id) return _id;
  _id = sessionStorage.getItem(KEY);
  if (!_id) {
    _id = crypto.randomUUID();
    sessionStorage.setItem(KEY, _id);
  }
  return _id;
}

export function resetTabId(): void {
  _id = null;
  sessionStorage.removeItem(KEY);
}
