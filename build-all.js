#!/usr/bin/env node

/**
 * Build script для последовательной сборки всех entry points через Vite
 *
 * Vite не поддерживает multiple IIFE bundles в одном конфиге,
 * поэтому запускаем build 5 раз с разными входными файлами.
 */

const { spawn } = require('child_process');
const { resolve } = require('path');

const production = process.env.NODE_ENV === 'production';
const cacheVersion = process.env.CACHE_VERSION || `v${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '_')}`;

// 5 entry points для сборки
const builds = [
  {
    name: 'budgetShared',
    input: 'frontend/shared/static/js/budgetShared.ts',
    output: 'frontend/shared/static/js/budgetShared.bundle.js',
    globalName: 'BudgetShared'
  },
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
    input: 'frontend/web/static/js/modules/uiComponents/index.ts',
    output: 'frontend/web/static/js/dist/components.bundle.js',
    globalName: 'UIComponents'
  },
  {
    name: 'sw',
    input: 'sw.js',
    output: 'sw.min.js',
    globalName: 'ServiceWorker',
    isServiceWorker: true
  }
];

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`🚀 Building ${builds.length} bundles with Vite`);
console.log(`📦 Mode: ${production ? 'PRODUCTION' : 'development'}`);
console.log(`🔖 Cache Version: ${cacheVersion}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

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

    const vite = spawn('npx', ['vite', 'build', '--config', 'vite.config.single.ts'], {
      env,
      stdio: 'inherit',
      shell: true
    });

    vite.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${build.name} built successfully\n`);
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

// Последовательная сборка всех bundles
async function buildAll() {
  const startTime = Date.now();

  try {
    for (const build of builds) {
      await runBuild(build);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ All bundles built successfully in ${duration}s`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Build failed:', error.message);
    process.exit(1);
  }
}

buildAll();
