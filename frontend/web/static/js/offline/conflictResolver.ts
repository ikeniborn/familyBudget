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

type EntityType = 'fact' | 'transfer' | 'plan';

interface ConflictData {
    offlineData: any;
    serverData: any;
    entity: EntityType;
}

interface FieldConflict {
    field: string;
    offlineValue: any;
    serverValue: any;
    isDifferent: boolean;
}

class ConflictResolver {
    private criticalFields: ReadonlyArray<string>;
    private textFields: ReadonlyArray<string>;

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
    async resolve(
        offlineData: any,
        serverData: any,
        entity: EntityType,
        autoResolve: boolean = false
    ): Promise<any> {
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
    private _applyLastWriteWins(offlineData: any, serverData: any): any {
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
    private _hasCriticalConflict(offlineData: any, serverData: any): boolean {
        for (const field of this.criticalFields) {
            if (
                offlineData[field] !== undefined &&
                serverData[field] !== undefined &&
                offlineData[field] !== serverData[field]
            ) {
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
    private _mergeNonCriticalFields(offlineData: any, serverData: any): any {
        const merged = { ...serverData };

        // Объединяем текстовые поля через " | "
        for (const field of this.textFields) {
            const offlineValue = offlineData[field];
            const serverValue = serverData[field];

            if (
                offlineValue &&
                serverValue &&
                offlineValue !== serverValue
            ) {
                merged[field] = `${serverValue} | ${offlineValue}`;
            } else if (offlineValue && !serverValue) {
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
    private _showManualResolutionModal(
        offlineData: any,
        serverData: any,
        entity: EntityType
    ): Promise<any> {
        return new Promise((resolve) => {
            const modalId = 'conflictResolutionModal';
            const TIMEOUT_MS = 60000; // 60 seconds
            let timeoutHandle: number | null = null;
            let resolved = false; // Flag to prevent double resolution

            // Удалить старое модальное окно если есть
            const existingModal = document.getElementById(modalId);
            if (existingModal) {
                existingModal.remove();
            }

            // Собрать список конфликтов
            const conflicts = this._gatherConflicts(offlineData, serverData);

            // Создать HTML модального окна
            const modalHtml = this._buildModalHtml(
                modalId,
                conflicts,
                entity
            );

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
            const checkbox = modal.querySelector(
                'input[type="checkbox"]'
            ) as HTMLInputElement;
            if (checkbox) {
                checkbox.checked = true;
            }

            // Cleanup function to clear timeout and remove modal
            const cleanup = () => {
                if (timeoutHandle !== null) {
                    clearTimeout(timeoutHandle);
                    timeoutHandle = null;
                }
                if (checkbox) checkbox.checked = false;
                modal.remove();
            };

            // Auto-resolve after timeout (fallback to server wins)
            timeoutHandle = window.setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    if (window.logSync) {
                        window.logSync.warn('Conflict modal timeout - auto-choosing server version');
                    }
                    cleanup();
                    resolve(serverData);
                }
            }, TIMEOUT_MS);

            // Обработчик кнопки "Keep Server"
            const keepServerBtn = modal.querySelector(
                '#keepServerBtn'
            ) as HTMLButtonElement;
            if (keepServerBtn) {
                keepServerBtn.addEventListener('click', () => {
                    if (!resolved) {
                        resolved = true;
                        if (window.logSync) {
                            window.logSync.info('User chose: Keep Server');
                        }
                        cleanup();
                        resolve(serverData);
                    }
                });
            }

            // Обработчик кнопки "Keep Offline"
            const keepOfflineBtn = modal.querySelector(
                '#keepOfflineBtn'
            ) as HTMLButtonElement;
            if (keepOfflineBtn) {
                keepOfflineBtn.addEventListener('click', () => {
                    if (!resolved) {
                        resolved = true;
                        if (window.logSync) {
                            window.logSync.info('User chose: Keep Offline');
                        }
                        cleanup();
                        resolve(offlineData);
                    }
                });
            }

            // Обработчик кнопки "Merge Fields"
            const mergeBtn = modal.querySelector(
                '#mergeFieldsBtn'
            ) as HTMLButtonElement;
            if (mergeBtn) {
                mergeBtn.addEventListener('click', () => {
                    if (!resolved) {
                        resolved = true;
                        const merged = this._performManualMerge(
                            modal,
                            offlineData,
                            serverData,
                            conflicts
                        );
                        if (window.logSync) {
                            window.logSync.info('User chose: Manual Merge', merged);
                        }
                        cleanup();
                        resolve(merged);
                    }
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
    private _gatherConflicts(offlineData: any, serverData: any): FieldConflict[] {
        const conflicts: FieldConflict[] = [];

        const allFields = new Set([
            ...Object.keys(offlineData),
            ...Object.keys(serverData)
        ]);

        for (const field of allFields) {
            // Пропустить служебные поля
            if (
                field === 'tempId' ||
                field === 'synced' ||
                field === 'id' ||
                field === 'created_at' ||
                field === 'updated_at'
            ) {
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
    private _buildModalHtml(
        modalId: string,
        conflicts: FieldConflict[],
        entity: EntityType
    ): string {
        const entityLabels: Record<EntityType, string> = {
            fact: 'Transaction',
            transfer: 'Transfer',
            plan: 'Plan'
        };

        const conflictRows = conflicts
            .map(
                (conflict) => `
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
            `
            )
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
    private _performManualMerge(
        modal: HTMLElement,
        offlineData: any,
        serverData: any,
        conflicts: FieldConflict[]
    ): any {
        const merged = { ...serverData };

        for (const conflict of conflicts) {
            const radioInputs = modal.querySelectorAll<HTMLInputElement>(
                `input[name="${conflict.field}"]`
            );

            for (const radio of radioInputs) {
                if (radio.checked) {
                    if (radio.value === 'offline') {
                        merged[conflict.field] = offlineData[conflict.field];
                    } else {
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
    private _formatValue(value: any): string {
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
