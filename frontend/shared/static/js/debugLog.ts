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
 * @version 2.0.0
 */

interface DebugLogFunction {
  (...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
  info(...args: any[]): void;
  table(...args: any[]): void;
  group(label: string): void;
  groupEnd(): void;
  isEnabled(): boolean;
  getEnv(): string;
}

(function(window: Window): void {
    'use strict';

    interface DebugConfig {
        enabled: boolean;
        prefix: string;
        env: string;
    }

    const DEBUG_CONFIG: DebugConfig = {
        enabled: false,
        prefix: '[DEBUG]',
        env: 'unknown'
    };

    /**
     * Инициализация: определяем окружение из meta tag
     */
    function initDebugMode(): void {
        const metaEnv = document.querySelector<HTMLMetaElement>('meta[name="app-env"]');
        const metaDebug = document.querySelector<HTMLMetaElement>('meta[name="app-debug"]');

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
     * @param args - Аргументы для console.log
     */
    function debugLog(...args: any[]): void {
        if (DEBUG_CONFIG.enabled) {
            console.log(DEBUG_CONFIG.prefix, ...args);
        }
    }

    /**
     * Предупреждение (только в dev)
     * @param args - Аргументы для console.warn
     */
    (debugLog as DebugLogFunction).warn = function(...args: any[]): void {
        if (DEBUG_CONFIG.enabled) {
            console.warn(DEBUG_CONFIG.prefix, ...args);
        }
    };

    /**
     * Ошибка (ВСЕГДА логируется, даже в production)
     * @param args - Аргументы для console.error
     */
    (debugLog as DebugLogFunction).error = function(...args: any[]): void {
        console.error(DEBUG_CONFIG.prefix, ...args);
    };

    /**
     * Информационное сообщение (только в dev)
     * @param args - Аргументы для console.info
     */
    (debugLog as DebugLogFunction).info = function(...args: any[]): void {
        if (DEBUG_CONFIG.enabled) {
            console.info(DEBUG_CONFIG.prefix, ...args);
        }
    };

    /**
     * Таблица (только в dev)
     * @param args - Аргументы для console.table
     */
    (debugLog as DebugLogFunction).table = function(...args: any[]): void {
        if (DEBUG_CONFIG.enabled) {
            console.table(...args);
        }
    };

    /**
     * Группа (только в dev)
     * @param label - Название группы
     */
    (debugLog as DebugLogFunction).group = function(label: string): void {
        if (DEBUG_CONFIG.enabled) {
            console.group(DEBUG_CONFIG.prefix, label);
        }
    };

    /**
     * Закрыть группу (только в dev)
     */
    (debugLog as DebugLogFunction).groupEnd = function(): void {
        if (DEBUG_CONFIG.enabled) {
            console.groupEnd();
        }
    };

    /**
     * Проверка: включен ли debug mode
     */
    (debugLog as DebugLogFunction).isEnabled = function(): boolean {
        return DEBUG_CONFIG.enabled;
    };

    /**
     * Получить текущее окружение
     * @returns 'production', 'development', или 'unknown'
     */
    (debugLog as DebugLogFunction).getEnv = function(): string {
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
    window.debugLog = debugLog as DebugLogFunction;

})(window);
