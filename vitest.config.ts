import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./frontend/tests/setup.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/e2e/**',  // Exclude E2E tests (run with Playwright separately)
      'tests/e2e/**'  // Exclude existing E2E directory
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'frontend/tests/',
        '**/*.d.ts',
        '**/*.config.ts',
        '**/types.ts',
        '**/dist/',
        '**/vendor/',
        'backend/',
        'bot/'
      ],
      include: [
        'frontend/web/static/js/**/*.ts',
        'frontend/webapp/static/js/**/*.ts',
        'frontend/shared/static/js/**/*.ts'
      ],
      thresholds: {
        // Progressive thresholds: Start at 8.9%, increase as extraction proceeds
        // Current (Phase 3): 8.9% baseline | Phase 4: 15% (extract sync) | Phase 5: 30% (extract WS) | Phase 6+: 50-70%
        // NOTE: Low initial threshold due to large untested monoliths (budgetWSClient.ts, csvImporter.ts, listsManager.ts, offlineManager.ts)
        // Tested modules achieve 90-100% coverage, but overall is diluted by ~9,600 lines of untested legacy code
        lines: 8.9,     // TODO: Increase to 15 (Phase 4), 30 (Phase 5), 50 (Phase 6), 70 (Phase 7)
        functions: 84,  // Current: 84.34% - keep current level
        branches: 92,   // Current: 92.19% - keep current level
        statements: 8.9 // TODO: Increase to 15 (Phase 4), 30 (Phase 5), 50 (Phase 6), 70 (Phase 7)
      }
    },
    alias: {
      '@web': resolve(__dirname, 'frontend/web/static/js'),
      '@webapp': resolve(__dirname, 'frontend/webapp/static/js'),
      '@shared': resolve(__dirname, 'frontend/shared/static/js')
    }
  }
});
