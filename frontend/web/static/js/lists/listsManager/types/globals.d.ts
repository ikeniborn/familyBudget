// Global declarations for external dependencies
declare global {
  interface Window {
    // From base.html
    showToast(message: string, type?: 'success' | 'error' | 'warning' | 'info'): void;
    showConfirmDialog(message: string, title?: string): Promise<boolean>;
    logAPI: any;
    htmx: any;

    // Dexie Manager (offline database)
    dexieManager?: import('@db/dexie').DexieManager;

    // From hierarchyView.js
    hierarchyView: any;
    HierarchyView: any;

    // From importManager.js
    importManager: any;

    // Lists bundle exports (from listsManager modular structure)
    initializeListsManager(): Promise<void>;
    initializeHierarchyView(): void;
    initializeImportManager(): void;
    loadShoppingLists(): Promise<void>;
    showLandingView(): void;
    showDetailView(listId: number): Promise<void>;
    openAddItemModal(): void;
    openCreateListModal(): void;
    closeCreateListModal(): void;
    closeItemModal(): void;
    openDeleteListModal(listId: number, listName: string): void;
    closeDeleteListModal(): void;
    clearItemsSearch(): void;
    toggleHideCompleted(): void;
    toggleSearchField(): void;
    handleItemsSearch(query: string): void;
    switchView(viewName: 'table' | 'hierarchy'): void;
    initializeResponsiveView(): void;
    toggleListsFAB(): void;
    markAllCompletedWithConfirm(): Promise<void>;
    unmarkAllCompletedWithConfirm(): Promise<void>;
    deleteCompletedWithConfirm(): Promise<void>;
    toggleAllNodes(): void;
    closeImportWizard(): void;
    toggleImportWizard(): void;

    // Backward compatibility object (created by lists-bundle.ts)
    listsManager?: {
      showDetailView(listId: number): Promise<void>;
      toggleItemCompleted(itemId: number, completed: boolean): Promise<void>;
      // WebSocket compatibility aliases (v7.0.1 - for budgetWSClient)
      addItemToUI(item: any): void;
      updateItemInUI(item: any): void;
      removeItemFromUI(itemId: number, shoppingListId: number): void;
    };
  }
}

export {};
