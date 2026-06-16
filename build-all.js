#!/usr/bin/env node

/**
 * Build script для последовательной сборки всех entry points через Vite
 *
 * Vite не поддерживает multiple IIFE bundles в одном конфиге,
 * поэтому запускаем build 41 раз с разными входными файлами.
 *
 * Оптимизации (v11.1.0):
 * - Incremental builds: Пропуск неизменённых bundles (hash-based detection)
 *
 * Cache invalidation: 2026-02-01T20:15:00+03:00
 * - Кеш хранится в .build-cache/ (gitignore)
 */

const { spawn } = require('child_process');
const { resolve } = require('path');
const fs = require('fs');
const crypto = require('crypto');

const production = process.env.NODE_ENV === 'production';
const cacheVersion = process.env.CACHE_VERSION || `v${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '_')}`;
const CACHE_DIR = '.build-cache';
const FORCE_REBUILD = process.env.FORCE_REBUILD === 'true';

// All entry points built through Vite (v7.1.0: unified build system)
const builds = [
  // === Network Detection Module (ZERO dependencies - must be first!) ===
  // Output to frontend/web/static/js/ because nginx serves /static/ from there
  {
    name: 'network',
    input: 'frontend/shared/network/index.ts',
    output: 'frontend/web/static/js/network.min.js',
    globalName: 'NetworkModule'
  },

  // === Individual shared modules (loaded directly in HTML via <script> tags) ===
  {
    name: 'budgetShared',
    input: 'frontend/shared/static/js/budgetShared.ts',
    output: 'frontend/shared/static/js/budgetShared.min.js',
    globalName: 'BudgetShared'
  },
  {
    name: 'debugLog',
    input: 'frontend/shared/static/js/debugLog.ts',
    output: 'frontend/shared/static/js/debugLog.min.js',
    globalName: 'DebugLog'
  },
  {
    name: 'dateFormatter',
    input: 'frontend/shared/static/js/dateFormatter.ts',
    output: 'frontend/shared/static/js/dateFormatter.min.js',
    globalName: 'DateFormatter'
  },
  {
    name: 'calendar-widget',
    input: 'frontend/shared/static/js/calendar-widget.js',
    output: 'frontend/shared/static/js/calendar-widget.min.js',
    globalName: 'CalendarWidget'
  },
  {
    name: 'confirm-dialog',
    input: 'frontend/web/static/js/confirm-dialog-bundle.ts',
    output: 'frontend/web/static/js/confirm-dialog.min.js',
    globalName: 'ConfirmDialogBundle'
  },
  {
    name: 'choicesCategoryTree',
    input: 'frontend/shared/static/js/choicesCategoryTree.js',
    output: 'frontend/shared/static/js/choicesCategoryTree.min.js',
    globalName: 'ChoicesCategoryTree'
  },
  {
    name: 'choicesProductGroupTree',
    input: 'frontend/shared/static/js/choicesProductGroupTree.js',
    output: 'frontend/shared/static/js/choicesProductGroupTree.min.js',
    globalName: 'ChoicesProductGroupTree'
  },
  {
    name: 'reminders',
    input: 'frontend/shared/static/js/reminders.js',
    output: 'frontend/shared/static/js/reminders.min.js',
    globalName: 'Reminders'
  },

  // === Legacy Web modules (utils, budget, workers) ===
  // Utils
  {
    name: 'logger',
    input: 'frontend/web/static/js/utils/logger.js',
    output: 'frontend/web/static/js/utils/logger.min.js',
    globalName: 'Logger'
  },
  {
    name: 'logging',
    input: 'frontend/web/static/js/config/logging.js',
    output: 'frontend/web/static/js/config/logging.min.js',
    globalName: 'LoggingConfig'
  },
  {
    name: 'modalKeyboardAdapter',
    input: 'frontend/web/static/js/utils/modalKeyboardAdapter.js',
    output: 'frontend/web/static/js/utils/modalKeyboardAdapter.min.js',
    globalName: 'ModalKeyboardAdapter'
  },
  {
    name: 'cacheMetricsCollector',
    input: 'frontend/web/static/js/utils/cacheMetricsCollector.js',
    output: 'frontend/web/static/js/utils/cacheMetricsCollector.min.js',
    globalName: 'CacheMetricsCollector'
  },
  {
    name: 'logsCollector',
    input: 'frontend/web/static/js/utils/logsCollector.js',
    output: 'frontend/web/static/js/utils/logsCollector.min.js',
    globalName: 'LogsCollector'
  },
  {
    name: 'performanceMonitor',
    input: 'frontend/web/static/js/utils/performanceMonitor.js',
    output: 'frontend/web/static/js/utils/performanceMonitor.min.js',
    globalName: 'PerformanceMonitor'
  },
  // Budget
  {
    name: 'budgetWSClient',
    input: 'frontend/web/static/js/budget/budgetWSClient.js',
    output: 'frontend/web/static/js/budget/budgetWSClient.min.js',
    globalName: 'BudgetWSClient'
  },
  {
    name: 'incrementalUpdates',
    input: 'frontend/web/static/js/budget/incrementalUpdates.js',
    output: 'frontend/web/static/js/budget/incrementalUpdates.min.js',
    globalName: 'IncrementalUpdates'
  },
  // Workers
  {
    name: 'csvWorker',
    input: 'frontend/web/static/js/lists/workers/csvWorker.ts',  // TypeScript migration (v2.0.0)
    output: 'frontend/web/static/js/workers/csvWorker.min.js',
    globalName: 'CSVWorker'
  },
  {
    name: 'hierarchyWorker',
    input: 'frontend/web/static/js/workers/hierarchyWorker.js',
    output: 'frontend/web/static/js/workers/hierarchyWorker.min.js',
    globalName: 'HierarchyWorker'
  },
  {
    name: 'workerWrapper',
    input: 'frontend/web/static/js/workers/core/workerWrapper.js',
    output: 'frontend/web/static/js/workers/core/workerWrapper.min.js',
    globalName: 'WorkerWrapper'
  },
  // Root-level modules
  {
    name: 'navigationProgress',
    input: 'frontend/web/static/js/navigationProgress.js',
    output: 'frontend/web/static/js/navigationProgress.min.js',
    globalName: 'NavigationProgress'
  },
  {
    name: 'webauthn-onboarding',
    input: 'frontend/web/static/js/webauthn/WebAuthnManager/index.ts',  // TypeScript entry point
    output: 'frontend/web/static/js/webauthn-onboarding.min.js',
    globalName: 'WebAuthnOnboarding'
  },

  // === Application bundles ===
  {
    name: 'bundle',
    input: 'frontend/web/static/js/index.ts',
    output: 'frontend/web/static/js/dist/bundle.js',
    globalName: 'BudgetApp'
  },
  {
    name: 'webapp',
    input: 'frontend/webapp/static/js/index.ts',
    output: 'frontend/webapp/static/js/dist/webapp.bundle.js',
    globalName: 'WebApp'
  },
  {
    name: 'components',
    input: 'frontend/web/static/js/modules/uiComponents/index.iife.ts',
    output: 'frontend/web/static/js/dist/components.bundle.js',
    globalName: 'UIComponents'
  },
  {
    name: 'lists',
    input: 'frontend/web/static/js/lists-bundle.ts',
    output: 'frontend/web/static/js/lists.min.js',
    globalName: 'ListsApp'
  },
  {
    name: 'transfers',
    input: 'frontend/web/static/js/transfers/index.ts',
    output: 'frontend/web/static/js/transfers.min.js',
    globalName: 'Transfers'
  },
  {
    name: 'plan',
    input: 'frontend/web/static/js/plan/index.ts',
    output: 'frontend/web/static/js/dist/plan.bundle.js',
    globalName: 'PlanApp'
  },
  {
    name: 'medicines',
    input: 'frontend/web/static/js/medicines-bundle.ts',
    output: 'frontend/web/static/js/medicines.min.js',
    globalName: 'MedicinesApp'
  },
  {
    name: 'facts',
    input: 'frontend/web/static/js/facts/index.ts',
    output: 'frontend/web/static/js/facts.min.js',
    globalName: 'FactsManager'
  },
  {
    name: 'dashboard',
    input: 'frontend/web/static/js/dashboard/index.ts',
    output: 'frontend/web/static/js/dashboard.min.js',
    globalName: 'Dashboard'
  },
  {
    name: 'pushManager',
    input: 'frontend/web/static/js/notifications/pushManager.ts',
    output: 'frontend/web/static/js/notifications/pushManager.min.js',
    globalName: 'PushManager'
  },

  // === Service Worker ===
  {
    name: 'sw',
    input: 'sw.js',
    output: 'frontend/web/static/sw.min.js',
    globalName: 'ServiceWorker',
    isServiceWorker: true
  }
];

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`🚀 Building ${builds.length} bundles with Vite`);
console.log(`📦 Mode: ${production ? 'PRODUCTION' : 'development'}`);
console.log(`🔖 Cache Version: ${cacheVersion}`);
console.log(`♻️  Incremental builds: ${!FORCE_REBUILD ? 'ENABLED' : 'DISABLED (FORCE_REBUILD)'}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

/**
 * Вычислить MD5 хеш исходного файла
 * @param {string} filepath - Путь к исходному файлу
 * @returns {string} MD5 хеш содержимого файла
 */
function getFileHash(filepath) {
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    return crypto.createHash('md5').update(content).digest('hex');
  } catch (error) {
    console.warn(`⚠️  Cannot hash ${filepath}: ${error.message}`);
    return null;
  }
}

/**
 * Проверить, нужно ли пересобирать bundle
 * @param {Object} build - Build configuration
 * @returns {boolean} true если нужно пересобирать
 */
function shouldRebuild(build) {
  // Форсированная пересборка
  if (FORCE_REBUILD) return true;

  const hashFile = `${CACHE_DIR}/${build.name}.hash`;
  const currentHash = getFileHash(build.input);

  // Не удалось вычислить хеш → пересобрать
  if (!currentHash) return true;

  // Первая сборка → пересобрать
  if (!fs.existsSync(hashFile)) {
    console.log(`🆕 First build: ${build.name}`);
    return true;
  }

  // Проверить существование output файла
  if (!fs.existsSync(build.output)) {
    console.log(`🔨 Output missing: ${build.name} (rebuilding)`);
    return true;
  }

  // Сравнить хеш
  const previousHash = fs.readFileSync(hashFile, 'utf8');
  if (currentHash !== previousHash) {
    console.log(`🔄 Changed: ${build.name}`);
    return true;
  }

  // Файл не изменился → пропустить
  console.log(`✓ Skip unchanged: ${build.name}`);
  return false;
}

/**
 * Сохранить хеш после успешной сборки
 * @param {Object} build - Build configuration
 */
function saveHash(build) {
  const hash = getFileHash(build.input);
  if (!hash) return;

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(`${CACHE_DIR}/${build.name}.hash`, hash);
}

// Функция для запуска одного build
function runBuild(build) {
  return new Promise((resolve, reject) => {
    console.log(`📦 Building: ${build.name} (${build.output})`);

    const env = {
      ...process.env,
      VITE_ENTRY_NAME: build.name,
      VITE_ENTRY_INPUT: build.input,
      VITE_ENTRY_OUTPUT: build.output,
      VITE_GLOBAL_NAME: build.globalName,
      VITE_IS_SW: build.isServiceWorker ? 'true' : 'false',
      NODE_ENV: production ? 'production' : 'development',
      CACHE_VERSION: cacheVersion
    };

    const vite = spawn('npx', ['vite', 'build', '--config', 'config/vite.config.single.ts'], {
      env,
      stdio: 'inherit',
      shell: true
    });

    vite.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${build.name} built successfully\n`);
        saveHash(build); // Сохранить хеш после успешной сборки
        resolve();
      } else {
        reject(new Error(`Build failed for ${build.name} with code ${code}`));
      }
    });

    vite.on('error', (err) => {
      reject(err);
    });
  });
}

// Последовательная сборка всех bundles с incremental optimization
async function buildAll() {
  const startTime = Date.now();

  try {
    // Фильтровать bundles для пересборки
    const toBuild = builds.filter(shouldRebuild);
    const skipped = builds.length - toBuild.length;

    console.log(`📊 Building ${toBuild.length} of ${builds.length} bundles (${skipped} unchanged)\n`);

    // Собрать только изменённые bundles
    for (const build of toBuild) {
      await runBuild(build);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Build completed in ${duration}s`);
    console.log(`   Built: ${toBuild.length} bundles`);
    console.log(`   Skipped: ${skipped} bundles (unchanged)`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Build failed:', error.message);
    process.exit(1);
  }
}

buildAll();
