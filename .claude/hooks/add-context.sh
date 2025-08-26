#!/usr/bin/env bash

# Hook script implementing Schema-Guided Reasoning (SGR) pattern
# This script adds structured reasoning schema to guide Claude through predefined steps
# Based on: https://abdullin.com/schema-guided-reasoning/

# Get the project directory (Claude Code sets $CLAUDE_PROJECT_DIR)
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
REQUESTS_DIR="${PROJECT_DIR}/requests"

# Create requests directory if it doesn't exist
mkdir -p "$REQUESTS_DIR"

# Read the original user prompt from stdin (it's a JSON object)
JSON_INPUT=$(cat)

# Parse JSON to extract session_id and prompt using jq (if available) or sed
if command -v jq &> /dev/null; then
    SESSION_ID=$(echo "$JSON_INPUT" | jq -r '.session_id // "N/A"')
    USER_PROMPT=$(echo "$JSON_INPUT" | jq -r '.prompt // ""')
else
    # Fallback to sed if jq is not available
    SESSION_ID=$(echo "$JSON_INPUT" | sed -n 's/.*"session_id":"\([^"]*\)".*/\1/p')
    USER_PROMPT=$(echo "$JSON_INPUT" | sed -n 's/.*"prompt":"\([^"]*\)".*/\1/p')
    [ -z "$SESSION_ID" ] && SESSION_ID="N/A"
fi

# Generate unique filename with timestamp
TIMESTAMP=$(date +"%Y%m%d%H%M%S")
LOG_FILE="${REQUESTS_DIR}/${TIMESTAMP}_request.md"

# Create the SGR-enhanced prompt with structured reasoning schema
ENHANCED_PROMPT="
# 🎯 Context Definition
---
role: Ты профессиональный разработчик фронтенд и бэкенд занимающийся разработкой приложения для домашнего учета и списка продуктов.
domain_expertise:
  - Modern web development (SvelteKit, TypeScript)
  - Database design and optimization (PostgreSQL, FastApi)
  - Docker containerization and microservices
  - Testing strategies and CI/CD pipelines
  - User experience and interface design
operational_rules:
  - Используй субагента sgr-orchestrator для обработки запроса пользователя
  - Всегда проверяй существующий код перед изменениями
  - Следуй архитектурным паттернам проекта
  - Поддерживай консистентность кодовой базы
  - Документируй важные решения
---
"

# Save the request to log file with SGR tracking
cat > "$LOG_FILE" << EOF
# SGR Request Log - ${TIMESTAMP}

## Metadata
- Timestamp: $(date +"%Y-%m-%d %H:%M:%S")
- Session ID: ${SESSION_ID}
- Project: ${PROJECT_DIR}

## Original User Prompt
${USER_PROMPT}
${ENHANCED_PROMPT}
EOF

# Output the enhanced prompt for Claude Code
echo "$ENHANCED_PROMPT"