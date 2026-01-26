#!/usr/bin/env node

/**
 * Generate TOON metadata for error-patterns.json
 *
 * Reads error-patterns.json, generates TOON representations for all arrays,
 * calculates token savings, and outputs hybrid JSON+TOON format.
 *
 * Usage: node generate-toon.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { arrayToToon, calculateTokenSavings } from '/home/ikeniborn/Documents/Project/iclaude/.nvm-isolated/.claude-isolated/skills/toon-skill/converters/toon-converter.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const errorPatternsPath = resolve(__dirname, 'error-patterns.json');

// Read current error-patterns.json
const errorPatternsContent = readFileSync(errorPatternsPath, 'utf8');
const errorPatterns = JSON.parse(errorPatternsContent);

// Generate TOON for each array
const fixableLocallyToon = arrayToToon(
  'fixable_locally',
  errorPatterns.fixable_locally,
  ['pattern', 'category', 'fix_command', 'severity', 'retry_delay', 'description']
);

const fixableRemotelyToon = arrayToToon(
  'fixable_remotely',
  errorPatterns.fixable_remotely,
  ['pattern', 'category', 'fix_command', 'severity', 'retry_delay', 'description']
);

const notFixableToon = arrayToToon(
  'not_fixable',
  errorPatterns.not_fixable,
  ['pattern', 'category', 'manual_action', 'severity', 'description']
);

// Calculate token savings
const fixableLocallyStats = calculateTokenSavings({ fixable_locally: errorPatterns.fixable_locally });
const fixableRemotelyStats = calculateTokenSavings({ fixable_remotely: errorPatterns.fixable_remotely });
const notFixableStats = calculateTokenSavings({ not_fixable: errorPatterns.not_fixable });

// Calculate total savings
const totalJsonTokens = fixableLocallyStats.jsonTokens + fixableRemotelyStats.jsonTokens + notFixableStats.jsonTokens;
const totalToonTokens = fixableLocallyStats.toonTokens + fixableRemotelyStats.toonTokens + notFixableStats.toonTokens;
const totalSavedTokens = totalJsonTokens - totalToonTokens;
const totalSavedPercent = ((totalSavedTokens / totalJsonTokens) * 100).toFixed(1) + '%';

// Add TOON metadata section
errorPatterns.toon = {
  fixable_locally_toon: fixableLocallyToon,
  fixable_remotely_toon: fixableRemotelyToon,
  not_fixable_toon: notFixableToon,
  token_savings: {
    fixable_locally: fixableLocallyStats.savedPercent,
    fixable_remotely: fixableRemotelyStats.savedPercent,
    not_fixable: notFixableStats.savedPercent,
    total: totalSavedPercent
  },
  size_comparison: {
    json_tokens: totalJsonTokens,
    toon_tokens: totalToonTokens,
    saved_tokens: totalSavedTokens,
    saved_percent: totalSavedPercent
  }
};

// Update metadata version
errorPatterns.metadata.version = '9.1.0';
errorPatterns.metadata.last_updated = new Date().toISOString().split('T')[0];
errorPatterns.metadata.description = 'Error pattern classification for deploy-test auto-recovery with TOON optimization';

// Write updated JSON
writeFileSync(errorPatternsPath, JSON.stringify(errorPatterns, null, 2) + '\n', 'utf8');

console.log('✓ Generated TOON metadata for error-patterns.json');
console.log(`  Total savings: ${totalSavedTokens} tokens (${totalSavedPercent})`);
console.log(`  - fixable_locally: ${fixableLocallyStats.savedTokens} tokens (${fixableLocallyStats.savedPercent})`);
console.log(`  - fixable_remotely: ${fixableRemotelyStats.savedTokens} tokens (${fixableRemotelyStats.savedPercent})`);
console.log(`  - not_fixable: ${notFixableStats.savedTokens} tokens (${notFixableStats.savedPercent})`);
