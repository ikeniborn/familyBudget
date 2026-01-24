#!/usr/bin/env node

/**
 * Generate TOON metadata for crud-operations.json
 *
 * Reads crud-operations.json, generates TOON representation,
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

const crudOperationsPath = resolve(__dirname, 'crud-operations.json');

// Read current crud-operations.json
const crudOperationsContent = readFileSync(crudOperationsPath, 'utf8');
const crudOperations = JSON.parse(crudOperationsContent);

// Generate TOON for crud_operations array
const crudOperationsToon = arrayToToon(
  'crud_operations',
  crudOperations.crud_operations,
  ['operation', 'http_method', 'path', 'status_code', 'requires_auth', 'permission', 'request_body', 'response_body', 'scd_type2', 'description']
);

// Calculate token savings
const stats = calculateTokenSavings({ crud_operations: crudOperations.crud_operations });

// Add TOON metadata section
crudOperations.toon = {
  crud_operations_toon: crudOperationsToon,
  token_savings: stats.savedPercent,
  size_comparison: {
    json_tokens: stats.jsonTokens,
    toon_tokens: stats.toonTokens,
    saved_tokens: stats.savedTokens,
    saved_percent: stats.savedPercent
  }
};

// Update metadata version
crudOperations.metadata.version = '3.1.0';
crudOperations.metadata.last_updated = new Date().toISOString().split('T')[0];
crudOperations.metadata.description = 'CRUD operations for FastAPI endpoints with TOON optimization';

// Write updated JSON
writeFileSync(crudOperationsPath, JSON.stringify(crudOperations, null, 2) + '\n', 'utf8');

console.log('✓ Generated TOON metadata for crud-operations.json');
console.log(`  Total savings: ${stats.savedTokens} tokens (${stats.savedPercent})`);
console.log(`  JSON: ${stats.jsonTokens} tokens (${stats.jsonSize} bytes)`);
console.log(`  TOON: ${stats.toonTokens} tokens (${stats.toonSize} bytes)`);
