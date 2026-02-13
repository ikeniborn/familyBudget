#!/usr/bin/env node

/**
 * Generate TOON metadata for migration-templates.json
 *
 * Reads migration-templates.json, generates TOON representations for all arrays,
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

const migrationTemplatesPath = resolve(__dirname, 'migration-templates.json');

// Read current migration-templates.json
const migrationTemplatesContent = readFileSync(migrationTemplatesPath, 'utf8');
const migrationTemplates = JSON.parse(migrationTemplatesContent);

// Generate TOON for each array
const scdType2Toon = arrayToToon(
  'scd_type2_migration_steps',
  migrationTemplates.scd_type2_migration_steps,
  ['step', 'action', 'sql_snippet', 'description']
);

const closureTableToon = arrayToToon(
  'closure_table_migration_steps',
  migrationTemplates.closure_table_migration_steps,
  ['step', 'action', 'sql_snippet', 'description']
);

const sharedBudgetToon = arrayToToon(
  'shared_budget_migration_steps',
  migrationTemplates.shared_budget_migration_steps,
  ['step', 'action', 'sql_snippet', 'description']
);

// Calculate token savings
const scdType2Stats = calculateTokenSavings({ scd_type2_migration_steps: migrationTemplates.scd_type2_migration_steps });
const closureTableStats = calculateTokenSavings({ closure_table_migration_steps: migrationTemplates.closure_table_migration_steps });
const sharedBudgetStats = calculateTokenSavings({ shared_budget_migration_steps: migrationTemplates.shared_budget_migration_steps });

// Calculate total savings
const totalJsonTokens = scdType2Stats.jsonTokens + closureTableStats.jsonTokens + sharedBudgetStats.jsonTokens;
const totalToonTokens = scdType2Stats.toonTokens + closureTableStats.toonTokens + sharedBudgetStats.toonTokens;
const totalSavedTokens = totalJsonTokens - totalToonTokens;
const totalSavedPercent = ((totalSavedTokens / totalJsonTokens) * 100).toFixed(1) + '%';

// Add TOON metadata section
migrationTemplates.toon = {
  scd_type2_migration_steps_toon: scdType2Toon,
  closure_table_migration_steps_toon: closureTableToon,
  shared_budget_migration_steps_toon: sharedBudgetToon,
  token_savings: {
    scd_type2_migration_steps: scdType2Stats.savedPercent,
    closure_table_migration_steps: closureTableStats.savedPercent,
    shared_budget_migration_steps: sharedBudgetStats.savedPercent,
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
migrationTemplates.metadata.version = '2.1.0';
migrationTemplates.metadata.last_updated = new Date().toISOString().split('T')[0];
migrationTemplates.metadata.description = 'Migration templates for SCD Type 2, Closure Table, Shared Budget with TOON optimization';

// Write updated JSON
writeFileSync(migrationTemplatesPath, JSON.stringify(migrationTemplates, null, 2) + '\n', 'utf8');

console.log('✓ Generated TOON metadata for migration-templates.json');
console.log(`  Total savings: ${totalSavedTokens} tokens (${totalSavedPercent})`);
console.log(`  - scd_type2_migration_steps: ${scdType2Stats.savedTokens} tokens (${scdType2Stats.savedPercent})`);
console.log(`  - closure_table_migration_steps: ${closureTableStats.savedTokens} tokens (${closureTableStats.savedPercent})`);
console.log(`  - shared_budget_migration_steps: ${sharedBudgetStats.savedTokens} tokens (${sharedBudgetStats.savedPercent})`);
