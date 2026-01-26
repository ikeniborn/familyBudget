#!/usr/bin/env node

/**
 * Test TOON hybrid output for error-patterns.json
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
import { toonToJson, validateToon, arrayToToon } from '/home/ikeniborn/Documents/Project/iclaude/.nvm-isolated/.claude-isolated/skills/toon-skill/converters/toon-converter.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const errorPatternsPath = resolve(__dirname, 'error-patterns.json');

// Read error-patterns.json
const errorPatternsContent = readFileSync(errorPatternsPath, 'utf8');
const errorPatterns = JSON.parse(errorPatternsContent);

console.log('Testing TOON hybrid output for error-patterns.json...\n');

let allPassed = true;

// Test 1: Validate TOON strings
console.log('Test 1: Validate TOON strings');

const toonStrings = {
  fixable_locally: errorPatterns.toon.fixable_locally_toon,
  fixable_remotely: errorPatterns.toon.fixable_remotely_toon,
  not_fixable: errorPatterns.toon.not_fixable_toon
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
  fixable_locally: ['pattern', 'category', 'fix_command', 'severity', 'retry_delay', 'description'],
  fixable_remotely: ['pattern', 'category', 'fix_command', 'severity', 'retry_delay', 'description'],
  not_fixable: ['pattern', 'category', 'manual_action', 'severity', 'description']
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
    const originalArray = errorPatterns[arrayName];
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

const tokenSavings = errorPatterns.toon.token_savings;
const sizeComparison = errorPatterns.toon.size_comparison;

if (tokenSavings && sizeComparison) {
  console.log(`  ✓ Token savings metadata present`);
  console.log(`    Total savings: ${sizeComparison.saved_tokens} tokens (${sizeComparison.saved_percent})`);
  console.log(`    - fixable_locally: ${tokenSavings.fixable_locally}`);
  console.log(`    - fixable_remotely: ${tokenSavings.fixable_remotely}`);
  console.log(`    - not_fixable: ${tokenSavings.not_fixable}`);
} else {
  console.error(`  ✗ Token savings metadata missing`);
  allPassed = false;
}

console.log();

// Test 4: Verify metadata version bump
console.log('Test 4: Verify metadata version');

if (errorPatterns.metadata.version === '9.1.0') {
  console.log(`  ✓ Metadata version bumped to 9.1.0`);
} else {
  console.error(`  ✗ Metadata version is ${errorPatterns.metadata.version}, expected 9.1.0`);
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
