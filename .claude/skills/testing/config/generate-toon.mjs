#!/usr/bin/env node

/**
 * Generate TOON metadata for test-templates.json
 *
 * Reads test-templates.json, generates TOON representations for all arrays,
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

const testTemplatesPath = resolve(__dirname, 'test-templates.json');

// Read current test-templates.json
const testTemplatesContent = readFileSync(testTemplatesPath, 'utf8');
const testTemplates = JSON.parse(testTemplatesContent);

// Generate TOON for each array
const unitTestsToon = arrayToToon(
  'unit_test_templates',
  testTemplates.unit_test_templates,
  ['test_name', 'http_method', 'endpoint', 'expected_status', 'validates', 'description']
);

const integrationTestsToon = arrayToToon(
  'integration_test_templates',
  testTemplates.integration_test_templates,
  ['test_name', 'workflow', 'steps', 'validates', 'description']
);

const fixturesToon = arrayToToon(
  'fixture_templates',
  testTemplates.fixture_templates,
  ['fixture_name', 'scope', 'returns', 'description']
);

// Calculate token savings
const unitTestsStats = calculateTokenSavings({ unit_test_templates: testTemplates.unit_test_templates });
const integrationTestsStats = calculateTokenSavings({ integration_test_templates: testTemplates.integration_test_templates });
const fixturesStats = calculateTokenSavings({ fixture_templates: testTemplates.fixture_templates });

// Calculate total savings
const totalJsonTokens = unitTestsStats.jsonTokens + integrationTestsStats.jsonTokens + fixturesStats.jsonTokens;
const totalToonTokens = unitTestsStats.toonTokens + integrationTestsStats.toonTokens + fixturesStats.toonTokens;
const totalSavedTokens = totalJsonTokens - totalToonTokens;
const totalSavedPercent = ((totalSavedTokens / totalJsonTokens) * 100).toFixed(1) + '%';

// Add TOON metadata section
testTemplates.toon = {
  unit_test_templates_toon: unitTestsToon,
  integration_test_templates_toon: integrationTestsToon,
  fixture_templates_toon: fixturesToon,
  token_savings: {
    unit_test_templates: unitTestsStats.savedPercent,
    integration_test_templates: integrationTestsStats.savedPercent,
    fixture_templates: fixturesStats.savedPercent,
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
testTemplates.metadata.version = '2.1.0';
testTemplates.metadata.last_updated = new Date().toISOString().split('T')[0];
testTemplates.metadata.description = 'Test templates for pytest with TOON optimization';

// Write updated JSON
writeFileSync(testTemplatesPath, JSON.stringify(testTemplates, null, 2) + '\n', 'utf8');

console.log('✓ Generated TOON metadata for test-templates.json');
console.log(`  Total savings: ${totalSavedTokens} tokens (${totalSavedPercent})`);
console.log(`  - unit_test_templates: ${unitTestsStats.savedTokens} tokens (${unitTestsStats.savedPercent})`);
console.log(`  - integration_test_templates: ${integrationTestsStats.savedTokens} tokens (${integrationTestsStats.savedPercent})`);
console.log(`  - fixture_templates: ${fixturesStats.savedTokens} tokens (${fixturesStats.savedPercent})`);
