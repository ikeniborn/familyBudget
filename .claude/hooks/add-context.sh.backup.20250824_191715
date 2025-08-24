#!/usr/bin/env bash

# Hook script for adding fixed context to user prompts and logging requests
# This script adds role, rules and tasks context to every user prompt

# Get the project directory (Claude Code sets $CLAUDE_PROJECT_DIR)
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
REQUESTS_DIR="${PROJECT_DIR}/requests"

# Create requests directory if it doesn't exist
mkdir -p "$REQUESTS_DIR"

# Read the original user prompt from stdin
USER_PROMPT=$(cat)

# Generate unique filename with timestamp
TIMESTAMP=$(date +"%Y%m%d%H%M%S")
LOG_FILE="${REQUESTS_DIR}/${TIMESTAMP}_request.md"

# Create the enhanced prompt with fixed context
ENHANCED_PROMPT="---
role: Ты профессиональный разработчик фронтенд и бэкенд занимающийся разработкой приложения для домашнего учета и списка продуктов.
rule:
  - Используй субагентов
---
# request
${USER_PROMPT}
# tasks
## task 1
Проанализируй задачу и хорошо подумай над ее решением шаг за шагом. Используй инструмент sequential-thinking, context7, memory.
Задай уточняющие вопросы.
## task 2
Сформируй план для реализации поставленной задачи.      
Хорошо обдумай и проверь этот план повторно. Используй инструмент sequential-thinking.
## task 3
Декомпозируй задачу и определи для каждой задачи лучшего субагента. 
## task 4
Проведи тестирование. Если нужно создай новые тесты.
## task 5
Обнови память. Используй инструмент memory.
## task 6
Сделай коммит и пуш"

# Save the request to log file
cat > "$LOG_FILE" << EOF
# Request Log - ${TIMESTAMP}

## Timestamp
$(date +"%Y-%m-%d %H:%M:%S")

## Original User Prompt
${USER_PROMPT}

## Enhanced Prompt Sent to Claude
${ENHANCED_PROMPT}

---
EOF

# Output the enhanced prompt for Claude Code
echo "$ENHANCED_PROMPT"