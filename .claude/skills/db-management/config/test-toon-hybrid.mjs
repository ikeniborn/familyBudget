#!/usr/bin/env node
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { toonToJson, validateToon } from '/home/ikeniborn/Documents/Project/iclaude/.nvm-isolated/.claude-isolated/skills/toon-skill/converters/toon-converter.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const migrationTemplatesPath = resolve(__dirname, 'migration-templates.json');
const migrationTemplates = JSON.parse(readFileSync(migrationTemplatesPath, 'utf8'));

console.log('Testing TOON hybrid output for migration-templates.json...\n');
let allPassed = true;

// Test 1: Validate TOON strings
console.log('Test 1: Validate TOON strings');
const toonStrings = {
  scd_type2_migration_steps: migrationTemplates.toon.scd_type2_migration_steps_toon,
  closure_table_migration_steps: migrationTemplates.toon.closure_table_migration_steps_toon,
  shared_budget_migration_steps: migrationTemplates.toon.shared_budget_migration_steps_toon
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

// Test 2: Round-trip TOON strings
console.log('Test 2: Round-trip TOON strings');
for (const [arrayName, toonString] of Object.entries(toonStrings)) {
  try {
    const decoded = toonToJson(toonString);
    if (!decoded[arrayName]) {
      console.error(`  ✗ ${arrayName}: Decoded object missing key`);
      allPassed = false;
      continue;
    }
    const originalArray = migrationTemplates[arrayName];
    const decodedArray = decoded[arrayName];
    if (originalArray.length !== decodedArray.length) {
      console.error(`  ✗ ${arrayName}: Length mismatch`);
      allPassed = false;
      continue;
    }
    const originalStr = JSON.stringify(originalArray);
    const decodedStr = JSON.stringify(decodedArray);
    if (originalStr === decodedStr) {
      console.log(`  ✓ ${arrayName}: Round-trip successful (lossless)`);
    } else {
      console.error(`  ✗ ${arrayName}: Round-trip data mismatch`);
      allPassed = false;
    }
  } catch (error) {
    console.error(`  ✗ ${arrayName}: Round-trip failed: ${error.message}`);
    allPassed = false;
  }
}
console.log();

// Test 3: Verify token savings
console.log('Test 3: Verify token savings metadata');
const tokenSavings = migrationTemplates.toon.token_savings;
const sizeComparison = migrationTemplates.toon.size_comparison;
if (tokenSavings && sizeComparison) {
  console.log('  ✓ Token savings metadata present');
  console.log(`    Total savings: ${sizeComparison.saved_tokens} tokens (${sizeComparison.saved_percent})`);
  console.log(`    - scd_type2_migration_steps: ${tokenSavings.scd_type2_migration_steps}`);
  console.log(`    - closure_table_migration_steps: ${tokenSavings.closure_table_migration_steps}`);
  console.log(`    - shared_budget_migration_steps: ${tokenSavings.shared_budget_migration_steps}`);
} else {
  console.error('  ✗ Token savings metadata missing');
  allPassed = false;
}
console.log();

// Test 4: Verify version
console.log('Test 4: Verify metadata version');
if (migrationTemplates.metadata.version === '2.1.0') {
  console.log('  ✓ Metadata version bumped to 2.1.0');
} else {
  console.error(`  ✗ Metadata version is ${migrationTemplates.metadata.version}, expected 2.1.0`);
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
