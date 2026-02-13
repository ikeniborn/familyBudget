#!/usr/bin/env node

/**
 * Post-build verification script for Dexie window export
 *
 * Verifies that dexie.min.js correctly exports window.Dexie global variable
 * for external bundles (facts.min.js, shopping.min.js, etc.)
 *
 * Usage:
 *   node scripts/verify-dexie-export.js
 *
 * Exit codes:
 *   0 - Success (window.Dexie exported)
 *   1 - Failure (file not found or window.Dexie not exported)
 */

const fs = require('fs');
const path = require('path');

const dexieMinPath = path.join(__dirname, '../frontend/shared/db/dexie.min.js');

console.log('[VERIFY] Checking Dexie window export...');

// Check if file exists
if (!fs.existsSync(dexieMinPath)) {
  console.error('❌ dexie.min.js not found at:', dexieMinPath);
  console.error('   Build may have failed or file was not copied to static/');
  process.exit(1);
}

// Read file content
const content = fs.readFileSync(dexieMinPath, 'utf-8');

// Check for window.Dexie assignment patterns
const patterns = [
  /window\.Dexie\s*=/,           // window.Dexie = ...
  /window\["Dexie"\]\s*=/,       // window["Dexie"] = ...
  /window\['Dexie'\]\s*=/,       // window['Dexie'] = ...
];

const hasWindowExport = patterns.some(pattern => pattern.test(content));

if (!hasWindowExport) {
  console.error('❌ dexie.min.js does NOT export window.Dexie');
  console.error('   External bundles (facts, shopping) will fail with "Dexie is not defined"');
  console.error('');
  console.error('   Check:');
  console.error('   1. frontend/shared/db/dexie/index.ts has window.Dexie assignment');
  console.error('   2. Vite config uses format: "iife"');
  console.error('   3. Build pipeline copies file to static/js/shared/db/');
  process.exit(1);
}

// Check file size (should be > 10KB for bundled Dexie.js)
const stats = fs.statSync(dexieMinPath);
const sizeKB = Math.round(stats.size / 1024);

if (sizeKB < 10) {
  console.warn('⚠️  dexie.min.js is unusually small:', sizeKB, 'KB');
  console.warn('   Expected size: 50-100 KB (includes Dexie.js library + app code)');
  console.warn('   Build may be incomplete');
}

console.log('✅ dexie.min.js correctly exports window.Dexie');
console.log(`   File size: ${sizeKB} KB`);
console.log('');
console.log('[VERIFY] All checks passed!');
process.exit(0);
