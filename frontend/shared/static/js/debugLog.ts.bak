/**
 * Conditional Logging Utility for Family Budget v5.0
 *
 * НАЗНАЧЕНИЕ:
 * Автоматически определяет окружение (production/development) из meta tag
 * и включает/выключает debug логи соответственно.
 *
 * ИСПОЛЬЗОВАНИЕ:
 *   debugLog('User clicked button');              // Простое сообщение
 *   debugLog('API Response:', response);          // С данными
 *   debugLog.warn('Deprecated function called');  // Предупреждение
 *   debugLog.error('Failed to load', error);      // Ошибка (всегда)
 *
 * ОКРУЖЕНИЕ:
 * - Production: все логи отключены (кроме error)
 * - Development: все логи включены
 *
 * КОНФИГУРАЦИЯ:
 * Добавь в <head> твоего HTML:
 *   <meta name="app-env" content="production|development">
 *
 * АВТОР: Claude Code + ikeniborn
 * ДАТА: 2025-11-15
 */

(function(window) {
    'use strict';

    const DEBUG_CONFIG = {
        enabled: false,
        prefix: '[DEBUG]',
        env: 'unknown'
    };

    /**
     * Инициализация: определяем окружение из meta tag
     */
    function initDebugMode() {
        const metaEnv = document.querySelector('meta[name="app-env"]');
        const metaDebug = document.querySelector('meta[name="app-debug"]');

        if (metaDebug) {
            // Приоритет: явный флаг debug
            DEBUG_CONFIG.enabled = metaDebug.content === 'true';
            DEBUG_CONFIG.env = metaEnv?.content || 'unknown';
        } else if (metaEnv) {
            // Fallback: определяем по app-env
            DEBUG_CONFIG.env = metaEnv.content;
            DEBUG_CONFIG.enabled = metaEnv.content !== 'production';
        } else {
            // Default: production mode (безопасно)
            DEBUG_CONFIG.enabled = false;
            DEBUG_CONFIG.env = 'production';
        }

        // Информируем о режиме (только если debug включен)
        if (DEBUG_CONFIG.enabled) {
            console.log(
                `%c${DEBUG_CONFIG.prefix} Debug mode ENABLED %c(env: ${DEBUG_CONFIG.env})`,
                'background: #4CAF50; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;',
                'color: #666; font-style: italic;'
            );
        }
    }

    /**
     * Главная функция логирования
     * @param {...*} args - Аргументы для console.log
     */
    function debugLog(...args) {
        if (DEBUG_CONFIG.enabled) {
            console.log(DEBUG_CONFIG.prefix, ...args);
        }
    }

    /**
     * Предупреждение (только в dev)
     * @param {...*} args - Аргументы для console.warn
     */
    debugLog.warn = function(...args) {
        if (DEBUG_CONFIG.enabled) {
            console.warn(DEBUG_CONFIG.prefix, ...args);
        }
    };

    /**
     * Ошибка (ВСЕГДА логируется, даже в production)
     * @param {...*} args - Аргументы для console.error
     */
    debugLog.error = function(...args) {
        console.error(DEBUG_CONFIG.prefix, ...args);
    };

    /**
     * Информационное сообщение (только в dev)
     * @param {...*} args - Аргументы для console.info
     */
    debugLog.info = function(...args) {
        if (DEBUG_CONFIG.enabled) {
            console.info(DEBUG_CONFIG.prefix, ...args);
        }
    };

    /**
     * Таблица (только в dev)
     * @param {...*} args - Аргументы для console.table
     */
    debugLog.table = function(...args) {
        if (DEBUG_CONFIG.enabled) {
            console.table(...args);
        }
    };

    /**
     * Группа (только в dev)
     * @param {string} label - Название группы
     */
    debugLog.group = function(label) {
        if (DEBUG_CONFIG.enabled) {
            console.group(DEBUG_CONFIG.prefix, label);
        }
    };

    /**
     * Закрыть группу (только в dev)
     */
    debugLog.groupEnd = function() {
        if (DEBUG_CONFIG.enabled) {
            console.groupEnd();
        }
    };

    /**
     * Проверка: включен ли debug mode
     * @returns {boolean}
     */
    debugLog.isEnabled = function() {
        return DEBUG_CONFIG.enabled;
    };

    /**
     * Получить текущее окружение
     * @returns {string} - 'production', 'development', или 'unknown'
     */
    debugLog.getEnv = function() {
        return DEBUG_CONFIG.env;
    };

    // Инициализация при загрузке DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDebugMode);
    } else {
        // DOM уже загружен
        initDebugMode();
    }

    // Экспорт в глобальную область видимости
    window.debugLog = debugLog;

})(window);
