#!/usr/bin/env node

/**
 * Generate TOON metadata for doc-explorer config files
 *
 * Reads features.json and quiz-questions.json, generates TOON representations,
 * calculates token savings, and outputs hybrid JSON+TOON format.
 *
 * Usage: node generate-toon.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Import TOON utilities from _shared
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const toonUtilsPath = resolve(__dirname, '../../_shared/toon-utils.mjs');
const { arrayToToon, calculateTokenSavings } = await import(toonUtilsPath);

// Process features.json
console.log('Processing features.json...');
const featuresPath = resolve(__dirname, 'features.json');
const featuresContent = readFileSync(featuresPath, 'utf8');
const features = JSON.parse(featuresContent);

// Generate TOON for features array
const featuresToon = arrayToToon(
  'features',
  features.features,
  ['id', 'name', 'category', 'difficulty', 'duration_min', 'description', 'key_concepts', 'docs', 'code_examples', 'quiz_questions']
);

// Calculate token savings for features
const featuresStats = calculateTokenSavings({ features: features.features });

// Add TOON metadata section to features.json
features.toon = {
  features_toon: featuresToon,
  token_savings: featuresStats.savedPercent,
  json_tokens: featuresStats.jsonTokens,
  toon_tokens: featuresStats.toonTokens,
  saved_tokens: featuresStats.savedTokens
};

// Update metadata version for features.json
features.metadata = features.metadata || {};
features.metadata.version = '1.1.0';
features.metadata.last_updated = new Date().toISOString().split('T')[0];
features.metadata.description = 'Features catalog for doc-explorer with TOON optimization';

// Write updated features.json
writeFileSync(featuresPath, JSON.stringify(features, null, 2) + '\n', 'utf8');

console.log('✓ Generated TOON metadata for features.json');
console.log(`  Total savings: ${featuresStats.savedTokens} tokens (${featuresStats.savedPercent})`);
console.log(`  JSON: ${featuresStats.jsonTokens} tokens (${featuresStats.jsonSize} bytes)`);
console.log(`  TOON: ${featuresStats.toonTokens} tokens (${featuresStats.toonSize} bytes)`);

// Process quiz-questions.json
console.log('\nProcessing quiz-questions.json...');
const quizPath = resolve(__dirname, 'quiz-questions.json');
const quizContent = readFileSync(quizPath, 'utf8');
const quiz = JSON.parse(quizContent);

// Generate TOON for questions array
const questionsToon = arrayToToon(
  'questions',
  quiz.questions,
  ['id', 'feature', 'type', 'difficulty', 'question', 'options', 'correct_answer', 'explanation', 'reference']
);

// Calculate token savings for questions
const questionsStats = calculateTokenSavings({ questions: quiz.questions });

// Add TOON metadata section to quiz-questions.json
quiz.toon = {
  questions_toon: questionsToon,
  token_savings: questionsStats.savedPercent,
  json_tokens: questionsStats.jsonTokens,
  toon_tokens: questionsStats.toonTokens,
  saved_tokens: questionsStats.savedTokens
};

// Update metadata version for quiz-questions.json
quiz.metadata = quiz.metadata || {};
quiz.metadata.version = '1.1.0';
quiz.metadata.last_updated = new Date().toISOString().split('T')[0];
quiz.metadata.description = 'Quiz questions bank for doc-explorer with TOON optimization';

// Write updated quiz-questions.json
writeFileSync(quizPath, JSON.stringify(quiz, null, 2) + '\n', 'utf8');

console.log('✓ Generated TOON metadata for quiz-questions.json');
console.log(`  Total savings: ${questionsStats.savedTokens} tokens (${questionsStats.savedPercent})`);
console.log(`  JSON: ${questionsStats.jsonTokens} tokens (${questionsStats.jsonSize} bytes)`);
console.log(`  TOON: ${questionsStats.toonTokens} tokens (${questionsStats.toonSize} bytes)`);

// Summary
console.log('\n=== Summary ===');
console.log(`Total token savings: ${featuresStats.savedTokens + questionsStats.savedTokens} tokens`);
console.log(`Average savings: ${((featuresStats.savedPercent + questionsStats.savedPercent) / 2).toFixed(1)}%`);
