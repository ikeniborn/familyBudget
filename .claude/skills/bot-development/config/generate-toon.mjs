#!/usr/bin/env node

/**
 * Generate TOON metadata for conversation-states.json
 *
 * Reads conversation-states.json, generates TOON representation,
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

const conversationStatesPath = resolve(__dirname, 'conversation-states.json');

// Read current conversation-states.json
const conversationStatesContent = readFileSync(conversationStatesPath, 'utf8');
const conversationStates = JSON.parse(conversationStatesContent);

// Generate TOON for conversation_states array
const conversationStatesToon = arrayToToon(
  'conversation_states',
  conversationStates.conversation_states,
  ['name', 'order', 'prompt', 'handler_type', 'validation', 'next_state', 'description']
);

// Calculate token savings
const stats = calculateTokenSavings({ conversation_states: conversationStates.conversation_states });

// Add TOON metadata section
conversationStates.toon = {
  conversation_states_toon: conversationStatesToon,
  token_savings: stats.savedPercent,
  size_comparison: {
    json_tokens: stats.jsonTokens,
    toon_tokens: stats.toonTokens,
    saved_tokens: stats.savedTokens,
    saved_percent: stats.savedPercent
  }
};

// Update metadata version
conversationStates.metadata.version = '2.1.0';
conversationStates.metadata.last_updated = new Date().toISOString().split('T')[0];
conversationStates.metadata.description = 'Conversation states for Telegram bot ConversationHandler with TOON optimization';

// Write updated JSON
writeFileSync(conversationStatesPath, JSON.stringify(conversationStates, null, 2) + '\n', 'utf8');

console.log('✓ Generated TOON metadata for conversation-states.json');
console.log(`  Total savings: ${stats.savedTokens} tokens (${stats.savedPercent})`);
console.log(`  JSON: ${stats.jsonTokens} tokens (${stats.jsonSize} bytes)`);
console.log(`  TOON: ${stats.toonTokens} tokens (${stats.toonSize} bytes)`);
