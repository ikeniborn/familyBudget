/**
 * Conflict Resolver для Family Budget PWA
 * Разрешение конфликтов при синхронизации offline данных
 *
 * Strategies:
 * - LWW (Last-Write-Wins) - для non-critical fields
 * - Manual Confirmation - для critical fields (amount, article_id, etc.)
 * - Field-level Merge - для text fields (description)
 *
 * @version 1.0.0
 */

class ConflictResolver {
    constructor() {
        this.criticalFields = ['amount', 'article_id', 'financial_center_id', 'plan_month'];
        this.textFields = ['description'];
    }

    /**
     * Resolve conflict между offline и server данными
     * @param {Object} offlineData - Offline версия
     * @param {Object} serverData - Server версия
     * @param {string} entity - Тип entity ('fact', 'transfer', 'plan')
     * @param {boolean} autoResolve - Автоматическое разрешение (LWW)
     * @returns {Promise<Object>} Resolved data
     */
    async resolve(offlineData, serverData, entity, autoResolve = false) {
        // Check if there's actually a conflict
        if (!this.hasConflict(offlineData, serverData)) {
            return offlineData.data;
        }

        // Auto-resolve with LWW
        if (autoResolve) {
            return this.resolveLWW(offlineData, serverData);
        }

        // Manual resolution required
        const hasCriticalChanges = this.hasCriticalFieldChanges(offlineData, serverData, entity);

        if (hasCriticalChanges) {
            return await this.showConflictDialog(offlineData, serverData, entity);
        } else {
            // Non-critical changes, auto-merge
            return this.mergeNonCritical(offlineData, serverData);
        }
    }

    /**
     * Check if there's a conflict
     * @private
     */
    hasConflict(offlineData, serverData) {
        const offlineTime = offlineData.createdAt || offlineData.updatedAt;
        const serverTime = new Date(serverData.updated_at || serverData.created_at).getTime();

        // No conflict if offline data is newer
        if (offlineTime > serverTime) {
            return false;
        }

        // Check if any fields differ
        const offlineFields = offlineData.data || offlineData;
        const serverFields = serverData;

        for (const key of Object.keys(offlineFields)) {
            if (offlineFields[key] !== serverFields[key]) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if critical fields changed
     * @private
     */
    hasCriticalFieldChanges(offlineData, serverData, entity) {
        const offlineFields = offlineData.data || offlineData;
        const serverFields = serverData;

        for (const field of this.criticalFields) {
            if (offlineFields[field] !== serverFields[field]) {
                return true;
            }
        }

        return false;
    }

    /**
     * LWW (Last-Write-Wins) resolution
     * @private
     */
    resolveLWW(offlineData, serverData) {
        const offlineTime = offlineData.createdAt || offlineData.updatedAt;
        const serverTime = new Date(serverData.updated_at || serverData.created_at).getTime();

        if (offlineTime > serverTime) {
            return offlineData.data || offlineData;
        } else {
            return serverData;
        }
    }

    /**
     * Merge non-critical fields
     * @private
     */
    mergeNonCritical(offlineData, serverData) {
        const offlineFields = offlineData.data || offlineData;
        const serverFields = serverData;
        const merged = { ...serverFields };

        // Merge text fields (concatenate)
        for (const field of this.textFields) {
            if (offlineFields[field] && serverFields[field] &&
                offlineFields[field] !== serverFields[field]) {
                merged[field] = `${offlineFields[field]}\n---\n[Server]: ${serverFields[field]}`;
            } else if (offlineFields[field]) {
                merged[field] = offlineFields[field];
            }
        }

        return merged;
    }

    /**
     * Show conflict resolution dialog
     * @private
     */
    async showConflictDialog(offlineData, serverData, entity) {
        return new Promise((resolve, reject) => {
            const modal = this.createConflictModal(offlineData, serverData, entity, resolve, reject);
            document.body.appendChild(modal);
            modal.showModal();
        });
    }

    /**
     * Create conflict resolution modal
     * @private
     */
    createConflictModal(offlineData, serverData, entity, resolve, reject) {
        const offlineFields = offlineData.data || offlineData;
        const serverFields = serverData;

        const modal = document.createElement('dialog');
        modal.id = 'conflict_resolution_modal';
        modal.className = 'modal';

        const entityLabel = entity === 'fact' ? 'Транзакция' :
                           entity === 'transfer' ? 'Перевод' : 'План';

        modal.innerHTML = `
            <div class="modal-box max-w-4xl">
                <h3 class="font-bold text-lg mb-4">
                    ⚠️ Конфликт синхронизации: ${entityLabel}
                </h3>

                <div class="alert alert-warning mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>Данные изменились на сервере. Выберите какую версию сохранить.</span>
                </div>

                <div class="grid grid-cols-2 gap-4 mb-4">
                    <!-- Offline Version -->
                    <div class="card bg-base-200">
                        <div class="card-body">
                            <h4 class="card-title text-sm">📱 Ваша версия (оффлайн)</h4>
                            <div class="space-y-2 text-sm">
                                ${this.renderFieldComparison(offlineFields, serverFields, 'offline')}
                            </div>
                        </div>
                    </div>

                    <!-- Server Version -->
                    <div class="card bg-base-200">
                        <div class="card-body">
                            <h4 class="card-title text-sm">☁️ Серверная версия</h4>
                            <div class="space-y-2 text-sm">
                                ${this.renderFieldComparison(offlineFields, serverFields, 'server')}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="form-control mb-4">
                    <label class="label cursor-pointer">
                        <span class="label-text">Автоматически разрешать будущие конфликты (Last-Write-Wins)</span>
                        <input type="checkbox" id="conflict_auto_resolve" class="checkbox checkbox-sm" />
                    </label>
                </div>

                <div class="modal-action">
                    <button type="button" class="btn btn-error" data-action="cancel">
                        Отменить синхронизацию
                    </button>
                    <button type="button" class="btn btn-outline" data-action="server">
                        Использовать серверную версию
                    </button>
                    <button type="button" class="btn btn-primary" data-action="offline">
                        Использовать мою версию
                    </button>
                </div>
            </div>
        `;

        // Event handlers
        modal.querySelectorAll('button[data-action]').forEach(button => {
            button.addEventListener('click', () => {
                const action = button.dataset.action;
                const autoResolve = document.getElementById('conflict_auto_resolve').checked;

                // Save auto-resolve preference
                if (autoResolve) {
                    localStorage.setItem('conflict_auto_resolve', 'true');
                }

                if (action === 'cancel') {
                    modal.close();
                    document.body.removeChild(modal);
                    reject(new Error('User cancelled conflict resolution'));
                } else if (action === 'offline') {
                    modal.close();
                    document.body.removeChild(modal);
                    resolve(offlineFields);
                } else if (action === 'server') {
                    modal.close();
                    document.body.removeChild(modal);
                    resolve(serverFields);
                }
            });
        });

        return modal;
    }

    /**
     * Render field comparison
     * @private
     */
    renderFieldComparison(offlineFields, serverFields, version) {
        const fields = version === 'offline' ? offlineFields : serverFields;
        const otherFields = version === 'offline' ? serverFields : offlineFields;

        const html = [];

        // Amount
        if (fields.amount !== undefined) {
            const isDiff = fields.amount !== otherFields.amount;
            html.push(`
                <div class="${isDiff ? 'text-warning font-bold' : ''}">
                    <span class="opacity-60">Сумма:</span>
                    <span>${fields.amount} ₽</span>
                    ${isDiff ? '<span class="badge badge-warning badge-xs ml-1">!</span>' : ''}
                </div>
            `);
        }

        // Date
        if (fields.fact_date || fields.transfer_date || fields.plan_month) {
            const dateField = fields.fact_date || fields.transfer_date || fields.plan_month;
            const otherDateField = otherFields.fact_date || otherFields.transfer_date || otherFields.plan_month;
            const isDiff = dateField !== otherDateField;
            html.push(`
                <div class="${isDiff ? 'text-warning font-bold' : ''}">
                    <span class="opacity-60">Дата:</span>
                    <span>${dateField}</span>
                    ${isDiff ? '<span class="badge badge-warning badge-xs ml-1">!</span>' : ''}
                </div>
            `);
        }

        // Article ID (simplified)
        if (fields.article_id !== undefined) {
            const isDiff = fields.article_id !== otherFields.article_id;
            html.push(`
                <div class="${isDiff ? 'text-warning font-bold' : ''}">
                    <span class="opacity-60">Категория ID:</span>
                    <span>${fields.article_id}</span>
                    ${isDiff ? '<span class="badge badge-warning badge-xs ml-1">!</span>' : ''}
                </div>
            `);
        }

        // Description
        if (fields.description) {
            const isDiff = fields.description !== otherFields.description;
            html.push(`
                <div class="${isDiff ? 'text-warning font-bold' : ''}">
                    <span class="opacity-60">Описание:</span>
                    <span class="break-words">${fields.description || '—'}</span>
                    ${isDiff ? '<span class="badge badge-warning badge-xs ml-1">!</span>' : ''}
                </div>
            `);
        }

        return html.join('');
    }

    /**
     * Check if auto-resolve is enabled
     * @returns {boolean}
     */
    isAutoResolveEnabled() {
        return localStorage.getItem('conflict_auto_resolve') === 'true';
    }

    /**
     * Enable/disable auto-resolve
     */
    setAutoResolve(enabled) {
        if (enabled) {
            localStorage.setItem('conflict_auto_resolve', 'true');
        } else {
            localStorage.removeItem('conflict_auto_resolve');
        }
    }
}

// Export as global
if (typeof window !== 'undefined') {
    window.ConflictResolver = ConflictResolver;
}
