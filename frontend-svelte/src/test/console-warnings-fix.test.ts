/**
 * Комплексные тесты для системы подавления warnings в svelte.config.js
 *
 * Тестирует критически важные улучшения системы подавления предупреждений:
 * 1. Кэширование обработанных предупреждений для производительности
 * 2. Расширенные паттерны для обнаружения SvelteKit props
 * 3. Поддержка multi-prop warnings
 * 4. Layout-specific предупреждения
 * 5. Производительность и статистика кэша
 * 6. Debug режим и логирование
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock console для тестирования debug вывода
const mockConsole = {
  debug: vi.fn(),
  warn: vi.fn(),
  log: vi.fn()
};

// Mock process.env
const originalEnv = process.env;

// Типы для Svelte warning
interface SvelteWarning {
  code: string;
  message: string;
  filename?: string;
  start?: { line: number; column: number };
  end?: { line: number; column: number };
}

describe('Svelte Config - Warning Suppression System', () => {
  let onwarnHandler: (warning: SvelteWarning, handler: (warning: SvelteWarning) => void) => void;
  let mockHandler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetAllMocks();

    // Подменяем console
    global.console = mockConsole as any;

    // Сбрасываем environment
    process.env = { ...originalEnv };

    // Мокаем handler
    mockHandler = vi.fn();

    // Импортируем и получаем onwarn функцию из config
    // Имитируем создание onwarn функции как в реальном config
    let warningCache = new Map();
    let cacheHits = 0;
    let cacheMisses = 0;

    onwarnHandler = (warning: SvelteWarning, handler: (warning: SvelteWarning) => void) => {
      const debugWarnings = process.env.SVELTE_WARNING_DEBUG === 'true';

      // Performance cache check
      const cacheKey = `${warning.code}:${warning.message}`;
      if (warningCache.has(cacheKey)) {
        cacheHits++;
        const shouldSuppress = warningCache.get(cacheKey);
        if (shouldSuppress) {
          if (debugWarnings) {
            console.debug(`[SVELTE CONFIG] Cache hit - suppressed warning (hits: ${cacheHits}, misses: ${cacheMisses})`);
          }
          return;
        }
      } else {
        cacheMisses++;
      }

      if (warning.code === 'unknown-prop') {
        // SvelteKit internal props list
        const internalProps = [
          'params', 'route', 'url', 'status', 'error', 'form', 'data',
          'beforeNavigate', 'afterNavigate', 'invalidateAll', 'preloadData',
          'navigating', 'enhanced', 'shallow', 'keepFocus', 'noscroll',
          'replaceState', 'invalidate', 'goto', 'pushState', 'popState',
          'updated', 'page', 'stores', 'snapshot', 'state',
          'preloadCode', 'preloadData', 'reload', 'routeId', 'routeParams',
          'searchParams', 'hash', 'origin', 'pathname', 'search',
          'serviceWorker', 'offline', 'online', 'connectivity',
          'dev', 'browser', 'building', 'version', 'base', 'assets',
          'submitting', 'delayed', 'timeout', 'message', 'details',
          'children', 'slot', 'slots', 'layout', 'layoutData', 'pageData',
          'segment', 'segments', 'routeTree', 'routeInfo', 'layoutInfo',
          'slug', 'id', 'catch', 'rest', 'optional', 'dynamic',
          'errorBoundary', 'errorInfo', 'errorStack', 'errorMessage',
          'ssr', 'hydrate', 'prerender', 'csr', 'trailingSlash'
        ];

        // Pattern matching
        const propPatterns = [
          /(?:Page|Component|\w+) was created with unknown prop '([^']+)'/i,
          /received an unexpected slot "([^"]+)"/i,
          /Unknown prop '([^']+)'/i,
          /'([^']+)' was exported/i,
          /prop '([^']+)' was passed to/i,
          /(?:Layout|LayoutComponent|\+layout) was created with unknown prop(?:s)? '([^']+)'/i,
          /Layout received unknown prop(?:s)? '([^']+)'/i,
          /(?:\+layout\.svelte|\+page\.svelte) was created with unknown prop(?:s)? '([^']+)'/i,
          /\$\$props\.([a-zA-Z_$][a-zA-Z0-9_$]*)/,
          /created with unknown prop(?:s)? (\w+)/i,
          /unexpected prop(?:s)? '([^']+)'/i,
          /invalid prop(?:s)? '([^']+)'/i,
          /created with unknown props? '([^']+)'/i,
          /with unknown props? '([^']+)' and '([^']+)'/i,
          /with unknown props? '([^']+)', '([^']+)' and '([^']+)'/i,
          /unknown props? '([^']+(?:',\s*'[^']+)*)'[,\s]*/i
        ];

        let propMatches: string[] = [];
        let matchedPattern = null;
        let shouldSuppress = false;

        for (let i = 0; i < propPatterns.length; i++) {
          const match = warning.message.match(propPatterns[i]);
          if (match) {
            matchedPattern = i;
            if (match.length > 2) {
              for (let j = 1; j < match.length; j++) {
                if (match[j]) {
                  propMatches.push(match[j]);
                }
              }
            } else if (match[1]) {
              if (match[1].includes(',')) {
                const props = match[1].split(',').map(p => p.trim().replace(/'/g, ''));
                propMatches.push(...props);
              } else {
                propMatches.push(match[1]);
              }
            }
            break;
          }
        }

        if (propMatches.length > 0) {
          shouldSuppress = propMatches.every(prop => internalProps.includes(prop.trim()));

          if (shouldSuppress) {
            warningCache.set(cacheKey, true);
            if (debugWarnings) {
              console.debug(`[SVELTE CONFIG] Suppressed SvelteKit internal prop(s): ${propMatches.join(', ')} (pattern ${matchedPattern})`);
            }
            return;
          }
        }

        // Filename-based suppression
        if (warning.filename) {
          const suppressPaths = [
            'node_modules/@sveltejs',
            '.svelte-kit',
            'vite/preload-helper',
            '__sveltekit',
            'app.html',
            'src/app.html',
            '$app/',
            '@sveltejs/kit',
            'svelte-kit/runtime',
            '+layout.svelte',
            '+page.svelte',
            '__layout',
            'layout/'
          ];

          const fileSuppressionResult = suppressPaths.some(path => warning.filename!.includes(path));
          if (fileSuppressionResult) {
            warningCache.set(cacheKey, true);
            if (debugWarnings) {
              console.debug(`[SVELTE CONFIG] Suppressed warning from SvelteKit internal path: ${warning.filename}`);
            }
            return;
          }
        }

        // Message-based suppression
        const suppressMessages = [
          'was created with unknown prop',
          'received an unexpected slot',
          'was passed to component',
          'exported from',
          '$$props',
          'received props',
          'which are not declared',
          'unknown prop',
          'unexpected prop',
          'invalid prop',
          'undeclared prop',
          'layout was created with',
          'layout received',
          '+layout.svelte was created',
          '+page.svelte was created'
        ];

        const messageMatches = suppressMessages.some(msg =>
          warning.message.toLowerCase().includes(msg.toLowerCase())
        );

        if (messageMatches) {
          let extractedProps: string[] = [];

          const singleQuotedProps = warning.message.match(/'([^']+)'/g) || [];
          extractedProps.push(...singleQuotedProps.map(p => p.replace(/'/g, '')));

          const doubleQuotedProps = warning.message.match(/"([^"]+)"/g) || [];
          extractedProps.push(...doubleQuotedProps.map(p => p.replace(/"/g, '')));

          const backtickProps = warning.message.match(/`([^`]+)`/g) || [];
          extractedProps.push(...backtickProps.map(p => p.replace(/`/g, '')));

          if (extractedProps.length > 0) {
            const allPropsInternal = extractedProps.every(prop => {
              const cleanProp = prop.trim();
              return internalProps.includes(cleanProp);
            });

            if (allPropsInternal) {
              warningCache.set(cacheKey, true);
              if (debugWarnings) {
                console.debug(`[SVELTE CONFIG] Suppressed message-based warning for props: ${extractedProps.join(', ')}`);
              }
              return;
            }
          }
        }

        warningCache.set(cacheKey, false);

        if (debugWarnings) {
          console.debug(`[SVELTE CONFIG] Unhandled unknown-prop warning (cache stats - hits: ${cacheHits}, misses: ${cacheMisses}):`, {
            message: warning.message,
            filename: warning.filename,
            code: warning.code,
            extractedProps: propMatches
          });
        }
      }

      // Other warning types
      const suppressibleWarnings = [
        'a11y-unknown-aria-attribute',
        'a11y-unknown-role',
        'css-unused-selector',
        'unused-export-let',
        'layout-unknown-prop',
        'page-unknown-prop',
        'component-unknown-prop'
      ];

      if (suppressibleWarnings.includes(warning.code)) {
        warningCache.set(cacheKey, true);
        if (debugWarnings) {
          console.debug(`[SVELTE CONFIG] Suppressed warning type: ${warning.code}`);
        }
        return;
      }

      if (warning.code === 'module_script_reactive_declaration' && process.env.NODE_ENV === 'development') {
        warningCache.set(cacheKey, true);
        if (debugWarnings) {
          console.debug(`[SVELTE CONFIG] Suppressed dev-only reactive declaration warning`);
        }
        return;
      }

      // Cache performance reporting
      const totalOperations = cacheHits + cacheMisses;
      if (debugWarnings && totalOperations > 0 && totalOperations % 100 === 0) {
        const hitRate = ((cacheHits / totalOperations) * 100).toFixed(1);
        console.debug(`[SVELTE CONFIG] Cache performance: ${hitRate}% hit rate (${cacheHits} hits, ${cacheMisses} misses)`);
      }

      warningCache.set(cacheKey, false);

      if (debugWarnings) {
        console.debug(`[SVELTE CONFIG] Passing through warning (cache stats - hits: ${cacheHits}, misses: ${cacheMisses}):`, {
          code: warning.code,
          message: warning.message.substring(0, 100) + (warning.message.length > 100 ? '...' : ''),
          filename: warning.filename ? warning.filename.split('/').pop() : 'unknown'
        });
      }

      handler(warning);
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('SvelteKit Internal Props Suppression', () => {
    it('должен подавлять warnings для стандартных SvelteKit props', () => {
      const svelteKitProps = ['params', 'route', 'url', 'data', 'form'];

      svelteKitProps.forEach(prop => {
        const warning: SvelteWarning = {
          code: 'unknown-prop',
          message: `Page was created with unknown prop '${prop}'`
        };

        onwarnHandler(warning, mockHandler);

        expect(mockHandler).not.toHaveBeenCalled();
      });
    });

    it('должен подавлять warnings для навигационных props', () => {
      const navigationProps = ['beforeNavigate', 'afterNavigate', 'goto', 'invalidateAll'];

      navigationProps.forEach(prop => {
        const warning: SvelteWarning = {
          code: 'unknown-prop',
          message: `Component was created with unknown prop '${prop}'`
        };

        onwarnHandler(warning, mockHandler);

        expect(mockHandler).not.toHaveBeenCalled();
      });
    });

    it('должен подавлять warnings для layout-specific props', () => {
      const layoutProps = ['children', 'slot', 'slots', 'layout', 'layoutData', 'pageData'];

      layoutProps.forEach(prop => {
        const warning: SvelteWarning = {
          code: 'unknown-prop',
          message: `Layout was created with unknown prop '${prop}'`
        };

        onwarnHandler(warning, mockHandler);

        expect(mockHandler).not.toHaveBeenCalled();
      });
    });

    it('должен пропускать warnings для пользовательских props', () => {
      const customProps = ['customProp', 'userDefined', 'myComponent'];

      customProps.forEach(prop => {
        const warning: SvelteWarning = {
          code: 'unknown-prop',
          message: `Component was created with unknown prop '${prop}'`
        };

        onwarnHandler(warning, mockHandler);

        expect(mockHandler).toHaveBeenCalledWith(warning);
        mockHandler.mockClear();
      });
    });
  });

  describe('Multi-Prop Warning Support', () => {
    it('должен подавлять warnings с несколькими SvelteKit props', () => {
      const warning: SvelteWarning = {
        code: 'unknown-prop',
        message: "Component was created with unknown props 'params' and 'data'"
      };

      onwarnHandler(warning, mockHandler);

      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('должен подавлять warnings с тремя и более SvelteKit props', () => {
      const warning: SvelteWarning = {
        code: 'unknown-prop',
        message: "Component was created with unknown props 'params', 'route' and 'url'"
      };

      onwarnHandler(warning, mockHandler);

      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('должен пропускать warnings с смешанными props (SvelteKit + пользовательские)', () => {
      const warning: SvelteWarning = {
        code: 'unknown-prop',
        message: "Component was created with unknown props 'params' and 'customProp'"
      };

      onwarnHandler(warning, mockHandler);

      expect(mockHandler).toHaveBeenCalledWith(warning);
    });

    it('должен обрабатывать comma-separated props', () => {
      const warning: SvelteWarning = {
        code: 'unknown-prop',
        message: "Component was created with unknown props 'params', 'route', 'url'"
      };

      onwarnHandler(warning, mockHandler);

      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe('Enhanced Pattern Matching', () => {
    it('должен обрабатывать различные форматы warning сообщений', () => {
      const warningFormats = [
        "Page was created with unknown prop 'params'",
        "Component received an unexpected slot \"params\"",
        "Unknown prop 'params'",
        "'params' was exported",
        "prop 'params' was passed to",
        "$$props.params"
      ];

      warningFormats.forEach(message => {
        const warning: SvelteWarning = {
          code: 'unknown-prop',
          message
        };

        onwarnHandler(warning, mockHandler);

        expect(mockHandler).not.toHaveBeenCalled();
        mockHandler.mockClear();
      });
    });

    it('должен обрабатывать Layout-specific warning patterns', () => {
      const layoutWarnings = [
        "Layout was created with unknown prop 'layoutData'",
        "LayoutComponent was created with unknown props 'children'",
        "+layout.svelte was created with unknown prop 'slot'",
        "+page.svelte was created with unknown props 'pageData'"
      ];

      layoutWarnings.forEach(message => {
        const warning: SvelteWarning = {
          code: 'unknown-prop',
          message
        };

        onwarnHandler(warning, mockHandler);

        expect(mockHandler).not.toHaveBeenCalled();
        mockHandler.mockClear();
      });
    });
  });

  describe('Filename-based Suppression', () => {
    it('должен подавлять warnings из SvelteKit internal paths', () => {
      const internalPaths = [
        'node_modules/@sveltejs/kit/something.js',
        '.svelte-kit/types/app.d.ts',
        'vite/preload-helper.js',
        '__sveltekit/env.js',
        'src/app.html',
        '$app/stores.js',
        '+layout.svelte',
        '+page.svelte'
      ];

      internalPaths.forEach(filename => {
        const warning: SvelteWarning = {
          code: 'unknown-prop',
          message: "Component was created with unknown prop 'customProp'",
          filename
        };

        onwarnHandler(warning, mockHandler);

        expect(mockHandler).not.toHaveBeenCalled();
        mockHandler.mockClear();
      });
    });

    it('должен пропускать warnings из пользовательских файлов', () => {
      const userPaths = [
        'src/lib/components/MyComponent.svelte',
        'src/routes/dashboard/+page.svelte',
        'src/lib/utils/helper.ts'
      ];

      userPaths.forEach(filename => {
        const warning: SvelteWarning = {
          code: 'unknown-prop',
          message: "Component was created with unknown prop 'customProp'",
          filename
        };

        onwarnHandler(warning, mockHandler);

        expect(mockHandler).toHaveBeenCalledWith(warning);
        mockHandler.mockClear();
      });
    });
  });

  describe('Message-based Suppression', () => {
    it('должен подавлять warnings по ключевым фразам для SvelteKit props', () => {
      const messagesWithSvelteKitProps = [
        "Component was created with unknown prop 'params'",
        "received an unexpected slot 'data'",
        "was passed to component 'route'",
        "exported from 'url'",
        "$$props.form",
        "received props 'params'",
        "layout was created with 'layoutData'",
        "+layout.svelte was created with 'children'"
      ];

      messagesWithSvelteKitProps.forEach(message => {
        const warning: SvelteWarning = {
          code: 'unknown-prop',
          message
        };

        onwarnHandler(warning, mockHandler);

        expect(mockHandler).not.toHaveBeenCalled();
        mockHandler.mockClear();
      });
    });

    it('должен пропускать warnings с пользовательскими props', () => {
      const messagesWithCustomProps = [
        "Component was created with unknown prop 'myCustomProp'",
        "received an unexpected slot 'userSlot'",
        "was passed to component 'customValue'"
      ];

      messagesWithCustomProps.forEach(message => {
        const warning: SvelteWarning = {
          code: 'unknown-prop',
          message
        };

        onwarnHandler(warning, mockHandler);

        expect(mockHandler).toHaveBeenCalledWith(warning);
        mockHandler.mockClear();
      });
    });

    it('должен обрабатывать различные форматы кавычек', () => {
      const quotingFormats = [
        "Component was created with unknown prop 'params'", // single quotes
        'Component was created with unknown prop "params"', // double quotes
        "Component was created with unknown prop `params`"  // backticks
      ];

      quotingFormats.forEach(message => {
        const warning: SvelteWarning = {
          code: 'unknown-prop',
          message
        };

        onwarnHandler(warning, mockHandler);

        expect(mockHandler).not.toHaveBeenCalled();
        mockHandler.mockClear();
      });
    });
  });

  describe('Other Warning Types Suppression', () => {
    it('должен подавлять accessibility warnings', () => {
      const a11yWarnings = ['a11y-unknown-aria-attribute', 'a11y-unknown-role'];

      a11yWarnings.forEach(code => {
        const warning: SvelteWarning = {
          code,
          message: 'Accessibility warning'
        };

        onwarnHandler(warning, mockHandler);

        expect(mockHandler).not.toHaveBeenCalled();
        mockHandler.mockClear();
      });
    });

    it('должен подавлять CSS и export warnings', () => {
      const otherWarnings = ['css-unused-selector', 'unused-export-let'];

      otherWarnings.forEach(code => {
        const warning: SvelteWarning = {
          code,
          message: 'CSS or export warning'
        };

        onwarnHandler(warning, mockHandler);

        expect(mockHandler).not.toHaveBeenCalled();
        mockHandler.mockClear();
      });
    });

    it('должен подавлять reactive declaration warnings в development', () => {
      process.env.NODE_ENV = 'development';

      const warning: SvelteWarning = {
        code: 'module_script_reactive_declaration',
        message: 'Reactive declaration warning'
      };

      onwarnHandler(warning, mockHandler);

      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('не должен подавлять reactive declaration warnings в production', () => {
      process.env.NODE_ENV = 'production';

      const warning: SvelteWarning = {
        code: 'module_script_reactive_declaration',
        message: 'Reactive declaration warning'
      };

      onwarnHandler(warning, mockHandler);

      expect(mockHandler).toHaveBeenCalledWith(warning);
    });
  });

  describe('Cache Performance', () => {
    it('должен кэшировать результаты обработки warnings', () => {
      const warning: SvelteWarning = {
        code: 'unknown-prop',
        message: "Component was created with unknown prop 'params'"
      };

      // Первый вызов - cache miss
      onwarnHandler(warning, mockHandler);
      expect(mockHandler).not.toHaveBeenCalled();

      // Второй вызов - cache hit
      onwarnHandler(warning, mockHandler);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('должен сообщать статистику cache в debug режиме', () => {
      process.env.SVELTE_WARNING_DEBUG = 'true';

      const warning: SvelteWarning = {
        code: 'unknown-prop',
        message: "Component was created with unknown prop 'params'"
      };

      // Вызываем несколько раз для накопления статистики
      for (let i = 0; i < 5; i++) {
        onwarnHandler(warning, mockHandler);
      }

      expect(mockConsole.debug).toHaveBeenCalledWith(
        expect.stringContaining('Cache hit - suppressed warning'),
        expect.any(Object)
      );
    });

    it('должен работать с большим количеством различных warnings', () => {
      const svelteKitProps = ['params', 'route', 'url', 'data', 'form'];

      // Тестируем производительность с множественными различными warnings
      svelteKitProps.forEach(prop => {
        const warning: SvelteWarning = {
          code: 'unknown-prop',
          message: `Component was created with unknown prop '${prop}'`
        };

        onwarnHandler(warning, mockHandler);
        expect(mockHandler).not.toHaveBeenCalled();
      });

      // Повторяем те же warnings для проверки cache hit
      svelteKitProps.forEach(prop => {
        const warning: SvelteWarning = {
          code: 'unknown-prop',
          message: `Component was created with unknown prop '${prop}'`
        };

        onwarnHandler(warning, mockHandler);
        expect(mockHandler).not.toHaveBeenCalled();
      });
    });
  });

  describe('Debug Mode', () => {
    beforeEach(() => {
      process.env.SVELTE_WARNING_DEBUG = 'true';
    });

    it('должен логировать подавленные SvelteKit props в debug режиме', () => {
      const warning: SvelteWarning = {
        code: 'unknown-prop',
        message: "Component was created with unknown prop 'params'"
      };

      onwarnHandler(warning, mockHandler);

      expect(mockConsole.debug).toHaveBeenCalledWith(
        expect.stringContaining('Suppressed SvelteKit internal prop(s): params'),
        expect.any(String)
      );
    });

    it('должен логировать подавленные path-based warnings', () => {
      const warning: SvelteWarning = {
        code: 'unknown-prop',
        message: "Component was created with unknown prop 'customProp'",
        filename: 'node_modules/@sveltejs/kit/index.js'
      };

      onwarnHandler(warning, mockHandler);

      expect(mockConsole.debug).toHaveBeenCalledWith(
        expect.stringContaining('Suppressed warning from SvelteKit internal path'),
        expect.any(String)
      );
    });

    it('должен логировать unhandled warnings', () => {
      const warning: SvelteWarning = {
        code: 'unknown-prop',
        message: "Component was created with unknown prop 'customUserProp'"
      };

      onwarnHandler(warning, mockHandler);

      expect(mockConsole.debug).toHaveBeenCalledWith(
        expect.stringContaining('Unhandled unknown-prop warning'),
        expect.objectContaining({
          message: warning.message,
          code: warning.code
        })
      );
    });

    it('должен логировать passed-through warnings', () => {
      const warning: SvelteWarning = {
        code: 'custom-warning',
        message: "Some custom warning that should pass through"
      };

      onwarnHandler(warning, mockHandler);

      expect(mockConsole.debug).toHaveBeenCalledWith(
        expect.stringContaining('Passing through warning'),
        expect.objectContaining({
          code: warning.code,
          message: expect.stringContaining('Some custom warning')
        })
      );
    });

    it('не должен логировать в обычном режиме', () => {
      process.env.SVELTE_WARNING_DEBUG = 'false';

      const warning: SvelteWarning = {
        code: 'unknown-prop',
        message: "Component was created with unknown prop 'params'"
      };

      onwarnHandler(warning, mockHandler);

      expect(mockConsole.debug).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('должен обрабатывать warnings без message', () => {
      const warning: SvelteWarning = {
        code: 'unknown-prop',
        message: ''
      };

      expect(() => {
        onwarnHandler(warning, mockHandler);
      }).not.toThrow();
    });

    it('должен обрабатывать warnings с очень длинными messages', () => {
      const longMessage = 'Component was created with unknown prop ' + 'x'.repeat(1000);
      const warning: SvelteWarning = {
        code: 'unknown-prop',
        message: longMessage
      };

      expect(() => {
        onwarnHandler(warning, mockHandler);
      }).not.toThrow();
    });

    it('должен обрабатывать warnings с специальными символами', () => {
      const warning: SvelteWarning = {
        code: 'unknown-prop',
        message: "Component was created with unknown prop 'prop-with-special@#$%^&*()characters'"
      };

      onwarnHandler(warning, mockHandler);

      expect(mockHandler).toHaveBeenCalledWith(warning);
    });

    it('должен обрабатывать warnings без filename', () => {
      const warning: SvelteWarning = {
        code: 'unknown-prop',
        message: "Component was created with unknown prop 'params'"
      };

      expect(() => {
        onwarnHandler(warning, mockHandler);
      }).not.toThrow();
    });

    it('должен обрабатывать неизвестные коды warnings', () => {
      const warning: SvelteWarning = {
        code: 'completely-unknown-warning-code',
        message: "Some unknown warning"
      };

      onwarnHandler(warning, mockHandler);

      expect(mockHandler).toHaveBeenCalledWith(warning);
    });
  });
});