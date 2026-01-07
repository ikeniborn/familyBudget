import { Plugin } from 'vite';

/**
 * Vite plugin для инжекции CACHE_VERSION в Service Worker
 *
 * Заменяет PLACEHOLDER на реальную версию из process.env.CACHE_VERSION
 *
 * Аналог: scripts/lib/minify.sh (строки для Service Worker)
 */
export default function swCacheVersionPlugin(): Plugin {
  return {
    name: 'sw-cache-version',

    // Обработка Service Worker перед минификацией
    transform(code: string, id: string) {
      // Только для sw.js
      if (!id.endsWith('sw.js')) {
        return null;
      }

      const cacheVersion = process.env.CACHE_VERSION;

      if (!cacheVersion) {
        this.warn('CACHE_VERSION environment variable not set! Using fallback.');
        // Используем fallback (как в deploy.sh)
        const fallback = `v${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '_')}`;
        return {
          code: code.replace(/PLACEHOLDER/g, fallback),
          map: null
        };
      }

      // Заменить PLACEHOLDER на реальную версию
      const transformedCode = code.replace(/PLACEHOLDER/g, cacheVersion);

      // Валидация: убедиться что замена произошла
      if (transformedCode === code) {
        this.warn('PLACEHOLDER not found in sw.js - cache version not injected!');
      }
      // Success logged by Vite build output

      return {
        code: transformedCode,
        map: null
      };
    }
  };
}
