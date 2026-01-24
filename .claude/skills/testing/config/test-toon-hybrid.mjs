#!/usr/bin/env node

/**
 * Test TOON hybrid output for test-templates.json
 *
 * Validates that:
 * 1. JSON arrays are parseable
 * 2. TOON strings are valid
 * 3. TOON strings round-trip to original JSON arrays (lossless)
 *
 * Usage: node test-toon-hybrid.mjs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { toonToJson, validateToon } from '/home/ikeniborn/Documents/Project/iclaude/.nvm-isolated/.claude-isolated/skills/toon-skill/converters/toon-converter.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const testTemplatesPath = resolve(__dirname, 'test-templates.json');

// Read test-templates.json
const testTemplatesContent = readFileSync(testTemplatesPath, 'utf8');
const testTemplates = JSON.parse(testTemplatesContent);

console.log('Testing TOON hybrid output for test-templates.json...\n');

let allPassed = true;

// Test 1: Validate TOON strings
console.log('Test 1: Validate TOON strings');

const toonStrings = {
  unit_test_templates: testTemplates.toon.unit_test_templates_toon,
  integration_test_templates: testTemplates.toon.integration_test_templates_toon,
  fixture_templates: testTemplates.toon.fixture_templates_toon
};

for (const [arrayName, toonString] of Object.entries(toonStrings)) {
  const validation = validateToon(toonString);
  if (validation.valid) {
    console.log(`  ✓ ${arrayName}_toon is valid TOON`);
  } else {
    console.error(`  ✗ ${arrayName}_toon is INVALID: ${validation.error}`);
    allPassed = false;
  }
}

console.log();

// Test 2: Round-trip each TOON string
console.log('Test 2: Round-trip TOON strings');

const arrayFields = {
  unit_test_templates: ['test_name', 'http_method', 'endpoint', 'expected_status', 'validates', 'description'],
  integration_test_templates: ['test_name', 'workflow', 'steps', 'validates', 'description'],
  fixture_templates: ['fixture_name', 'scope', 'returns', 'description']
};

for (const [arrayName, toonString] of Object.entries(toonStrings)) {
  try {
    // Decode TOON to JSON
    const decoded = toonToJson(toonString);

    // Check that decoded has the array
    if (!decoded[arrayName]) {
      console.error(`  ✗ ${arrayName}: Decoded object missing '${arrayName}' key`);
      allPassed = false;
      continue;
    }

    // Compare with original JSON array
    const originalArray = testTemplates[arrayName];
    const decodedArray = decoded[arrayName];

    if (originalArray.length !== decodedArray.length) {
      console.error(`  ✗ ${arrayName}: Length mismatch (original: ${originalArray.length}, decoded: ${decodedArray.length})`);
      allPassed = false;
      continue;
    }

    // Deep equality check
    const originalStr = JSON.stringify(originalArray);
    const decodedStr = JSON.stringify(decodedArray);

    if (originalStr === decodedStr) {
      console.log(`  ✓ ${arrayName}: Round-trip successful (lossless)`);
    } else {
      console.error(`  ✗ ${arrayName}: Round-trip data mismatch`);
      console.error(`    Original: ${originalStr.substring(0, 100)}...`);
      console.error(`    Decoded:  ${decodedStr.substring(0, 100)}...`);
      allPassed = false;
    }
  } catch (error) {
    console.error(`  ✗ ${arrayName}: Round-trip failed: ${error.message}`);
    allPassed = false;
  }
}

console.log();

// Test 3: Verify token savings metadata
console.log('Test 3: Verify token savings metadata');

const tokenSavings = testTemplates.toon.token_savings;
const sizeComparison = testTemplates.toon.size_comparison;

if (tokenSavings && sizeComparison) {
  console.log('  ✓ Token savings metadata present');
  console.log(`    Total savings: ${sizeComparison.saved_tokens} tokens (${sizeComparison.saved_percent})`);
  console.log(`    - unit_test_templates: ${tokenSavings.unit_test_templates}`);
  console.log(`    - integration_test_templates: ${tokenSavings.integration_test_templates}`);
  console.log(`    - fixture_templates: ${tokenSavings.fixture_templates}`);
} else {
  console.error('  ✗ Token savings metadata missing');
  allPassed = false;
}

console.log();

// Test 4: Verify metadata version bump
console.log('Test 4: Verify metadata version');

if (testTemplates.metadata.version === '2.1.0') {
  console.log('  ✓ Metadata version bumped to 2.1.0');
} else {
  console.error(`  ✗ Metadata version is ${testTemplates.metadata.version}, expected 2.1.0`);
  allPassed = false;
}

console.log();

// Final result
if (allPassed) {
  console.log('✅ All tests passed! Hybrid output is valid and lossless.');
  process.exit(0);
} else {
  console.error('❌ Some tests failed. See errors above.');
  process.exit(1);
}
