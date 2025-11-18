# Task Planning Template v2.0 (Structured Output)

## Назначение
Этот шаблон используется ТОЛЬКО для создания детального плана задачи.
Выполнение фаз НЕ происходит - только анализ, декомпозиция и сохранение плана.

## Конфигурация
- Режим: планирование (БЕЗ выполнения)
- Thinking: enabled, mode=interleaved (обязателен для reasoning)
- Structured Output: enabled (для validation и enforcement)
- Валидация: PRD compliance, acceptance criteria
- Результат: Master Plan + Phase Files в `plans/`

## Принципы
1. **PRD Compliance** - все решения ДОЛЖНЫ соответствовать PRD из `docs/prd`
2. **Acceptance Criteria** - план ДОЛЖЕН покрывать все критерии
3. **Декомпозиция на фазы** - задача ДОЛЖНА быть разбита на логические фазы (2-5)
4. **Structured Validation** - ключевые шаги используют JSON Schema для enforcement
5. **Plan Persistence** - каждая фаза ДОЛЖНА быть сохранена в `plans/`
6. **Остановка после планирования** - НЕ выполнять фазы, только создать план

---

## Задачи

[Описание задачи от пользователя]

---

## Процесс

### PHASE 0: АНАЛИЗ И ПЛАНИРОВАНИЕ

---

#### **Шаг 1. [THINKING - ОБЯЗАТЕЛЬНО] Загрузить и изучить PRD**

```xml
<thinking>
ЗАДАЧА: [краткое описание задачи от пользователя]
PRD СЕКЦИИ: [какие секции релевантны]
ACCEPTANCE CRITERIA: [идентифицировать из задачи]
ALIGNMENT: [проверить соответствие задачи PRD]
</thinking>
```

**Действия:**
- Прочитать `docs/prd` релевантные секции
- Проверить alignment задачи с PRD
- Идентифицировать acceptance criteria

**Exit Condition:**
- ✓ PRD прочитан
- ✓ Acceptance criteria идентифицированы
- ✓ Alignment подтвержден ИЛИ конфликт зафиксирован

**Violation Action:** STOP, спросить пользователя при конфликте с PRD

---

#### **Шаг 2. [THINKING - ОБЯЗАТЕЛЬНО] Проанализировать текущее состояние**

```xml
<thinking>
КОНТЕКСТ: [текущее состояние кодовой базы]
ROOT CAUSES: [что нужно изменить]
КОМПОНЕНТЫ: [какие файлы/модули затронуты]
СЛОЖНОСТЬ: [оценка объема работы]
ЗАВИСИМОСТИ: [внешние зависимости, если есть]
</thinking>
```

**Действия:**
- Определить root causes проблемы
- Идентифицировать компоненты для изменения
- Оценить сложность и объем работы
- Найти зависимости между компонентами

**Exit Condition:**
- ✓ Root causes определены
- ✓ Компоненты идентифицированы
- ✓ Сложность оценена

---

#### **Шаг 3. ЗАДАТЬ УТОЧНЯЮЩИЕ ВОПРОСЫ (если требуется)**

**Когда спрашивать:**
- При неясности требований → СТОП и спросить
- При конфликте с PRD → СТОП и спросить
- При отсутствии критичной информации → СТОП и спросить

**Формат вопроса:**
```
❓ ТРЕБУЕТСЯ УТОЧНЕНИЕ
Неясно: [что конкретно]
Варианты: [опции]
Вопрос: [конкретный вопрос]
```

---

#### **Шаг 4. [THINKING + STRUCTURED OUTPUT] Декомпозиция на логические фазы**

**Validation:** `critical`
**Blocking:** `true`
**Output:** `required`

**Часть 4A: THINKING - Reasoning**

```xml
<thinking>
ДЕКОМПОЗИЦИЯ:
Цель: Разбить задачу на 2-5 логических фаз

Анализ задачи:
- Какие логические блоки работы можно выделить?
- Какие компоненты независимы?
- Где естественные границы для коммитов?

Критерии фазы:
- Четкая цель (понятна из названия)
- 3-7 важных шагов (НЕ мелко!)
- Логическая завершенность (можно сделать коммит)
- Независимость (минимум зависимостей от других фаз)

Предлагаемые фазы:
1. Phase 1: Git Setup + [первая логическая часть]
   - Обоснование: [почему это первая фаза]
   - Компоненты: [список]

2. Phase 2: [вторая логическая часть]
   - Обоснование: [почему отдельная фаза]
   - Компоненты: [список]

...

N. Phase N: [последняя логическая часть]
   - Обоснование: [почему отдельная фаза]
   - Компоненты: [список]

ВАЛИДАЦИЯ:
- Все acceptance criteria покрыты? [да/нет + обоснование]
- Фазы логически завершены? [да/нет + обоснование]
- Зависимости минимальны? [да/нет + обоснование]
- Количество фаз адекватно? (2-5) [да/нет + обоснование]
</thinking>
```

**Часть 4B: STRUCTURED OUTPUT - Validation**

**ОБЯЗАТЕЛЬНО вывести JSON соответствующий schema:**

```json
{
  "task_decomposition": {
    "task_name": "string - краткое название задачи",
    "prd_sections": ["FR-XXX", "NFR-YYY"],
    "base_branch": "master",
    "feature_branch": "feature/task-name",
    "total_phases": 3,

    "phases": [
      {
        "phase_number": 1,
        "name": "Git Setup + Component A",
        "goal": "Создать ветку и реализовать компонент A",
        "affected_files": [
          "backend/app/services/service_a.py",
          "backend/app/schemas/schema_a.py"
        ],
        "steps": [
          {
            "step_number": 1,
            "step_name": "Создать git ветку",
            "actions": [
              "git checkout -b feature/task-name",
              "git push -u origin feature/task-name"
            ],
            "expected_result": "Ветка создана и запушена"
          },
          {
            "step_number": 2,
            "step_name": "Создать service",
            "actions": [
              "Создать backend/app/services/service_a.py",
              "Реализовать основные методы"
            ],
            "expected_result": "Service создан с базовой логикой"
          }
          // ... минимум 3, максимум 7 шагов
        ],
        "completion_criteria": [
          "Service создан и протестирован",
          "Syntax check passed",
          "Git commit сделан"
        ],
        "commit_type": "feat",
        "commit_summary": "add service A with basic logic",
        "estimated_time": "30-45 min",
        "risks": [
          {
            "risk": "Конфликт с существующим сервисом",
            "mitigation": "Проверить namespace перед созданием"
          }
        ]
      }
      // ... всего 2-5 фаз
    ],

    "acceptance_criteria_mapping": [
      {
        "criterion": "AC1: Service должен обрабатывать запросы",
        "mapped_to_phases": [1, 2]
      },
      {
        "criterion": "AC2: API endpoint должен возвращать корректный JSON",
        "mapped_to_phases": [2]
      }
    ],

    "global_risks": [
      {
        "risk": "Изменения могут сломать существующие тесты",
        "mitigation": "Запустить полный test suite после каждой фазы"
      }
    ],

    "validation": {
      "all_acceptance_criteria_covered": true,
      "phases_logically_complete": true,
      "dependencies_minimal": true,
      "phase_count_adequate": true
    }
  }
}
```

**JSON Schema для validation:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "task_decomposition": {
      "type": "object",
      "properties": {
        "task_name": {"type": "string", "minLength": 5, "maxLength": 100},
        "prd_sections": {
          "type": "array",
          "minItems": 1,
          "items": {"type": "string"}
        },
        "base_branch": {"type": "string"},
        "feature_branch": {"type": "string", "pattern": "^feature/"},
        "total_phases": {"type": "integer", "minimum": 2, "maximum": 5},

        "phases": {
          "type": "array",
          "minItems": 2,
          "maxItems": 5,
          "items": {
            "type": "object",
            "properties": {
              "phase_number": {"type": "integer", "minimum": 1},
              "name": {"type": "string", "minLength": 10, "maxLength": 80},
              "goal": {"type": "string", "minLength": 20},
              "affected_files": {
                "type": "array",
                "minItems": 1,
                "items": {"type": "string"}
              },
              "steps": {
                "type": "array",
                "minItems": 3,
                "maxItems": 7,
                "items": {
                  "type": "object",
                  "properties": {
                    "step_number": {"type": "integer"},
                    "step_name": {"type": "string"},
                    "actions": {
                      "type": "array",
                      "minItems": 1,
                      "items": {"type": "string"}
                    },
                    "expected_result": {"type": "string"}
                  },
                  "required": ["step_number", "step_name", "actions", "expected_result"]
                }
              },
              "completion_criteria": {
                "type": "array",
                "minItems": 2,
                "items": {"type": "string"}
              },
              "commit_type": {
                "type": "string",
                "enum": ["feat", "fix", "refactor", "docs", "chore", "test", "perf"]
              },
              "commit_summary": {"type": "string", "maxLength": 72},
              "estimated_time": {"type": "string"},
              "risks": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "risk": {"type": "string"},
                    "mitigation": {"type": "string"}
                  },
                  "required": ["risk", "mitigation"]
                }
              }
            },
            "required": [
              "phase_number", "name", "goal", "affected_files",
              "steps", "completion_criteria", "commit_type", "commit_summary"
            ]
          }
        },

        "acceptance_criteria_mapping": {
          "type": "array",
          "minItems": 1,
          "items": {
            "type": "object",
            "properties": {
              "criterion": {"type": "string"},
              "mapped_to_phases": {
                "type": "array",
                "minItems": 1,
                "items": {"type": "integer"}
              }
            },
            "required": ["criterion", "mapped_to_phases"]
          }
        },

        "global_risks": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "risk": {"type": "string"},
              "mitigation": {"type": "string"}
            },
            "required": ["risk", "mitigation"]
          }
        },

        "validation": {
          "type": "object",
          "properties": {
            "all_acceptance_criteria_covered": {"type": "boolean"},
            "phases_logically_complete": {"type": "boolean"},
            "dependencies_minimal": {"type": "boolean"},
            "phase_count_adequate": {"type": "boolean"}
          },
          "required": [
            "all_acceptance_criteria_covered",
            "phases_logically_complete",
            "dependencies_minimal",
            "phase_count_adequate"
          ]
        }
      },
      "required": [
        "task_name", "prd_sections", "total_phases", "phases",
        "acceptance_criteria_mapping", "validation"
      ]
    }
  },
  "required": ["task_decomposition"]
}
```

**Exit Conditions:**
- ✓ Thinking выполнен (reasoning задокументирован)
- ✓ JSON Schema validation PASSED
- ✓ 2-5 фаз (enforced by schema)
- ✓ Каждая фаза: 3-7 шагов (enforced by schema)
- ✓ Все обязательные поля заполнены (enforced by schema)
- ✓ validation.* все = true

**Violation Action:**
- JSON Schema error → STOP, исправить структуру, RETRY
- validation.* = false → STOP, пересмотреть декомпозицию

---

#### **Шаг 5. [AUTOMATIC] Формирование детального плана**

**Описание:** Этот шаг автоматический - использует validated JSON из Шага 4.

**Действия:**
- Взять `task_decomposition` JSON из Шага 4
- Подготовить данные для генерации файлов
- Валидировать полноту данных

**Exit Condition:**
- ✓ JSON из Шага 4 доступен
- ✓ Данные готовы для генерации файлов

---

#### **Шаг 6. [BLOCKING - CRITICAL] Сохранение плана в files**

**Validation:** `critical`
**Blocking:** `true`
**Output:** `required`

**Действия:**

1. **Создать директорию:**
```bash
mkdir -p plans/
```

2. **Сгенерировать Master Plan:**
   - Файл: `plans/master-plan.md`
   - Источник: JSON из Шага 4
   - Формат: см. раздел "Формат Master Plan" ниже

3. **Сгенерировать Phase Files:**
   - Для каждой фазы в `task_decomposition.phases[]`
   - Файл: `plans/phase-{number}-{slug}.md`
   - Источник: `task_decomposition.phases[N]`
   - Формат: см. раздел "Формат Phase File" ниже

**Правила генерации slug:**
- Взять `phase.name`, убрать "Phase N: "
- Lowercase, заменить пробелы на дефисы
- Удалить спецсимволы
- Пример: "Git Setup + Component A" → "git-setup-component-a"

**Mandatory Output:**

ОБЯЗАТЕЛЬНО вывести:
```
📁 ФАЙЛЫ ПЛАНА СОЗДАНЫ
════════════════════════════════════════

✓ plans/master-plan.md (123 строк)
✓ plans/phase-1-git-setup-component-a.md (87 строк)
✓ plans/phase-2-api-endpoints.md (95 строк)
✓ plans/phase-3-frontend-integration.md (78 строк)

ВСЕГО: 4 файла, 383 строки

ВАЛИДАЦИЯ: ✓ PASSED
```

**Exit Conditions:**
- ✓ Директория `plans/` создана
- ✓ `plans/master-plan.md` создан
- ✓ ВСЕ `plans/phase-{N}-{slug}.md` созданы (N файлов по количеству фаз)
- ✓ Каждый файл соответствует формату
- ✓ Mandatory output выведен

**Validation:**
- CRITICAL - проверить существование каждого файла
- CRITICAL - проверить количество файлов = total_phases + 1

**Violation Action:**
- FILE_CREATE_FAIL → STOP, показать ошибку, RETRY
- FORMAT_ERROR → STOP, исправить формат, RETRY
- Нельзя продолжить без ВСЕ файлов

---

#### **Шаг 7. [MANDATORY OUTPUT + STRUCTURED] Вывод плана для согласования**

**Output:** `required`
**Blocking:** `true`

**Часть 7A: STRUCTURED OUTPUT - Validation**

ОБЯЗАТЕЛЬНО вывести JSON:

```json
{
  "plan_summary": {
    "task_name": "string - название задачи",
    "prd_sections": ["FR-XXX"],
    "branch": "feature/task-name",
    "total_phases": 3,

    "phases_summary": [
      {
        "number": 1,
        "name": "Git Setup + Component A",
        "goal": "Создать ветку и реализовать компонент A",
        "files_count": 5,
        "steps_count": 5,
        "estimated_time": "30-45 min",
        "commit_message": "feat: add service A with basic logic"
      }
      // ... для всех фаз
    ],

    "acceptance_criteria_status": [
      {
        "criterion": "AC1: Service должен обрабатывать запросы",
        "covered": true,
        "phases": [1, 2]
      }
    ],

    "risks_summary": {
      "phase_specific": 3,
      "global": 2,
      "high_priority": ["Изменения могут сломать существующие тесты"]
    },

    "plan_files": [
      "plans/master-plan.md",
      "plans/phase-1-git-setup-component-a.md",
      "plans/phase-2-api-endpoints.md",
      "plans/phase-3-frontend-integration.md"
    ]
  }
}
```

**Часть 7B: GENERATE MARKDOWN - User Display**

ОБЯЗАТЕЛЬНО вывести Markdown (генерировать из JSON выше):

```
═══════════════════════════════════════════════════════════
                    MASTER PLAN
═══════════════════════════════════════════════════════════

📋 ЗАДАЧА: {task_name}
📖 PRD: ✓ {prd_sections joined}
🌿 ВЕТКА: {branch}
📊 ФАЗЫ: {total_phases} фазы

───────────────────────────────────────────────────────────

Phase 1: {phases_summary[0].name}
  🎯 Цель: {goal}
  📝 Файлы: {files_count} файлов
  📌 Шаги: {steps_count} шагов
  ⏱️ Время: ~{estimated_time}
  💾 Коммит: {commit_message}

Phase 2: {phases_summary[1].name}
  🎯 Цель: {goal}
  📝 Файлы: {files_count} файлов
  📌 Шаги: {steps_count} шагов
  ⏱️ Время: ~{estimated_time}
  💾 Коммит: {commit_message}

[... для всех фаз]

───────────────────────────────────────────────────────────

✅ ACCEPTANCE CRITERIA MAPPING:

{для каждого acceptance_criteria_status}
✓ {criterion}
  → Покрыто в фазах: {phases joined}

───────────────────────────────────────────────────────────

⚠️ РИСКИ:

Приоритетные:
{для каждого high_priority risk}
- {risk}

Всего рисков: {phase_specific} по фазам + {global} глобальных

───────────────────────────────────────────────────────────

📁 ФАЙЛЫ ПЛАНА:

{для каждого plan_file}
✓ {file}

═══════════════════════════════════════════════════════════
```

**Exit Conditions:**
- ✓ JSON summary сгенерирован и выведен
- ✓ Markdown план сгенерирован и показан
- ✓ ВСЕ секции заполнены (ФАЗЫ, MAPPING, РИСКИ, ФАЙЛЫ)

**Violation Action:**
- BLOCKING - нельзя перейти к Checkpoint без вывода

---

#### **CHECKPOINT: [MANDATORY OUTPUT + STRUCTURED]**

**Blocking:** `true`
**Output:** `required`
**Validation:** `critical`

**Часть A: STRUCTURED OUTPUT - Validation**

ОБЯЗАТЕЛЬНО вывести JSON:

```json
{
  "checkpoint": {
    "phase_number": 0,
    "phase_name": "АНАЛИЗ И ПЛАНИРОВАНИЕ",

    "checks": [
      {
        "check_id": 1,
        "check_name": "PRD секции изучены",
        "status": "passed",
        "details": "Изучены секции: FR-015, NFR-003"
      },
      {
        "check_id": 2,
        "check_name": "Задача декомпозирована на N фаз",
        "status": "passed",
        "details": "Создано 3 фазы (в пределах 2-5)"
      },
      {
        "check_id": 3,
        "check_name": "Master Plan создан",
        "status": "passed",
        "details": "plans/master-plan.md (123 строк)"
      },
      {
        "check_id": 4,
        "check_name": "Phase Files созданы",
        "status": "passed",
        "details": "3 файла: phase-1, phase-2, phase-3"
      },
      {
        "check_id": 5,
        "check_name": "Acceptance Criteria замапированы",
        "status": "passed",
        "details": "2 критерия покрыты фазами 1-3"
      },
      {
        "check_id": 6,
        "check_name": "Риски идентифицированы",
        "status": "passed",
        "details": "5 рисков (3 по фазам + 2 глобальных)"
      },
      {
        "check_id": 7,
        "check_name": "План показан пользователю",
        "status": "passed",
        "details": "Markdown summary выведен"
      }
    ],

    "overall_result": "PASSED",
    "can_proceed_to_phase_1": true,
    "blocking_issues": []
  }
}
```

**JSON Schema для validation:**
```json
{
  "type": "object",
  "properties": {
    "checkpoint": {
      "type": "object",
      "properties": {
        "phase_number": {"type": "integer"},
        "phase_name": {"type": "string"},
        "checks": {
          "type": "array",
          "minItems": 7,
          "maxItems": 7,
          "items": {
            "type": "object",
            "properties": {
              "check_id": {"type": "integer"},
              "check_name": {"type": "string"},
              "status": {
                "type": "string",
                "enum": ["passed", "failed"]
              },
              "details": {"type": "string"}
            },
            "required": ["check_id", "check_name", "status", "details"]
          }
        },
        "overall_result": {
          "type": "string",
          "enum": ["PASSED", "FAILED"]
        },
        "can_proceed_to_phase_1": {"type": "boolean"},
        "blocking_issues": {
          "type": "array",
          "items": {"type": "string"}
        }
      },
      "required": [
        "phase_number", "checks", "overall_result",
        "can_proceed_to_phase_1", "blocking_issues"
      ]
    }
  },
  "required": ["checkpoint"]
}
```

**Часть B: GENERATE MARKDOWN - Display**

ОБЯЗАТЕЛЬНО вывести:

```
═══════════════════════════════════════════════════════════
              PHASE 0 CHECKPOINT
═══════════════════════════════════════════════════════════

{для каждого check}
[{status ✓/✗}] {check_name}
    └─ {details}

───────────────────────────────────────────────────────────

РЕЗУЛЬТАТ: {overall_result}
Переход к Phase 1: {can_proceed_to_phase_1 ? "ALLOWED" : "BLOCKED"}

{если blocking_issues не пусто}
⚠️ БЛОКИРУЮЩИЕ ПРОБЛЕМЫ:
{для каждой issue}
- {issue}

═══════════════════════════════════════════════════════════
```

**Exit Conditions:**
- ✓ ВСЕ 7 checks выполнены (enforced by minItems: 7)
- ✓ overall_result = "PASSED" (если хотя бы один check.status = "failed" → FAILED)
- ✓ can_proceed_to_phase_1 = true
- ✓ blocking_issues = [] (пустой массив)
- ✓ JSON validation PASSED
- ✓ Markdown display выведен

**Validation Rules:**
```javascript
// Логика определения overall_result
if (checks.some(c => c.status === "failed")) {
  overall_result = "FAILED"
  can_proceed_to_phase_1 = false
  blocking_issues = checks.filter(c => c.status === "failed")
                          .map(c => c.check_name)
} else {
  overall_result = "PASSED"
  can_proceed_to_phase_1 = true
  blocking_issues = []
}
```

**Violation Action:**
- overall_result = "FAILED" → BLOCKING, НЕ переходить к Phase 1
- blocking_issues не пусто → STOP, исправить ошибки
- Schema validation error → STOP, исправить структуру

---

### PHASE 1: ЗАВЕРШЕНИЕ

**Entry Conditions:**
- ✓ Phase 0 checkpoint.overall_result = "PASSED" (ОБЯЗАТЕЛЬНО!)
- ✓ Phase 0 checkpoint.can_proceed_to_phase_1 = true (ОБЯЗАТЕЛЬНО!)
- ✓ Phase 0 checkpoint.blocking_issues = [] (ОБЯЗАТЕЛЬНО!)
- ✓ Все файлы плана существуют в `plans/`

**Проверка Entry Conditions:**

ПЕРЕД началом Phase 1 ОБЯЗАТЕЛЬНО:
1. Проверить checkpoint JSON из Phase 0
2. Если хотя бы одно условие НЕ выполнено → STOP, вернуться к Phase 0

**Violation Action:**
- Entry condition не выполнено → FATAL STOP
- НЕ выводить финальное сообщение
- НЕ завершать работу
- Сообщить пользователю о проблеме

---

**Финальное сообщение:**

```
═══════════════════════════════════════════════════════════
           ✅ ПЛАНИРОВАНИЕ ЗАВЕРШЕНО
═══════════════════════════════════════════════════════════

СТАТУС: ✓ COMPLETED

📁 СОЗДАННЫЕ ФАЙЛЫ:

{для каждого файла из plan_files}
✓ {file}

ВСЕГО: {количество} файлов

───────────────────────────────────────────────────────────

🚀 СЛЕДУЮЩИЙ ШАГ:

Для выполнения каждой фазы используйте:
task-execution-template.md

Команда для выполнения фазы 1:
"Выполни фазу: plans/phase-1-{slug}.md"

═══════════════════════════════════════════════════════════

🛑 РАБОТА ЗАВЕРШЕНА. Планы готовы к выполнению.

═══════════════════════════════════════════════════════════
```

**Exit Conditions:**
- ✓ Финальное сообщение выведено
- ✓ Работа ОСТАНОВЛЕНА (НЕ выполнять фазы!)
- ✓ НЕ переходить к выполнению фаз без явного запроса пользователя

---

## Форматы файлов планов

### Формат Master Plan (plans/master-plan.md)

**Генерировать из:** `task_decomposition` JSON

```markdown
# Master Plan: {task_name}

## Metadata
- **Дата создания:** {YYYY-MM-DD HH:MM}
- **PRD секции:** {prd_sections joined}
- **Ветка:** {feature_branch}
- **База:** {base_branch}

## Общий обзор

### Проблема
{извлечь из thinking шага 2: ROOT CAUSES}

### Решение
{извлечь из thinking шага 4: общий подход}

### Затронутые компоненты
{для каждой уникальной affected_files из всех фаз}
- {component} - {описание из шага 2}

## Декомпозиция на фазы

{для каждой phase в phases[]}
### Phase {phase_number}: {name}
**Цель:** {goal}
**Файлы:** {affected_files joined}
**Шаги:** {steps.length} шагов
**Время:** ~{estimated_time}
**Детали:** `plans/phase-{phase_number}-{slug}.md`

## Общие риски

{для каждого risk в global_risks}
- {risk} → {mitigation}

## Acceptance Criteria Mapping

{для каждого mapping в acceptance_criteria_mapping}
- [ ] {criterion} → Phase {mapped_to_phases joined}

## Общая валидация

После выполнения всех фаз проверить:
{сгенерировать на основе acceptance_criteria_mapping}
- Все acceptance criteria выполнены
- Все тесты проходят
- PRD требования соблюдены
```

---

### Формат Phase File (plans/phase-N-slug.md)

**Генерировать из:** `task_decomposition.phases[N]` JSON

```markdown
# Phase {phase_number}: {name}

## Цель
{goal}

## Контекст
- **Номер фазы:** {phase_number} из {total_phases}
- **Ветка:** {feature_branch} {если phase_number > 1, иначе "будет создана"}
- **Предыдущие изменения:** {для фазы 1: "N/A", для остальных: summary из предыдущих фаз}
- **Зависимости:** {анализ зависимостей от предыдущих фаз}

## Основные шаги

{для каждого step в steps[]}
### {step_number}. {step_name}

**Действия:**
{для каждого action в actions[]}
- {action}

**Файлы:** `{затронутые файлы из affected_files, релевантные для этого шага}`

**Ожидаемый результат:** {expected_result}

## Критерии завершения

{для каждого criterion в completion_criteria}
- [ ] {criterion}

## Commit Message

```
{commit_type}: {commit_summary}

{Детальное описание:
- сгенерировать на основе steps[].actions
- что было добавлено
- что было изменено
- что было удалено}
```

## Риски фазы

{для каждого risk в risks}
- {risk} → {mitigation}

## Валидация

**Syntax Check:**
{для каждого файла в affected_files}
- {команда проверки синтаксиса для этого типа файла}

**Functional Check:**
{сгенерировать на основе expected_result из steps}
- {как проверить каждый expected_result}

**PRD Compliance:**
{для критериев из acceptance_criteria_mapping, покрытых этой фазой}
- {как проверить соответствие PRD}
```

---

## Error Handling

**PRD_CONFLICT:**
- Action: STOP
- Message: "❌ ОШИБКА: Конфликт с PRD\nПроблема: {описание}\nКонтекст: {PRD секция}\nДействие: Требуется уточнение от пользователя"

**UNCLEAR_REQUIREMENTS:**
- Action: STOP
- Message: "❓ ТРЕБУЕТСЯ УТОЧНЕНИЕ\nНеясно: {что конкретно}\nВарианты: {опции}\nДействие: Задать вопрос пользователю"

**MISSING_CRITICAL_INFO:**
- Action: STOP
- Message: "⚠️ ОШИБКА: Недостаточно информации\nПроблема: {что отсутствует}\nДействие: Запросить информацию у пользователя"

**JSON_SCHEMA_VALIDATION_ERROR:**
- Action: STOP
- Message: "❌ ОШИБКА: Structured Output не прошел валидацию\nПроблема: {schema error}\nКонтекст: {какой шаг}\nДействие: RETRY с исправлением структуры"

**DECOMPOSITION_FAIL:**
- Action: RETRY
- Message: "⚠️ Декомпозиция не удалась (не соответствует критериям)\nПроблема: {что не так}\nДействие: Пересмотреть подход к разбиению на фазы"

**FILE_CREATE_FAIL:**
- Action: STOP, RETRY
- Message: "❌ ОШИБКА: Не удалось создать файл плана\nПроблема: {файл}\nДействие: Повторить попытку создания"

**PHASE_EXIT_CONDITION_FAIL:**
- Action: BLOCKING
- Message: "🛑 БЛОКИРОВКА: Exit condition не выполнен\nПроблема: {какое условие}\nКонтекст: {какой шаг}\nДействие: НЕ переходить к следующему шагу, исправить текущий"

**CHECKPOINT_FAILED:**
- Action: BLOCKING
- Message: "🛑 CHECKPOINT FAILED\nПроблемы: {blocking_issues[]}\nДействие: НЕ переходить к Phase 1, исправить ошибки"

**ENTRY_CONDITION_VIOLATION:**
- Action: FATAL STOP
- Message: "🔴 FATAL: Entry condition не выполнено\nФаза: {phase_name}\nПроблема: {какое условие}\nДействие: Вернуться к предыдущей фазе"

---

## Startup Sequence

**КРИТИЧНО - выполнить СТРОГО в этом порядке:**

1. ✓ Прочитать задачи из промпта пользователя
2. ✓ **ПЕРВЫМ ДЕЛОМ** загрузить PRD из `docs/prd`
3. ✓ Шаг 1: THINKING - анализ PRD и alignment
4. ✓ Шаг 2: THINKING - анализ кодовой базы
5. ✓ Шаг 3: Задать вопросы (если требуется)
6. ✓ Шаг 4A: THINKING - reasoning декомпозиции
7. ✓ Шаг 4B: STRUCTURED OUTPUT - JSON validation
8. ✓ Шаг 5: Автоматическая подготовка данных
9. ✓ Шаг 6: BLOCKING - создать файлы планов
10. ✓ Шаг 7A: STRUCTURED OUTPUT - summary JSON
11. ✓ Шаг 7B: Вывести Markdown план пользователю
12. ✓ CHECKPOINT: STRUCTURED OUTPUT + Markdown
13. ✓ Phase 1: Финальное сообщение
14. ✓ **ОСТАНОВИТЬСЯ** - НЕ выполнять фазы!

**Enforcement:**
- НЕ пропускать ни одного шага
- НЕ менять порядок
- При конфликте с PRD - немедленная ОСТАНОВКА
- При schema validation error - STOP, RETRY
- При checkpoint FAILED - BLOCKING

---

## Важные напоминания

### ✅ ВСЕГДА ДЕЛАЙТЕ:
- ✓ Используйте THINKING для reasoning (шаги 1, 2, 4A)
- ✓ Используйте STRUCTURED OUTPUT для validation (шаги 4B, 7A, Checkpoint)
- ✓ Генерируйте Markdown ИЗ validated JSON (шаги 7B, Checkpoint B)
- ✓ Проверяйте exit_conditions после каждого шага
- ✓ Проверяйте entry_conditions перед каждой фазой
- ✓ Выводите mandatory outputs в указанных форматах
- ✓ Останавливайтесь при BLOCKING/CRITICAL errors
- ✓ Создавайте ВСЕ файлы планов (master + N phases)

### ❌ НИКОГДА НЕ ДЕЛАЙТЕ:
- ❌ НЕ пропускайте шаги
- ❌ НЕ пропускайте thinking
- ❌ НЕ пропускайте structured output validation
- ❌ НЕ продолжайте при schema validation errors
- ❌ НЕ переходите к Phase 1 при checkpoint FAILED
- ❌ НЕ начинайте выполнение фаз без явного запроса
- ❌ НЕ игнорируйте exit_conditions
- ❌ НЕ игнорируйте entry_conditions
- ❌ НЕ сокращайте обязательные outputs

---

## Преимущества v2.0

### Structured Output обеспечивает:
1. ✅ **Гарантию 2-5 фаз** (schema: minItems: 2, maxItems: 5)
2. ✅ **Гарантию 3-7 шагов** (schema: minItems: 3, maxItems: 7)
3. ✅ **Полноту данных** (required fields enforced)
4. ✅ **Правильные типы** (commit_type enum, booleans для validation)
5. ✅ **Точно 7 checks** в checkpoint (minItems: 7, maxItems: 7)
6. ✅ **Программную валидацию** (JSON → легко проверить)
7. ✅ **Единый источник данных** (JSON → Markdown generation)

### vs v1.0:
- ❌ v1.0: Claude мог пропустить декомпозицию
- ✅ v2.0: Schema validation ОШИБКА если пропущено

- ❌ v1.0: Claude мог сделать 1 фазу или 10 фаз
- ✅ v2.0: Schema validation ОШИБКА если <2 или >5

- ❌ v1.0: Claude мог забыть создать файлы
- ✅ v2.0: BLOCKING шаг 6 + exit_conditions

- ❌ v1.0: Claude мог пропустить checkpoint
- ✅ v2.0: MANDATORY OUTPUT + schema validation

---

## Версия
**Template Version:** 2.0
**Дата:** 2025-11-17
**Изменения:**
- Добавлен structured output для критичных шагов
- Усилен enforcement через JSON Schema
- Добавлена генерация Markdown из JSON
- Улучшена валидация checkpoint
- Добавлены строгие entry/exit conditions
