"use strict";
/**
 * Conflict Resolver - Resolves sync conflicts between offline and server data.
 *
 * Strategies:
 * - Last-Write-Wins (LWW) by timestamp
 * - Manual resolution via modal for critical fields
 * - Field-level merge for text fields
 *
 * ВАЖНО: Если entity не найдена на сервере (404), локальная версия побеждает.
 *
 * @version 2.0.0
 * @date 2026-01-05
 */
class ConflictResolver {
    /**
     * Конструктор.
     * Определяет критические поля (требуют ручного выбора) и текстовые поля (можно объединять).
     */
    constructor() {
        // Критические поля - автоматически не разрешаются
        this.criticalFields = [
            'amount',
            'article_id',
            'financial_center_id',
            'plan_month'
        ];
        // Текстовые поля - могут быть объединены
        this.textFields = ['description'];
    }
    /**
     * Разрешить конфликт между offline и server данными.
     *
     * @param offlineData - Локальная версия (с tempId)
     * @param serverData - Серверная версия (с server_id)
     * @param entity - Тип сущности ('fact', 'transfer', 'plan')
     * @param autoResolve - Автоматически применить LWW (default: false)
     * @returns Разрешенные данные
     */
    async resolve(offlineData, serverData, entity, autoResolve = false) {
        if (window.logSync) {
            window.logSync.warn('Conflict detected:', {
                offline: offlineData,
                server: serverData,
                entity
            });
        }
        // Edge case: Если serverData = null/undefined, то offline побеждает
        if (!serverData) {
            if (window.logSync) {
                window.logSync.info('Server data missing - offline wins');
            }
            return offlineData;
        }
        // Автоматическое разрешение через LWW
        if (autoResolve) {
            return this._applyLastWriteWins(offlineData, serverData);
        }
        // Проверить наличие критических конфликтов
        const hasCriticalConflict = this._hasCriticalConflict(offlineData, serverData);
        if (!hasCriticalConflict) {
            // Нет критических конфликтов - объединяем текстовые поля
            return this._mergeNonCriticalFields(offlineData, serverData);
        }
        // Критический конфликт - показываем UI для ручного выбора
        return this._showManualResolutionModal(offlineData, serverData, entity);
    }
    /**
     * Применить стратегию Last-Write-Wins (LWW).
     * Выбирается запись с более поздним updated_at.
     *
     * @param offlineData - Локальная версия
     * @param serverData - Серверная версия
     * @returns Запись с более поздним updated_at
     */
    _applyLastWriteWins(offlineData, serverData) {
        const offlineTime = offlineData.updated_at
            ? new Date(offlineData.updated_at).getTime()
            : 0;
        const serverTime = serverData.updated_at
            ? new Date(serverData.updated_at).getTime()
            : 0;
        if (window.logSync) {
            window.logSync.info('LWW:', {
                offlineTime: new Date(offlineTime).toISOString(),
                serverTime: new Date(serverTime).toISOString()
            });
        }
        return offlineTime > serverTime ? offlineData : serverData;
    }
    /**
     * Проверить наличие конфликтов в критических полях.
     *
     * @param offlineData - Локальная версия
     * @param serverData - Серверная версия
     * @returns true если есть конфликты в критических полях
     */
    _hasCriticalConflict(offlineData, serverData) {
        for (const field of this.criticalFields) {
            if (offlineData[field] !== undefined &&
                serverData[field] !== undefined &&
                offlineData[field] !== serverData[field]) {
                return true;
            }
        }
        return false;
    }
    /**
     * Объединить некритические поля (текстовые).
     * Server данные + offline текстовые поля.
     *
     * @param offlineData - Локальная версия
     * @param serverData - Серверная версия
     * @returns Объединенные данные (server + offline text fields)
     */
    _mergeNonCriticalFields(offlineData, serverData) {
        const merged = { ...serverData };
        // Объединяем текстовые поля через " | "
        for (const field of this.textFields) {
            const offlineValue = offlineData[field];
            const serverValue = serverData[field];
            if (offlineValue &&
                serverValue &&
                offlineValue !== serverValue) {
                merged[field] = `${serverValue} | ${offlineValue}`;
            }
            else if (offlineValue && !serverValue) {
                merged[field] = offlineValue;
            }
        }
        if (window.logSync) {
            window.logSync.info('Merged non-critical fields:', merged);
        }
        return merged;
    }
    /**
     * Показать модальное окно для ручного разрешения конфликта.
     *
     * @param offlineData - Локальная версия
     * @param serverData - Серверная версия
     * @param entity - Тип сущности
     * @returns Promise с выбранными данными
     */
    _showManualResolutionModal(offlineData, serverData, entity) {
        return new Promise((resolve) => {
            const modalId = 'conflictResolutionModal';
            // Удалить старое модальное окно если есть
            const existingModal = document.getElementById(modalId);
            if (existingModal) {
                existingModal.remove();
            }
            // Собрать список конфликтов
            const conflicts = this._gatherConflicts(offlineData, serverData);
            // Создать HTML модального окна
            const modalHtml = this._buildModalHtml(modalId, conflicts, entity);
            // Вставить в DOM
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            const modal = document.getElementById(modalId);
            if (!modal) {
                if (window.logSync) {
                    window.logSync.error('Modal not found after insertion');
                }
                resolve(serverData); // Fallback to server
                return;
            }
            // Показать модальное окно (DaisyUI)
            const checkbox = modal.querySelector('input[type="checkbox"]');
            if (checkbox) {
                checkbox.checked = true;
            }
            // Обработчик кнопки "Keep Server"
            const keepServerBtn = modal.querySelector('#keepServerBtn');
            if (keepServerBtn) {
                keepServerBtn.addEventListener('click', () => {
                    if (window.logSync) {
                        window.logSync.info('User chose: Keep Server');
                    }
                    if (checkbox)
                        checkbox.checked = false;
                    modal.remove();
                    resolve(serverData);
                });
            }
            // Обработчик кнопки "Keep Offline"
            const keepOfflineBtn = modal.querySelector('#keepOfflineBtn');
            if (keepOfflineBtn) {
                keepOfflineBtn.addEventListener('click', () => {
                    if (window.logSync) {
                        window.logSync.info('User chose: Keep Offline');
                    }
                    if (checkbox)
                        checkbox.checked = false;
                    modal.remove();
                    resolve(offlineData);
                });
            }
            // Обработчик кнопки "Merge Fields"
            const mergeBtn = modal.querySelector('#mergeFieldsBtn');
            if (mergeBtn) {
                mergeBtn.addEventListener('click', () => {
                    const merged = this._performManualMerge(modal, offlineData, serverData, conflicts);
                    if (window.logSync) {
                        window.logSync.info('User chose: Manual Merge', merged);
                    }
                    if (checkbox)
                        checkbox.checked = false;
                    modal.remove();
                    resolve(merged);
                });
            }
        });
    }
    /**
     * Собрать список конфликтующих полей.
     *
     * @param offlineData - Локальная версия
     * @param serverData - Серверная версия
     * @returns Массив конфликтов
     */
    _gatherConflicts(offlineData, serverData) {
        const conflicts = [];
        const allFields = new Set([
            ...Object.keys(offlineData),
            ...Object.keys(serverData)
        ]);
        for (const field of allFields) {
            // Пропустить служебные поля
            if (field === 'tempId' ||
                field === 'synced' ||
                field === 'id' ||
                field === 'created_at' ||
                field === 'updated_at') {
                continue;
            }
            const offlineValue = offlineData[field];
            const serverValue = serverData[field];
            if (offlineValue !== serverValue) {
                conflicts.push({
                    field,
                    offlineValue,
                    serverValue,
                    isDifferent: true
                });
            }
        }
        return conflicts;
    }
    /**
     * Построить HTML модального окна для ручного разрешения.
     *
     * @param modalId - ID модального окна
     * @param conflicts - Список конфликтов
     * @param entity - Тип сущности
     * @returns HTML строка
     */
    _buildModalHtml(modalId, conflicts, entity) {
        const entityLabels = {
            fact: 'Transaction',
            transfer: 'Transfer',
            plan: 'Plan'
        };
        const conflictRows = conflicts
            .map((conflict) => `
                <tr>
                    <td class="font-medium">${conflict.field}</td>
                    <td>
                        <label class="flex items-center gap-2">
                            <input type="radio" name="${conflict.field}" value="offline"
                                   class="radio radio-sm" />
                            <span>${this._formatValue(conflict.offlineValue)}</span>
                        </label>
                    </td>
                    <td>
                        <label class="flex items-center gap-2">
                            <input type="radio" name="${conflict.field}" value="server"
                                   class="radio radio-sm" checked />
                            <span>${this._formatValue(conflict.serverValue)}</span>
                        </label>
                    </td>
                </tr>
            `)
            .join('');
        return `
            <input type="checkbox" id="${modalId}" class="modal-toggle" />
            <div class="modal" role="dialog">
                <div class="modal-box max-w-4xl">
                    <h3 class="font-bold text-lg mb-4">
                        Conflict Detected: ${entityLabels[entity]}
                    </h3>

                    <p class="mb-4 text-sm opacity-70">
                        The same ${entity} was modified both offline and on the server.
                        Choose how to resolve:
                    </p>

                    <div class="overflow-x-auto mb-6">
                        <table class="table table-zebra">
                            <thead>
                                <tr>
                                    <th>Field</th>
                                    <th>Offline Version</th>
                                    <th>Server Version</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${conflictRows}
                            </tbody>
                        </table>
                    </div>

                    <div class="modal-action">
                        <button class="btn btn-sm btn-error" id="keepOfflineBtn">
                            Keep Offline
                        </button>
                        <button class="btn btn-sm btn-success" id="keepServerBtn">
                            Keep Server
                        </button>
                        <button class="btn btn-sm btn-primary" id="mergeFieldsBtn">
                            Merge Selected
                        </button>
                    </div>
                </div>
                <label class="modal-backdrop" for="${modalId}">Close</label>
            </div>
        `;
    }
    /**
     * Выполнить ручное объединение на основе выбранных radio buttons.
     *
     * @param modal - DOM элемент модального окна
     * @param offlineData - Локальная версия
     * @param serverData - Серверная версия
     * @param conflicts - Список конфликтов
     * @returns Объединенные данные
     */
    _performManualMerge(modal, offlineData, serverData, conflicts) {
        const merged = { ...serverData };
        for (const conflict of conflicts) {
            const radioInputs = modal.querySelectorAll(`input[name="${conflict.field}"]`);
            for (const radio of radioInputs) {
                if (radio.checked) {
                    if (radio.value === 'offline') {
                        merged[conflict.field] = offlineData[conflict.field];
                    }
                    else {
                        merged[conflict.field] = serverData[conflict.field];
                    }
                    break;
                }
            }
        }
        return merged;
    }
    /**
     * Форматировать значение для отображения в UI.
     *
     * @param value - Значение
     * @returns Строковое представление
     */
    _formatValue(value) {
        if (value === null || value === undefined) {
            return '<em>empty</em>';
        }
        if (typeof value === 'object') {
            return JSON.stringify(value);
        }
        return String(value);
    }
}
// Экспорт в window namespace
if (typeof window !== 'undefined') {
    window.ConflictResolver = ConflictResolver;
}
//# sourceMappingURL=conflictResolver.js.map