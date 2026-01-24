#!/usr/bin/env node

/**
 * Test TOON hybrid output for health-checks.json
 *
 * Validates that:
 * 1. JSON array is parseable
 * 2. TOON string is valid
 * 3. TOON string round-trips to original JSON array (lossless)
 *
 * Usage: node test-toon-hybrid.mjs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { toonToJson, validateToon } from '/home/ikeniborn/Documents/Project/iclaude/.nvm-isolated/.claude-isolated/skills/toon-skill/converters/toon-converter.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const healthChecksPath = resolve(__dirname, 'health-checks.json');

// Read health-checks.json
const healthChecksContent = readFileSync(healthChecksPath, 'utf8');
const healthChecks = JSON.parse(healthChecksContent);

console.log('Testing TOON hybrid output for health-checks.json...\n');

let allPassed = true;

// Test 1: Validate TOON string
console.log('Test 1: Validate TOON string');

const toonString = healthChecks.toon.health_checks_toon;
const validation = validateToon(toonString);

if (validation.valid) {
  console.log('  ✓ health_checks_toon is valid TOON');
} else {
  console.error(`  ✗ health_checks_toon is INVALID: ${validation.error}`);
  allPassed = false;
}

console.log();

// Test 2: Round-trip TOON string
console.log('Test 2: Round-trip TOON string');

try {
  // Decode TOON to JSON
  const decoded = toonToJson(toonString);

  // Check that decoded has the array
  if (!decoded.health_checks) {
    console.error('  ✗ Decoded object missing "health_checks" key');
    allPassed = false;
  } else {
    // Compare with original JSON array
    const originalArray = healthChecks.health_checks;
    const decodedArray = decoded.health_checks;

    if (originalArray.length !== decodedArray.length) {
      console.error(`  ✗ Length mismatch (original: ${originalArray.length}, decoded: ${decodedArray.length})`);
      allPassed = false;
    } else {
      // Deep equality check
      const originalStr = JSON.stringify(originalArray);
      const decodedStr = JSON.stringify(decodedArray);

      if (originalStr === decodedStr) {
        console.log('  ✓ health_checks: Round-trip successful (lossless)');
      } else {
        console.error('  ✗ health_checks: Round-trip data mismatch');
        console.error(`    Original: ${originalStr.substring(0, 100)}...`);
        console.error(`    Decoded:  ${decodedStr.substring(0, 100)}...`);
        allPassed = false;
      }
    }
  }
} catch (error) {
  console.error(`  ✗ Round-trip failed: ${error.message}`);
  allPassed = false;
}

console.log();

// Test 3: Verify token savings metadata
console.log('Test 3: Verify token savings metadata');

const tokenSavings = healthChecks.toon.token_savings;
const sizeComparison = healthChecks.toon.size_comparison;

if (tokenSavings && sizeComparison) {
  console.log('  ✓ Token savings metadata present');
  console.log(`    Total savings: ${sizeComparison.saved_tokens} tokens (${sizeComparison.saved_percent})`);
} else {
  console.error('  ✗ Token savings metadata missing');
  allPassed = false;
}

console.log();

// Test 4: Verify metadata version bump
console.log('Test 4: Verify metadata version');

if (healthChecks.metadata.version === '2.1.0') {
  console.log('  ✓ Metadata version bumped to 2.1.0');
} else {
  console.error(`  ✗ Metadata version is ${healthChecks.metadata.version}, expected 2.1.0`);
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
