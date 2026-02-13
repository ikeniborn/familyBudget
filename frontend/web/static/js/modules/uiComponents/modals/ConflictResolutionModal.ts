/**
 * ConflictResolutionModal - Manual conflict resolution UI for Shopping Lists
 * Task-013: Conflict Resolution Modal UI
 *
 * Displays side-by-side comparison of server and client versions with resolution actions:
 * - Use Server Version (green)
 * - Keep My Version (blue)
 * - Merge Changes (disabled in Phase 1)
 */

import { BaseModal } from './BaseModal';
import type { BaseModalProps } from '../types';
import type {
  ShoppingConflictDetection,
  ResolutionStrategy,
  FieldDiff,
  FieldValue,
} from '../../../../../../shared/db/dexie/types/conflicts';

/**
 * Props for ConflictResolutionModal
 */
export interface ConflictResolutionModalProps extends Omit<BaseModalProps, 'content' | 'title'> {
  /** Conflict data to display */
  conflict: ShoppingConflictDetection;

  /** Callback when user selects a resolution strategy */
  onResolve: (strategy: ResolutionStrategy) => Promise<void>;

  /** Callback when user cancels (optional) */
  onCancel?: () => void;
}

/**
 * ConflictResolutionModal class
 * Extends BaseModal with custom rendering for conflict resolution UI
 */
export class ConflictResolutionModal extends BaseModal {
  private conflictProps: ConflictResolutionModalProps;
  private isResolving: boolean = false;

  constructor(props: ConflictResolutionModalProps) {
    // Convert to BaseModalProps for parent constructor
    const baseProps: BaseModalProps = {
      id: props.id,
      title: 'Конфликт синхронизации',
      size: 'max-w-4xl',
      content: '', // Will be set in render()
      hideCloseButton: props.hideCloseButton,
      disableBackdropClose: true, // Force user to choose resolution
      onOpen: props.onOpen,
      onClose: props.onClose,
    };

    super(baseProps);
    this.conflictProps = props;
  }

  /**
   * Override render to inject custom conflict UI
   */
  render(): HTMLDialogElement {
    // Call parent render
    const dialog = super.render();

    // Inject custom content
    const content = this.renderContent();
    this.setContent(content);

    return dialog;
  }

  /**
   * Render complete conflict resolution UI
   */
  private renderContent(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'space-y-4';

    // Info banner
    container.appendChild(this.renderInfoBanner());

    // Diff view (2 columns)
    container.appendChild(this.renderDiffView());

    // Resolution actions
    container.appendChild(this.renderActions());

    return container;
  }

  /**
   * Render warning banner with conflict information
   */
  private renderInfoBanner(): HTMLElement {
    const alert = document.createElement('div');
    alert.className = 'alert alert-warning';

    // Create SVG icon using DOM API (secure)
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('class', 'stroke-current shrink-0 w-6 h-6');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('d', 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z');
    icon.appendChild(path);
    alert.appendChild(icon);

    const text = document.createElement('span');
    const entityTypeLabel = this.conflictProps.conflict.entityType === 'shopping_list'
      ? 'списка покупок'
      : 'товара в списке';
    text.textContent = `Обнаружен конфликт изменений ${entityTypeLabel}. Выберите версию для сохранения.`;
    alert.appendChild(text);

    return alert;
  }

  /**
   * Render side-by-side diff view (server | client)
   */
  private renderDiffView(): HTMLElement {
    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-1 md:grid-cols-2 gap-4';

    // Server version card (left, green)
    grid.appendChild(this.renderVersionCard('server'));

    // Client version card (right, blue)
    grid.appendChild(this.renderVersionCard('client'));

    return grid;
  }

  /**
   * Render version card (server or client)
   */
  private renderVersionCard(version: 'server' | 'client'): HTMLElement {
    const card = document.createElement('div');
    const borderColor = version === 'server' ? 'border-success' : 'border-primary';
    card.className = `card bg-base-100 border-2 ${borderColor} shadow-md`;

    const cardBody = document.createElement('div');
    cardBody.className = 'card-body p-4';

    // Header with icon
    const header = document.createElement('h4');
    header.className = 'card-title text-base mb-3';
    const icon = version === 'server' ? '🌐' : '💻';
    const label = version === 'server' ? 'Версия сервера' : 'Моя версия';
    header.textContent = `${icon} ${label}`;
    cardBody.appendChild(header);

    // Timestamp
    const timestamp = version === 'server'
      ? this.conflictProps.conflict.serverUpdatedAt
      : this.conflictProps.conflict.localUpdatedAt;
    const timestampEl = document.createElement('p');
    timestampEl.className = 'text-sm text-base-content/70 mb-3';
    timestampEl.textContent = `Изменено: ${this.formatTimestamp(timestamp)}`;
    cardBody.appendChild(timestampEl);

    // Fields
    const fieldsContainer = document.createElement('div');
    fieldsContainer.className = 'space-y-2';

    for (const field of this.conflictProps.conflict.changedFields) {
      fieldsContainer.appendChild(this.renderFieldDiff(field, version));
    }

    cardBody.appendChild(fieldsContainer);
    card.appendChild(cardBody);

    return card;
  }

  /**
   * Render single field diff
   */
  private renderFieldDiff(field: FieldDiff, version: 'server' | 'client'): HTMLElement {
    const fieldContainer = document.createElement('div');
    fieldContainer.className = 'border-l-4 border-transparent pl-3 py-1';

    // Highlight if different
    if (field.isDifferent) {
      fieldContainer.classList.remove('border-transparent');
      fieldContainer.classList.add('border-warning', 'bg-warning/10');
    }

    // Label with badge
    const labelRow = document.createElement('div');
    labelRow.className = 'flex items-center gap-2 mb-1';

    const label = document.createElement('span');
    label.className = 'text-sm font-medium';
    label.textContent = field.fieldLabel;
    labelRow.appendChild(label);

    if (field.isDifferent) {
      const badge = document.createElement('span');
      badge.className = 'badge badge-warning badge-sm';
      badge.textContent = 'изменено';
      labelRow.appendChild(badge);
    }

    fieldContainer.appendChild(labelRow);

    // Value
    const value = version === 'server' ? field.serverValue : field.localValue;
    const valueEl = this.renderFieldValue(field, value);
    fieldContainer.appendChild(valueEl);

    return fieldContainer;
  }

  /**
   * Render field value based on data type
   */
  private renderFieldValue(field: FieldDiff, value: FieldValue): HTMLElement {
    const valueEl = document.createElement('div');
    valueEl.className = 'text-sm';

    // Handle null/undefined
    if (value === null || value === undefined) {
      valueEl.className += ' text-base-content/50 italic';
      valueEl.textContent = '(не указано)';
      return valueEl;
    }

    // Handle different data types
    switch (field.dataType) {
      case 'boolean':
        const badge = document.createElement('span');
        badge.className = typeof value === 'boolean' && value ? 'badge badge-success' : 'badge badge-ghost';
        badge.textContent = typeof value === 'boolean' && value ? 'Да' : 'Нет';
        valueEl.appendChild(badge);
        break;

      case 'number':
        valueEl.textContent = String(value);
        break;

      case 'date':
        const dateValue = value instanceof Date ? value : new Date(value as string | number);
        valueEl.textContent = this.formatTimestamp(dateValue);
        break;

      case 'reference':
        // Show ID (could be enhanced to show name via lookup)
        const refValue = typeof value === 'number' ? value : 0;
        valueEl.textContent = `ID: ${refValue}`;
        if (refValue === 0) {
          valueEl.className += ' text-base-content/50 italic';
          valueEl.textContent = '(не выбрано)';
        }
        break;

      case 'string':
      default:
        const strValue = String(value);
        valueEl.textContent = strValue;
        // Truncate long strings
        if (strValue.length > 100) {
          valueEl.textContent = strValue.substring(0, 97) + '...';
          valueEl.title = strValue; // Full text in tooltip
        }
        break;
    }

    return valueEl;
  }

  /**
   * Render resolution action buttons
   */
  private renderActions(): HTMLElement {
    const actions = document.createElement('div');
    actions.className = 'flex flex-wrap gap-2 justify-end pt-4 border-t';

    // Server button (green)
    const serverBtn = document.createElement('button');
    serverBtn.type = 'button';
    serverBtn.className = 'btn btn-success';
    serverBtn.textContent = '🌐 Использовать версию сервера';
    serverBtn.addEventListener('click', () => this.handleResolve('server'));
    actions.appendChild(serverBtn);

    // Client button (blue)
    const clientBtn = document.createElement('button');
    clientBtn.type = 'button';
    clientBtn.className = 'btn btn-primary';
    clientBtn.textContent = '💻 Сохранить мою версию';
    clientBtn.addEventListener('click', () => this.handleResolve('client'));
    actions.appendChild(clientBtn);

    // Merge button (Task-014: Enabled for smart merge)
    const mergeBtn = document.createElement('button');
    mergeBtn.type = 'button';
    mergeBtn.className = 'btn btn-warning';
    mergeBtn.textContent = '🔀 Объединить изменения';
    mergeBtn.addEventListener('click', () => this.handleResolve('merge'));
    actions.appendChild(mergeBtn);

    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-ghost';
    cancelBtn.textContent = 'Отмена';
    cancelBtn.addEventListener('click', () => this.handleCancel());
    actions.appendChild(cancelBtn);

    return actions;
  }

  /**
   * Handle resolution strategy selection
   */
  private async handleResolve(strategy: ResolutionStrategy): Promise<void> {
    if (this.isResolving) {
      return; // Prevent double-click
    }

    this.isResolving = true;

    try {
      // Disable all buttons
      this.setButtonsDisabled(true);

      // Show loading state
      this.showLoadingState(strategy);

      // Call onResolve callback
      await this.conflictProps.onResolve(strategy);

      // Close modal on success
      this.close();
    } catch (error) {
      console.error('[ConflictResolutionModal] Resolution failed:', error);

      // Re-enable buttons
      this.setButtonsDisabled(false);
      this.hideLoadingState();

      // Show error toast (if available)
      if (typeof window.showToast === 'function') {
        window.showToast('Ошибка при разрешении конфликта', 'error');
      } else {
        alert('Ошибка при разрешении конфликта. Попробуйте снова.');
      }
    } finally {
      this.isResolving = false;
    }
  }

  /**
   * Handle cancel action
   */
  private handleCancel(): void {
    if (this.conflictProps.onCancel) {
      this.conflictProps.onCancel();
    }
    this.close();
  }

  /**
   * Disable/enable all action buttons
   */
  private setButtonsDisabled(disabled: boolean): void {
    const dialog = this.getElement();
    if (!dialog) return;

    const buttons = dialog.querySelectorAll<HTMLButtonElement>('.btn');
    buttons.forEach(btn => {
      btn.disabled = disabled;
    });
  }

  /**
   * Show loading state on selected button
   */
  private showLoadingState(strategy: ResolutionStrategy): void {
    const dialog = this.getElement();
    if (!dialog) return;

    const className = strategy === 'server'
      ? 'btn-success'
      : strategy === 'client'
      ? 'btn-primary'
      : 'btn-warning'; // merge strategy
    const button = dialog.querySelector<HTMLButtonElement>(`.${className}`);

    if (button) {
      // Clear existing content
      button.textContent = '';

      // Create loading spinner
      const spinner = document.createElement('span');
      spinner.className = 'loading loading-spinner loading-sm';
      button.appendChild(spinner);

      // Add loading text
      const text = document.createTextNode(' Применение...');
      button.appendChild(text);
    }
  }

  /**
   * Hide loading state (restore original button text)
   */
  private hideLoadingState(): void {
    const dialog = this.getElement();
    if (!dialog) return;

    const serverBtn = dialog.querySelector<HTMLButtonElement>('.btn-success');
    if (serverBtn) {
      serverBtn.textContent = '🌐 Использовать версию сервера';
    }

    const clientBtn = dialog.querySelector<HTMLButtonElement>('.btn-primary');
    if (clientBtn) {
      clientBtn.textContent = '💻 Сохранить мою версию';
    }

    const mergeBtn = dialog.querySelector<HTMLButtonElement>('.btn-warning');
    if (mergeBtn) {
      mergeBtn.textContent = '🔀 Объединить изменения';
    }
  }

  /**
   * Format timestamp to Russian locale
   */
  private formatTimestamp(date: Date): string {
    return new Intl.DateTimeFormat('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  }
}
