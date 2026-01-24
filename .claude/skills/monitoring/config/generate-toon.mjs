#!/usr/bin/env node

/**
 * Generate TOON metadata for health-checks.json
 *
 * Reads health-checks.json, generates TOON representation,
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

const healthChecksPath = resolve(__dirname, 'health-checks.json');

// Read current health-checks.json
const healthChecksContent = readFileSync(healthChecksPath, 'utf8');
const healthChecks = JSON.parse(healthChecksContent);

// Generate TOON for health_checks array
const healthChecksToon = arrayToToon(
  'health_checks',
  healthChecks.health_checks,
  ['id', 'command', 'threshold', 'severity', 'description']
);

// Calculate token savings
const stats = calculateTokenSavings({ health_checks: healthChecks.health_checks });

// Add TOON metadata section
healthChecks.toon = {
  health_checks_toon: healthChecksToon,
  token_savings: stats.savedPercent,
  size_comparison: {
    json_tokens: stats.jsonTokens,
    toon_tokens: stats.toonTokens,
    saved_tokens: stats.savedTokens,
    saved_percent: stats.savedPercent
  }
};

// Update metadata version
healthChecks.metadata.version = '2.1.0';
healthChecks.metadata.last_updated = new Date().toISOString().split('T')[0];
healthChecks.metadata.description = 'Health checks for Family Budget monitoring with TOON optimization';

// Write updated JSON
writeFileSync(healthChecksPath, JSON.stringify(healthChecks, null, 2) + '\n', 'utf8');

console.log('✓ Generated TOON metadata for health-checks.json');
console.log(`  Total savings: ${stats.savedTokens} tokens (${stats.savedPercent})`);
console.log(`  JSON: ${stats.jsonTokens} tokens (${stats.jsonSize} bytes)`);
console.log(`  TOON: ${stats.toonTokens} tokens (${stats.toonSize} bytes)`);
