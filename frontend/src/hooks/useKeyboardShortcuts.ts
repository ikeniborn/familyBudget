import { useEffect, useCallback, useRef } from 'react';

// Types for keyboard shortcuts
export interface KeyboardShortcut {
  id: string;
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  description: string;
  action: () => void;
  preventDefault?: boolean;
  scope?: string; // Optional scope to limit shortcuts to specific components
}

export interface ShortcutGroup {
  name: string;
  shortcuts: KeyboardShortcut[];
}

// Global shortcuts registry
class ShortcutsRegistry {
  private shortcuts: Map<string, KeyboardShortcut> = new Map();
  private listeners: Set<(event: KeyboardEvent) => void> = new Set();
  private scopeStack: string[] = ['global']; // Stack to handle nested scopes

  constructor() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
    document.addEventListener('keydown', this.handleKeyDown);
  }

  register(shortcut: KeyboardShortcut): () => void {
    const key = this.getShortcutKey(shortcut);
    this.shortcuts.set(key, shortcut);

    return () => {
      this.shortcuts.delete(key);
    };
  }

  registerMultiple(shortcuts: KeyboardShortcut[]): () => void {
    const unregisterFunctions = shortcuts.map(shortcut => this.register(shortcut));
    
    return () => {
      unregisterFunctions.forEach(unregister => unregister());
    };
  }

  pushScope(scope: string): void {
    this.scopeStack.push(scope);
  }

  popScope(): void {
    if (this.scopeStack.length > 1) {
      this.scopeStack.pop();
    }
  }

  getCurrentScope(): string {
    return this.scopeStack[this.scopeStack.length - 1];
  }

  private handleKeyDown(event: KeyboardEvent): void {
    // Don't trigger shortcuts when user is typing in input fields
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    const currentScope = this.getCurrentScope();
    
    for (const [key, shortcut] of this.shortcuts) {
      if (this.matchesShortcut(event, shortcut) && this.isInScope(shortcut, currentScope)) {
        if (shortcut.preventDefault !== false) {
          event.preventDefault();
        }
        shortcut.action();
        break;
      }
    }
  }

  private matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
    return (
      event.key.toLowerCase() === shortcut.key.toLowerCase() &&
      !!event.ctrlKey === !!shortcut.ctrlKey &&
      !!event.altKey === !!shortcut.altKey &&
      !!event.shiftKey === !!shortcut.shiftKey &&
      !!event.metaKey === !!shortcut.metaKey
    );
  }

  private isInScope(shortcut: KeyboardShortcut, currentScope: string): boolean {
    if (!shortcut.scope) return true; // Global shortcuts work everywhere
    return shortcut.scope === currentScope || shortcut.scope === 'global';
  }

  private getShortcutKey(shortcut: KeyboardShortcut): string {
    const modifiers = [
      shortcut.ctrlKey && 'ctrl',
      shortcut.altKey && 'alt',
      shortcut.shiftKey && 'shift',
      shortcut.metaKey && 'meta'
    ].filter(Boolean).join('+');
    
    return `${shortcut.scope || 'global'}:${modifiers}+${shortcut.key.toLowerCase()}`;
  }

  getRegisteredShortcuts(): ShortcutGroup[] {
    const groups: Record<string, KeyboardShortcut[]> = {};
    
    for (const shortcut of this.shortcuts.values()) {
      const scope = shortcut.scope || 'global';
      if (!groups[scope]) {
        groups[scope] = [];
      }
      groups[scope].push(shortcut);
    }

    return Object.entries(groups).map(([name, shortcuts]) => ({
      name: this.getScopeDisplayName(name),
      shortcuts: shortcuts.sort((a, b) => a.description.localeCompare(b.description))
    }));
  }

  private getScopeDisplayName(scope: string): string {
    const displayNames: Record<string, string> = {
      global: 'Глобальные',
      settings: 'Настройки',
      periods: 'Периоды',
      financial_centers: 'Финансовые центры',
      cost_centers: 'Центры затрат',
      nomenclatures: 'Номенклатуры',
      products: 'Продукты'
    };
    
    return displayNames[scope] || scope;
  }
}

// Global registry instance
export const shortcutsRegistry = new ShortcutsRegistry();

// Hook for using keyboard shortcuts
export const useKeyboardShortcuts = (
  shortcuts: KeyboardShortcut[] | KeyboardShortcut,
  dependencies: any[] = []
) => {
  const shortcutsArray = Array.isArray(shortcuts) ? shortcuts : [shortcuts];
  const unregisterRef = useRef<(() => void) | null>(null);

  const memoizedShortcuts = useCallback(() => {
    return shortcutsArray.map(shortcut => ({
      ...shortcut,
      action: () => {
        shortcut.action();
      }
    }));
  }, dependencies);

  useEffect(() => {
    const shortcutsToRegister = memoizedShortcuts();
    unregisterRef.current = shortcutsRegistry.registerMultiple(shortcutsToRegister);

    return () => {
      if (unregisterRef.current) {
        unregisterRef.current();
      }
    };
  }, [memoizedShortcuts]);
};

// Hook for managing shortcut scopes
export const useShortcutScope = (scope: string) => {
  useEffect(() => {
    shortcutsRegistry.pushScope(scope);
    
    return () => {
      shortcutsRegistry.popScope();
    };
  }, [scope]);
};

// Utility function to format shortcut display
export const formatShortcut = (shortcut: KeyboardShortcut): string => {
  const parts = [];
  
  if (shortcut.ctrlKey) parts.push('Ctrl');
  if (shortcut.altKey) parts.push('Alt');
  if (shortcut.shiftKey) parts.push('Shift');
  if (shortcut.metaKey) parts.push('Cmd');
  
  parts.push(shortcut.key.toUpperCase());
  
  return parts.join(' + ');
};

// Predefined common shortcuts
export const createCommonShortcuts = (actions: {
  save?: () => void;
  cancel?: () => void;
  delete?: () => void;
  edit?: () => void;
  search?: () => void;
  refresh?: () => void;
  help?: () => void;
  newItem?: () => void;
  copy?: () => void;
  paste?: () => void;
  undo?: () => void;
  redo?: () => void;
  selectAll?: () => void;
  find?: () => void;
}): KeyboardShortcut[] => {
  const shortcuts: KeyboardShortcut[] = [];

  if (actions.save) {
    shortcuts.push({
      id: 'save',
      key: 's',
      ctrlKey: true,
      description: 'Сохранить',
      action: actions.save
    });
  }

  if (actions.cancel) {
    shortcuts.push({
      id: 'cancel',
      key: 'Escape',
      description: 'Отмена',
      action: actions.cancel
    });
  }

  if (actions.delete) {
    shortcuts.push({
      id: 'delete',
      key: 'Delete',
      description: 'Удалить',
      action: actions.delete
    });
  }

  if (actions.edit) {
    shortcuts.push({
      id: 'edit',
      key: 'F2',
      description: 'Редактировать',
      action: actions.edit
    });
  }

  if (actions.search) {
    shortcuts.push({
      id: 'search',
      key: 'f',
      ctrlKey: true,
      description: 'Поиск',
      action: actions.search
    });
  }

  if (actions.refresh) {
    shortcuts.push({
      id: 'refresh',
      key: 'F5',
      description: 'Обновить',
      action: actions.refresh
    });
  }

  if (actions.help) {
    shortcuts.push({
      id: 'help',
      key: 'F1',
      description: 'Справка',
      action: actions.help
    });
  }

  if (actions.newItem) {
    shortcuts.push({
      id: 'new',
      key: 'n',
      ctrlKey: true,
      description: 'Создать',
      action: actions.newItem
    });
  }

  if (actions.copy) {
    shortcuts.push({
      id: 'copy',
      key: 'c',
      ctrlKey: true,
      description: 'Копировать',
      action: actions.copy
    });
  }

  if (actions.paste) {
    shortcuts.push({
      id: 'paste',
      key: 'v',
      ctrlKey: true,
      description: 'Вставить',
      action: actions.paste
    });
  }

  if (actions.undo) {
    shortcuts.push({
      id: 'undo',
      key: 'z',
      ctrlKey: true,
      description: 'Отменить',
      action: actions.undo
    });
  }

  if (actions.redo) {
    shortcuts.push({
      id: 'redo',
      key: 'y',
      ctrlKey: true,
      description: 'Повторить',
      action: actions.redo
    });
  }

  if (actions.selectAll) {
    shortcuts.push({
      id: 'selectAll',
      key: 'a',
      ctrlKey: true,
      description: 'Выделить все',
      action: actions.selectAll
    });
  }

  if (actions.find) {
    shortcuts.push({
      id: 'find',
      key: 'f',
      ctrlKey: true,
      shiftKey: true,
      description: 'Расширенный поиск',
      action: actions.find
    });
  }

  return shortcuts;
};