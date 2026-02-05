/**
 * Lightweight logger for Dexie module
 * Replaces direct console.log calls with configurable logging
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  enabled: boolean;
  level: LogLevel;
  prefix: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

class Logger {
  private config: LoggerConfig = {
    enabled: true,
    level: 'info',
    prefix: '[DEXIE]'
  };

  /**
   * Configure logger
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Check if logging is enabled for level
   */
  private shouldLog(level: LogLevel): boolean {
    return this.config.enabled && LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
  }

  /**
   * Format log message with prefix
   */
  private format(message: string, data?: unknown): string {
    const formatted = `${this.config.prefix} ${message}`;
    return data !== undefined ? `${formatted} ${JSON.stringify(data)}` : formatted;
  }

  /**
   * Debug level logging
   */
  debug(message: string, data?: unknown): void {
    if (this.shouldLog('debug')) {
      // eslint-disable-next-line no-console
      console.log(this.format(message, data));
    }
  }

  /**
   * Info level logging
   */
  info(message: string, data?: unknown): void {
    if (this.shouldLog('info')) {
      // eslint-disable-next-line no-console
      console.log(this.format(message, data));
    }
  }

  /**
   * Warning level logging
   */
  warn(message: string, data?: unknown): void {
    if (this.shouldLog('warn')) {
      // eslint-disable-next-line no-console
      console.warn(this.format(message, data));
    }
  }

  /**
   * Error level logging
   */
  error(message: string, error?: unknown): void {
    if (this.shouldLog('error')) {
      // eslint-disable-next-line no-console
      console.error(this.format(message), error);
    }
  }
}

// Singleton instance
export const logger = new Logger();

/**
 * Configure logger based on feature flags
 */
export function configureLogger(debug: boolean): void {
  logger.configure({
    enabled: true,
    level: debug ? 'debug' : 'info'
  });
}
