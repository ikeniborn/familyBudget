import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

// Types for context menu
export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: () => void;
  disabled?: boolean;
  danger?: boolean;
  separator?: boolean;
  submenu?: ContextMenuItem[];
  shortcut?: string;
}

export interface ContextMenuProps {
  items: ContextMenuItem[];
  onClose: () => void;
  position: { x: number; y: number };
  className?: string;
}

export interface UseContextMenuOptions {
  onContextMenu?: (event: React.MouseEvent, data?: any) => ContextMenuItem[] | void;
  disabled?: boolean;
}

// Context Menu Component
export const ContextMenu: React.FC<ContextMenuProps> = ({
  items,
  onClose,
  position,
  className = ''
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [submenuState, setSubmenuState] = useState<{
    item: ContextMenuItem | null;
    position: { x: number; y: number };
  }>({ item: null, position: { x: 0, y: 0 } });

  // Close menu on outside click or escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Position menu to stay within viewport
  useEffect(() => {
    if (menuRef.current) {
      const menu = menuRef.current;
      const rect = menu.getBoundingClientRect();
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight
      };

      let { x, y } = position;

      // Adjust horizontal position
      if (x + rect.width > viewport.width) {
        x = viewport.width - rect.width - 10;
      }

      // Adjust vertical position
      if (y + rect.height > viewport.height) {
        y = viewport.height - rect.height - 10;
      }

      menu.style.left = `${Math.max(10, x)}px`;
      menu.style.top = `${Math.max(10, y)}px`;
    }
  }, [position]);

  const handleItemClick = (item: ContextMenuItem, event: React.MouseEvent) => {
    event.stopPropagation();

    if (item.disabled) return;

    if (item.submenu) {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      setSubmenuState({
        item,
        position: { x: rect.right, y: rect.top }
      });
      return;
    }

    if (item.action) {
      item.action();
    }

    onClose();
  };

  const handleMouseEnter = (item: ContextMenuItem, event: React.MouseEvent) => {
    if (item.submenu) {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      setSubmenuState({
        item,
        position: { x: rect.right, y: rect.top }
      });
    } else if (submenuState.item) {
      setSubmenuState({ item: null, position: { x: 0, y: 0 } });
    }
  };

  const renderMenuItem = (item: ContextMenuItem, index: number) => {
    if (item.separator) {
      return <div key={`separator-${index}`} className="border-t border-gray-200 my-1" />;
    }

    const Icon = item.icon;

    return (
      <button
        key={item.id}
        className={`
          w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-100 
          ${item.disabled ? 'text-gray-400 cursor-not-allowed' : ''}
          ${item.danger ? 'text-red-600 hover:bg-red-50' : ''}
          ${submenuState.item?.id === item.id ? 'bg-gray-100' : ''}
        `}
        onClick={(e) => handleItemClick(item, e)}
        onMouseEnter={(e) => handleMouseEnter(item, e)}
        disabled={item.disabled}
      >
        {Icon && <Icon className="h-4 w-4" />}
        <span className="flex-1">{item.label}</span>
        {item.shortcut && (
          <span className="text-xs text-gray-400">{item.shortcut}</span>
        )}
        {item.submenu && (
          <span className="text-gray-400">▶</span>
        )}
      </button>
    );
  };

  return createPortal(
    <>
      <div
        ref={menuRef}
        className={`
          fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-48
          ${className}
        `}
        style={{ left: position.x, top: position.y }}
      >
        {items.map(renderMenuItem)}
      </div>

      {/* Submenu */}
      {submenuState.item?.submenu && (
        <ContextMenu
          items={submenuState.item.submenu}
          position={submenuState.position}
          onClose={() => setSubmenuState({ item: null, position: { x: 0, y: 0 } })}
          className="ml-1"
        />
      )}
    </>,
    document.body
  );
};

// Hook for using context menus
export const useContextMenu = (options: UseContextMenuOptions = {}) => {
  const { onContextMenu, disabled = false } = options;
  const [contextMenu, setContextMenu] = useState<{
    items: ContextMenuItem[];
    position: { x: number; y: number };
  } | null>(null);

  const showContextMenu = useCallback((
    event: React.MouseEvent,
    items: ContextMenuItem[],
    data?: any
  ) => {
    if (disabled) return;

    event.preventDefault();
    event.stopPropagation();

    setContextMenu({
      items,
      position: { x: event.clientX, y: event.clientY }
    });
  }, [disabled]);

  const hideContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleContextMenu = useCallback((event: React.MouseEvent, data?: any) => {
    if (disabled || !onContextMenu) return;

    const items = onContextMenu(event, data);
    if (items && Array.isArray(items)) {
      showContextMenu(event, items, data);
    }
  }, [disabled, onContextMenu, showContextMenu]);

  return {
    contextMenu,
    showContextMenu,
    hideContextMenu,
    handleContextMenu,
    contextMenuProps: {
      onContextMenu: handleContextMenu
    }
  };
};

// Pre-built context menu items for common actions
export const createCommonMenuItems = (actions: {
  edit?: () => void;
  duplicate?: () => void;
  delete?: () => void;
  copy?: () => void;
  paste?: () => void;
  cut?: () => void;
  refresh?: () => void;
  properties?: () => void;
  export?: () => void;
  archive?: () => void;
  activate?: () => void;
  deactivate?: () => void;
}): ContextMenuItem[] => {
  const items: ContextMenuItem[] = [];

  if (actions.edit) {
    items.push({
      id: 'edit',
      label: 'Редактировать',
      action: actions.edit,
      shortcut: 'F2'
    });
  }

  if (actions.duplicate) {
    items.push({
      id: 'duplicate',
      label: 'Дублировать',
      action: actions.duplicate,
      shortcut: 'Ctrl+D'
    });
  }

  if (actions.copy || actions.cut || actions.paste) {
    if (items.length > 0) {
      items.push({ id: 'sep1', label: '', separator: true });
    }

    if (actions.copy) {
      items.push({
        id: 'copy',
        label: 'Копировать',
        action: actions.copy,
        shortcut: 'Ctrl+C'
      });
    }

    if (actions.cut) {
      items.push({
        id: 'cut',
        label: 'Вырезать',
        action: actions.cut,
        shortcut: 'Ctrl+X'
      });
    }

    if (actions.paste) {
      items.push({
        id: 'paste',
        label: 'Вставить',
        action: actions.paste,
        shortcut: 'Ctrl+V'
      });
    }
  }

  if (actions.activate || actions.deactivate) {
    if (items.length > 0) {
      items.push({ id: 'sep2', label: '', separator: true });
    }

    if (actions.activate) {
      items.push({
        id: 'activate',
        label: 'Активировать',
        action: actions.activate
      });
    }

    if (actions.deactivate) {
      items.push({
        id: 'deactivate',
        label: 'Деактивировать',
        action: actions.deactivate
      });
    }
  }

  if (actions.export || actions.archive) {
    if (items.length > 0) {
      items.push({ id: 'sep3', label: '', separator: true });
    }

    if (actions.export) {
      items.push({
        id: 'export',
        label: 'Экспорт',
        action: actions.export
      });
    }

    if (actions.archive) {
      items.push({
        id: 'archive',
        label: 'Архивировать',
        action: actions.archive
      });
    }
  }

  if (actions.refresh) {
    if (items.length > 0) {
      items.push({ id: 'sep4', label: '', separator: true });
    }

    items.push({
      id: 'refresh',
      label: 'Обновить',
      action: actions.refresh,
      shortcut: 'F5'
    });
  }

  if (actions.properties) {
    if (items.length > 0) {
      items.push({ id: 'sep5', label: '', separator: true });
    }

    items.push({
      id: 'properties',
      label: 'Свойства',
      action: actions.properties
    });
  }

  if (actions.delete) {
    if (items.length > 0) {
      items.push({ id: 'sep6', label: '', separator: true });
    }

    items.push({
      id: 'delete',
      label: 'Удалить',
      action: actions.delete,
      danger: true,
      shortcut: 'Delete'
    });
  }

  return items;
};