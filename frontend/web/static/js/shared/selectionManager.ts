/**
 * Selection Manager
 *
 * Unified checkbox selection logic for batch operations
 *
 * @module shared/selectionManager
 * @version 1.0.0
 */

export class SelectionManager {
  private selectedIds: Set<number> = new Set();
  private onSelectionChange?: (selectedCount: number) => void;

  constructor(onSelectionChange?: (selectedCount: number) => void) {
    this.onSelectionChange = onSelectionChange;
  }

  toggleSelection(id: number): void {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
    this.notifyChange();
  }

  selectAll(ids: number[]): void {
    ids.forEach(id => this.selectedIds.add(id));
    this.notifyChange();
  }

  clearSelection(): void {
    this.selectedIds.clear();
    this.notifyChange();
  }

  getSelectedIds(): number[] {
    return Array.from(this.selectedIds);
  }

  getSelectedCount(): number {
    return this.selectedIds.size;
  }

  isSelected(id: number): boolean {
    return this.selectedIds.has(id);
  }

  private notifyChange(): void {
    if (this.onSelectionChange) {
      this.onSelectionChange(this.selectedIds.size);
    }
  }

  /**
   * Update batch action button UI
   * @param buttonId - Button element ID
   */
  updateBatchButtonUI(buttonId: string): void {
    const button = document.getElementById(buttonId) as HTMLButtonElement;
    if (!button) return;

    const count = this.selectedIds.size;
    button.disabled = count === 0;

    const countBadge = button.querySelector('[data-role="count"]');
    if (countBadge) {
      countBadge.textContent = count > 0 ? `(${count})` : '';
    }
  }
}
