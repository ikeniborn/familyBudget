#!/usr/bin/env node

/**
 * Test TOON hybrid output for doc-explorer config files
 *
 * Validates TOON strings and round-trip conversion.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Import TOON utilities from _shared
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const toonUtilsPath = resolve(__dirname, '../../_shared/toon-utils.mjs');
const { toonToJson, validateToon } = await import(toonUtilsPath);

// Test features.json
console.log('Testing TOON hybrid output for features.json...\n');
const featuresPath = resolve(__dirname, 'features.json');
const features = JSON.parse(readFileSync(featuresPath, 'utf8'));

let allPassed = true;

// Test 1: Validate TOON string for features
console.log('Test 1: Validate features_toon string');
const featuresToon = features.toon.features_toon;
const featuresValidation = validateToon(featuresToon);
if (featuresValidation.valid) {
  console.log('  ✓ features_toon is valid TOON');
} else {
  console.error(`  ✗ features_toon is INVALID: ${featuresValidation.error}`);
  allPassed = false;
}
console.log();

// Test 2: Round-trip features TOON string
console.log('Test 2: Round-trip features_toon string');
try {
  const decoded = toonToJson(featuresToon);
  if (!decoded.features) {
    throw new Error('Decoded object missing "features" key');
  }
  if (decoded.features.length !== features.features.length) {
    throw new Error(`Expected ${features.features.length} features, got ${decoded.features.length}`);
  }
  console.log('  ✓ Round-trip successful');
  console.log(`  ✓ Decoded ${decoded.features.length} features`);
} catch (error) {
  console.error(`  ✗ Round-trip FAILED: ${error.message}`);
  allPassed = false;
}
console.log();

// Test 3: Token savings calculation
console.log('Test 3: Token savings calculation');
const expectedMinSavings = 50; // At least 50% savings expected
const actualSavings = parseFloat(features.toon.token_savings);
if (actualSavings >= expectedMinSavings) {
  console.log(`  ✓ Token savings: ${features.toon.token_savings} (>= ${expectedMinSavings}%)`);
} else {
  console.error(`  ✗ Token savings too low: ${features.toon.token_savings} (expected >= ${expectedMinSavings}%)`);
  allPassed = false;
}
console.log();

// Test quiz-questions.json
console.log('\nTesting TOON hybrid output for quiz-questions.json...\n');
const quizPath = resolve(__dirname, 'quiz-questions.json');
const quiz = JSON.parse(readFileSync(quizPath, 'utf8'));

// Test 4: Validate TOON string for questions
console.log('Test 4: Validate questions_toon string');
const questionsToon = quiz.toon.questions_toon;
const questionsValidation = validateToon(questionsToon);
if (questionsValidation.valid) {
  console.log('  ✓ questions_toon is valid TOON');
} else {
  console.error(`  ✗ questions_toon is INVALID: ${questionsValidation.error}`);
  allPassed = false;
}
console.log();

// Test 5: Round-trip questions TOON string
console.log('Test 5: Round-trip questions_toon string');
try {
  const decoded = toonToJson(questionsToon);
  if (!decoded.questions) {
    throw new Error('Decoded object missing "questions" key');
  }
  if (decoded.questions.length !== quiz.questions.length) {
    throw new Error(`Expected ${quiz.questions.length} questions, got ${decoded.questions.length}`);
  }
  console.log('  ✓ Round-trip successful');
  console.log(`  ✓ Decoded ${decoded.questions.length} questions`);
} catch (error) {
  console.error(`  ✗ Round-trip FAILED: ${error.message}`);
  allPassed = false;
}
console.log();

// Summary
console.log('\n=== Summary ===');
if (allPassed) {
  console.log('✓ All tests passed!');
  console.log(`Total token savings: ${features.toon.saved_tokens + quiz.toon.saved_tokens} tokens`);
  console.log(`Average savings: ${((parseFloat(features.toon.token_savings) + parseFloat(quiz.toon.token_savings)) / 2).toFixed(1)}%`);
  process.exit(0);
} else {
  console.error('✗ Some tests failed');
  process.exit(1);
}
