#!/usr/bin/env node
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { toonToJson, validateToon } from '/home/ikeniborn/Documents/Project/iclaude/.nvm-isolated/.claude-isolated/skills/toon-skill/converters/toon-converter.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const crudOperationsPath = resolve(__dirname, 'crud-operations.json');
const crudOperations = JSON.parse(readFileSync(crudOperationsPath, 'utf8'));

console.log('Testing TOON hybrid output for crud-operations.json...\n');
let allPassed = true;

// Test 1: Validate TOON string
console.log('Test 1: Validate TOON string');
const toonString = crudOperations.toon.crud_operations_toon;
const validation = validateToon(toonString);
if (validation.valid) {
  console.log('  ✓ crud_operations_toon is valid TOON');
} else {
  console.error(`  ✗ crud_operations_toon is INVALID: ${validation.error}`);
  allPassed = false;
}
console.log();

// Test 2: Round-trip TOON string
console.log('Test 2: Round-trip TOON string');
try {
  const decoded = toonToJson(toonString);
  if (!decoded.crud_operations) {
    console.error('  ✗ Decoded object missing "crud_operations" key');
    allPassed = false;
  } else {
    const originalArray = crudOperations.crud_operations;
    const decodedArray = decoded.crud_operations;
    if (originalArray.length !== decodedArray.length) {
      console.error(`  ✗ Length mismatch (original: ${originalArray.length}, decoded: ${decodedArray.length})`);
      allPassed = false;
    } else {
      const originalStr = JSON.stringify(originalArray);
      const decodedStr = JSON.stringify(decodedArray);
      if (originalStr === decodedStr) {
        console.log('  ✓ crud_operations: Round-trip successful (lossless)');
      } else {
        console.error('  ✗ crud_operations: Round-trip data mismatch');
        allPassed = false;
      }
    }
  }
} catch (error) {
  console.error(`  ✗ Round-trip failed: ${error.message}`);
  allPassed = false;
}
console.log();

// Test 3: Verify token savings
console.log('Test 3: Verify token savings metadata');
const sizeComparison = crudOperations.toon.size_comparison;
if (sizeComparison) {
  console.log('  ✓ Token savings metadata present');
  console.log(`    Total savings: ${sizeComparison.saved_tokens} tokens (${sizeComparison.saved_percent})`);
} else {
  console.error('  ✗ Token savings metadata missing');
  allPassed = false;
}
console.log();

// Test 4: Verify version
console.log('Test 4: Verify metadata version');
if (crudOperations.metadata.version === '3.1.0') {
  console.log('  ✓ Metadata version bumped to 3.1.0');
} else {
  console.error(`  ✗ Metadata version is ${crudOperations.metadata.version}, expected 3.1.0`);
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
