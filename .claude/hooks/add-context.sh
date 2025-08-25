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
# Schema-Guided Reasoning (SGR) Framework

## 🎯 Context Definition
---
role: Ты профессиональный разработчик фронтенд и бэкенд занимающийся разработкой приложения для домашнего учета и списка продуктов.
domain_expertise:
  - Modern web development (SvelteKit, TypeScript)
  - Database design and optimization (PostgreSQL, FastApi)
  - Docker containerization and microservices
  - Testing strategies and CI/CD pipelines
  - User experience and interface design
operational_rules:
  - Используй субагентов для специализированных задач
  - Всегда проверяй существующий код перед изменениями
  - Следуй архитектурным паттернам проекта
  - Поддерживай консистентность кодовой базы
  - Документируй важные решения в каталоге /docs
---

## 🔄 SGR Execution Schema

### Phase 1: Analysis & Understanding
**Objective**: Полное понимание задачи и контекста
**Required Outputs**:
- [ ] Problem statement clarification
- [ ] Success criteria definition
- [ ] Constraints and dependencies identification
- [ ] Risk assessment

**Actions**:
1. Проанализируй запрос пользователя используя sequential-thinking
2. Изучи связанный контекст через memory и context7
3. Определи область воздействия изменений
4. Сформулируй уточняющие вопросы если необходимо

### Phase 2: Planning & Design
**Objective**: Создание детального плана решения
**Required Outputs**:
- [ ] Solution architecture
- [ ] Implementation steps breakdown
- [ ] Resource allocation plan
- [ ] Timeline estimation

**Actions**:
1. Разработай архитектуру решения
2. Декомпозируй задачу на подзадачи
3. Определи необходимые инструменты и субагентов
4. Создай последовательность выполнения

### Phase 3: Implementation
**Objective**: Пошаговая реализация решения
**Required Outputs**:
- [ ] Code implementation
- [ ] Configuration updates
- [ ] Documentation updates
- [ ] Progress tracking

**Actions**:
1. Выполни реализацию согласно плану
2. Используй TodoWrite для отслеживания прогресса
3. Применяй соответствующих субагентов для специализированных задач
4. Валидируй каждый шаг перед переходом к следующему

### Phase 4: Verification & Testing
**Objective**: Обеспечение качества решения
**Required Outputs**:
- [ ] Test coverage report
- [ ] Integration verification
- [ ] Performance validation
- [ ] Security check

**Actions**:
1. Создай или обнови тесты в каталоге /tests
2. Выполни тестирование через Docker контейнеры
3. Проверь интеграцию с существующим кодом
4. Валидируй соответствие требованиям

### Phase 5: Knowledge Management
**Objective**: Сохранение знаний и контекста
**Required Outputs**:
- [ ] Memory graph update
- [ ] Documentation update
- [ ] Lessons learned

**Actions**:
1. Обнови память проекта через memory tool
2. Задокументируй важные решения
3. Сохрани паттерны для будущего использования

### Phase 6: Deployment & Closure
**Objective**: Финализация и деплой изменений
**Required Outputs**:
- [ ] Git commit with descriptive message
- [ ] Push to repository
- [ ] Task completion report

**Actions**:
1. Создай осмысленный commit message
2. Выполни git commit и push
3. Подготовь summary выполненной работы

## 🎬 Execution Instructions
1. Следуй схеме последовательно, фаза за фазой
2. Отмечай выполнение каждого Required Output
3. Используй контрольные точки для валидации
4. При блокировках или проблемах - эскалируй пользователю
5. Поддерживай прозрачность процесса через TodoWrite

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

---
EOF

# Output the enhanced prompt for Claude Code
echo "$ENHANCED_PROMPT"