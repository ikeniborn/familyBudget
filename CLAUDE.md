# CLAUDE.md - Project Memory & Workflow Rules

**Project:** Family Budget
**Version:** 1.0
**Last Updated:** 2025-10-08
**Purpose:** Unified project memory combining workflow execution rules and project-specific technical documentation

---

## TABLE OF CONTENTS

### PART I: UNIVERSAL WORKFLOW EXECUTION RULES
1. [Critical Principles (P1-P5)](#part-i-universal-workflow-execution-rules)
2. [High Priority Rules (P6-P10)](#2-high-priority-rules-p6-p10)
3. [Medium Priority Rules (P11-P13)](#3-medium-priority-rules-p11-p13)
4. [Prohibited & Mandatory Actions](#4-prohibited--mandatory-actions)
5. [Standard Formats](#5-standard-formats)

---

# PART I: UNIVERSAL WORKFLOW EXECUTION RULES

## 1. CRITICAL PRINCIPLES (P1-P5)

### P1: Sequential Execution (CRITICAL)
**Правило:** Выполняйте фазы и actions СТРОГО последовательно.

**Обязательно:**
- ✓ Выполняйте фазы в указанном порядке
- ✓ Выполняйте все actions внутри фазы по порядку
- ✓ НЕ пропускайте фазы
- ✓ НЕ пропускайте actions
- ✓ НЕ меняйте порядок выполнения

**Нарушение:** FATAL - немедленная остановка

---

### P2: Thinking Requirement (CRITICAL)
**Правило:** ОБЯЗАТЕЛЬНО используйте `<thinking>` перед критическими решениями.

**Когда обязателен thinking:**
- Перед началом каждой фазы
- Перед actions помеченными `requires_thinking="true"`
- Перед actions с `validation="critical"`
- Перед принятием важных технических решений
- При выборе между альтернативными подходами

**Что должен содержать thinking:**
- Анализ текущей ситуации
- Оценка рисков
- Обоснование выбранного решения
- Рассмотрение альтернатив
- План проверки результата

**Формат thinking:**
```xml
<thinking>
1. АНАЛИЗ: [что имеем]
2. ОПЦИИ: [какие варианты]
3. ВЫБОР: [что выбираем и почему]
4. РИСКИ: [что может пойти не так]
5. ВАЛИДАЦИЯ: [как проверим]
</thinking>
```

**Нарушение:** FATAL - действие НЕ ВЫПОЛНЯЕТСЯ без thinking

---

### P3: Mandatory Output Enforcement (CRITICAL)
**Правило:** Выводите ВСЕ обязательные outputs в указанных форматах.

**Когда output обязателен:**
- Action помечен `output="required"`
- Action имеет `mandatory_output` секцию
- Action имеет `mandatory_format` секцию
- Checkpoint требует verification_instruction

**Обязательно:**
- ✓ Используйте ТОЧНО указанный формат
- ✓ Заполните ВСЕ секции mandatory_format
- ✓ НЕ сокращайте форматы
- ✓ НЕ пропускайте секции
- ✓ НЕ заменяйте формат на "свой"

**Нарушение:** BLOCKING - нельзя продолжить без output

---

### P4: Exit Conditions Verification (CRITICAL)
**Правило:** Проверяйте exit_conditions перед продолжением.

**Обязательно:**
- ✓ Проверьте ВСЕ conditions в exit_conditions
- ✓ НЕ продолжайте если хотя бы одно condition не выполнено
- ✓ Выведите статус каждого condition явно
- ✓ При невыполнении - выполните violation_action

**Типичные exit_conditions:**
- Все обязательные actions выполнены
- Все mandatory_outputs выведены
- Validation passed
- Checkpoint пройден

**Нарушение:** FATAL - блокировка перехода к следующему шагу

---

### P5: Checkpoint Verification (HIGH)
**Правило:** Проходите checkpoints с явной верификацией перед переходом между фазами.

**Обязательно:**
- ✓ Проверьте ВСЕ checks в checkpoint
- ✓ Выведите verification_instruction если указана
- ✓ НЕ переходите к следующей фазе пока ВСЕ checks != ✓
- ✓ Выводите статус checkpoint явно

**Формат checkpoint verification:**
```
PHASE N CHECKPOINT:
[✓/✗] Check 1: [статус и детали]
[✓/✗] Check 2: [статус и детали]
[✓/✗] Check N: [статус и детали]

РЕЗУЛЬТАТ: ✓ PASSED / ✗ FAILED
Переход к Phase N+1: [ALLOWED/BLOCKED]
```

**Нарушение:** BLOCKING - нельзя перейти к следующей фазе

---

## 2. HIGH-PRIORITY RULES (P6-P10)

### P6: Entry Conditions Check (HIGH)
**Правило:** Проверяйте entry_conditions перед входом в фазу.

**Обязательно:**
- ✓ Проверьте все entry conditions
- ✓ При невыполнении - выполните violation_action
- ✓ НЕ начинайте фазу без выполнения conditions

---

### P7: Blocking Actions Enforcement (HIGH)
**Правило:** Для actions с `blocking="true"` - строго следуйте ограничениям.

**Обязательно:**
- ✓ Завершите action полностью
- ✓ Выведите mandatory_output
- ✓ Проверьте exit_condition
- ✓ НЕ продолжайте до выполнения всех требований

---

### P8: Validation Level Respect (HIGH)
**Правило:** Выполняйте validation в соответствии с уровнем.

**Уровни validation:**
- `critical`: ОБЯЗАТЕЛЬНАЯ проверка, STOP при failure
- `standard`: Обычная проверка, retry при failure
- `micro`: Быстрая проверка, log при failure

**Для validation="critical":**
- ОБЯЗАТЕЛЬНО thinking перед action
- ОБЯЗАТЕЛЬНО вывод результата проверки
- STOP немедленно при failure
- НЕ продолжать до исправления

---

### P9: Error Handling Compliance (HIGH)
**Правило:** Следуйте error_handling правилам при ошибках.

**Обязательно:**
- ✓ Определите тип ошибки
- ✓ Выполните указанный action (STOP/RETRY/ASK)
- ✓ Выведите указанное error message
- ✓ НЕ игнорируйте ошибки
- ✓ НЕ продолжайте при STOP errors

---

### P10: Approval Gates Respect (HIGH)
**Правило:** Для approval_gate с `required="true"` - ждите подтверждения.

**Обязательно:**
- ✓ Выведите approval gate message
- ✓ ЖДИТЕ подтверждения пользователя
- ✓ НЕ продолжайте автоматически
- ✓ Предложите опции (yes/no/review)

---

## 3. MEDIUM-PRIORITY RULES (P11-P13)

### P11: Ask When Unclear (MEDIUM)
**Правило:** При неясности - ОСТАНОВИТЕСЬ и спросите.

**Когда спрашивать:**
- Требования неоднозначны
- Несколько возможных интерпретаций
- Отсутствует критичная информация
- Неясен ожидаемый результат

**Формат вопроса:**
```
❓ ТРЕБУЕТСЯ УТОЧНЕНИЕ
Неясно: [что конкретно]
Варианты: [опции]
Вопрос: [конкретный вопрос]
```

---

### P12: Decision Documentation (MEDIUM)
**Правило:** Документируйте важные технические решения.

**Что документировать:**
- Выбор между альтернативными подходами
- Отклонение очевидных вариантов
- Trade-offs и компромиссы

---

### P13: Conditional Execution (MEDIUM)
**Правило:** Выполняйте conditional actions только при выполнении condition.

---

## 4. PROHIBITED & MANDATORY ACTIONS

### НИКОГДА НЕ ДЕЛАЙТЕ:
❌ НЕ пропускайте фазы / actions / thinking / mandatory_output
❌ НЕ сокращайте форматы
❌ НЕ продолжайте при critical failures
❌ НЕ игнорируйте blocking conditions / exit_conditions / checkpoints
❌ НЕ делайте assumptions - ASK при неясности

### ВСЕГДА ДЕЛАЙТЕ:
✓ ВСЕГДА используйте thinking для requires_thinking="true"
✓ ВСЕГДА выводите mandatory_output для output="required"
✓ ВСЕГДА проверяйте exit_conditions / checkpoints / conditions
✓ ВСЕГДА останавливайтесь при critical failures
✓ ВСЕГДА спрашивайте при неясности
✓ ВСЕГДА выполняйте последовательно
✓ ВСЕГДА обрабатывайте ошибки

---

## 5. STANDARD FORMATS

### Формат Thinking:
```xml
<thinking>
КОНТЕКСТ: [текущая ситуация]
ЗАДАЧА: [что нужно сделать]
ОПЦИИ: [варианты с плюсами/минусами]
ВЫБОР: [вариант N] потому что [обоснование]
РИСКИ: [что может пойти не так]
ПРОВЕРКА: [как валидируем результат]
</thinking>
```

### Формат Error Message:
```
[ICON] ОШИБКА: [Тип]
Проблема: [описание]
Контекст: [где произошло]
Действие: [STOP/RETRY/ASK]
```

### Формат Checkpoint:
```
PHASE N CHECKPOINT:
[✓/✗] Check 1: [детали]
РЕЗУЛЬТАТ: ✓ PASSED / ✗ FAILED
Переход: [ALLOWED/BLOCKED]
```

---