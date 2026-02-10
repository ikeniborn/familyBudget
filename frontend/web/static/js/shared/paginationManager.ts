/**
 * Pagination Manager
 *
 * Unified pagination state management for Facts/Plans tables
 *
 * @module shared/paginationManager
 * @version 1.0.0
 */

export class PaginationManager {
  private currentPage = 0;
  private pageSize: number;
  private totalRecords = 0;

  constructor(pageSize: number = 50) {
    this.pageSize = pageSize;
  }

  getCurrentPage(): number {
    return this.currentPage;
  }

  setCurrentPage(page: number): void {
    const totalPages = this.getTotalPages();
    this.currentPage = Math.max(0, Math.min(page, totalPages - 1));
  }

  nextPage(): void {
    this.setCurrentPage(this.currentPage + 1);
  }

  previousPage(): void {
    this.setCurrentPage(this.currentPage - 1);
  }

  getTotalPages(): number {
    return Math.ceil(this.totalRecords / this.pageSize);
  }

  getPageStart(): number {
    return this.currentPage * this.pageSize + 1;
  }

  getPageEnd(): number {
    return Math.min((this.currentPage + 1) * this.pageSize, this.totalRecords);
  }

  setTotalRecords(total: number): void {
    this.totalRecords = total;
  }

  /**
   * Update pagination UI controls
   * @param controlsId - Container element ID
   */
  updateUI(controlsId: string): void {
    const container = document.getElementById(controlsId);
    if (!container) return;

    const prevBtn = container.querySelector('[data-action="prev"]') as HTMLButtonElement;
    const nextBtn = container.querySelector('[data-action="next"]') as HTMLButtonElement;
    const pageInfo = container.querySelector('[data-role="page-info"]');

    if (prevBtn) prevBtn.disabled = this.currentPage === 0;
    if (nextBtn) nextBtn.disabled = this.currentPage >= this.getTotalPages() - 1;
    if (pageInfo) {
      pageInfo.textContent = `Страница ${this.currentPage + 1} из ${this.getTotalPages()}`;
    }
  }

  /**
   * Get offset for API calls
   * @returns Offset value for limit/offset pagination
   */
  getOffset(): number {
    return this.currentPage * this.pageSize;
  }

  /**
   * Get page size
   * @returns Number of records per page
   */
  getPageSize(): number {
    return this.pageSize;
  }
}
