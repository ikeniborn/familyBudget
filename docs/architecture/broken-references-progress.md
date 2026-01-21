# Broken References Fix Progress

**Дата:** 2026-01-21
**Статус:** В процессе (50% завершено)

## Прогресс

**Всего broken references:** 50
**Исправлено:** 25 (50%)
**Осталось:** 25 (50%)

## Исправленные категории

### 1. WebAuthn Service Index (10 ссылок) ✅
**Проблема:** Ссылки на `authentication.yaml#/module/services/8`, но WebAuthn - это `services/7`

**Исправления:**
- `endpoints/webauthn.yaml`: services/8 → services/7 (7 occurrences)
- `database/support.yaml`: services/8 → services/7 (1)
- `database/dimensions.yaml`: services/8 → services/7 (1)
- `database/facts.yaml`: services/8 → services/7 (1)

**Коммит:** ca14be80

### 2. Aggregation Table (4 ссылки) ✅
**Проблема:** Таблица `t_agg_financial_center_balance_monthly` не документирована

**Исправление:**
- Добавлена новая секция AGGREGATION в `database/support.yaml`
- Документация monthly balance aggregates

**Коммит:** ca14be80

### 3. Transfer Logic (3 ссылки) ✅
**Проблема:** Ссылки на `transfers.yaml#/module/services/0`, но services пустой

**Исправления:**
- `database/facts.yaml`: services/0 → transfer_logic (2)
- `database/indexes.yaml`: services/0 → endpoints (1)

**Коммит:** ca14be80

### 4. 2FA Session Table (2 ссылки) ✅
**Проблема:** Таблица в документации `t_two_factor_session`, но в БД `t_2fa_session`

**Исправление:**
- Переименована во всём `database/support.yaml`

**Коммит:** ca14be80

### 5. Notification Tables (4 ссылки) ✅
**Проблема:** Таблицы `t_scheduled_reminder` и `t_push_subscription` не документированы

**Исправления:**
- Добавлена `t_scheduled_reminder` в NOTIFICATIONS
- Добавлена `t_push_subscription` в NOTIFICATIONS

**Коммит:** ca14be80

### 6. Import Dimension Tables (4 ссылки) ✅
**Проблема:** Ссылки на `support.yaml#/tables/t_d_import_template|t_d_bank_provider`, но таблицы в `dimensions.yaml`

**Исправления:**
- `endpoints/import.yaml`: support → dimensions (2)
- `functionality/csv-import.yaml`: support → dimensions (2)

**Коммит:** b741b435

## Оставшиеся категории (25 ссылок)

### 1. Shopping Tables (4 ссылки)
- `t_d_product_group_history` (2 refs) - нужно добавить в `history.yaml`
- `t_f_shopping_list_item` (2 refs) - нужно добавить в `facts.yaml`

### 2. Missing Service Indices (~15 ссылок)
- `shopping-lists.yaml#/module/services/5,6,7` (3 refs)
- `budget-management.yaml#/module/services/3,4` (2 refs)
- `financial-centers.yaml#/module/services/2` (1 ref)
- `cost-centers.yaml#/module/services/1` (1 ref)
- `realtime.yaml#/module/services/0` (1 ref)
- Другие модули (~7 refs)

### 3. Missing Sections (~6 ссылок)
- `realtime.yaml#/critical_constraint` (1 ref)
- `offline.yaml#/indexeddb` (1 ref)
- Другие секции (~4 refs)

## Следующие шаги

1. **Добавить shopping tables** в history.yaml и facts.yaml (4 refs)
2. **Исправить/добавить missing service indices** во всех модулях (~15 refs)
3. **Добавить missing sections** или удалить broken ссылки (~6 refs)
4. **Запустить финальную валидацию** и обновить validation-report.md
5. **Создать финальный коммит** со всеми исправлениями

## Коммиты

- `6eaf64ce`: Phase 4-5 completion (metadata + new docs)
- `ca14be80`: Fix 21 broken references (WebAuthn, aggregation, transfers, 2FA, notifications)
- `b741b435`: Fix 4 broken references (import dimension tables)

## Статистика

**Исправлено файлов:** 7
- `endpoints/webauthn.yaml`
- `database/support.yaml` (+3 tables, 1 rename)
- `database/dimensions.yaml`
- `database/facts.yaml`
- `database/indexes.yaml`
- `endpoints/import.yaml`
- `functionality/csv-import.yaml`

**Добавлено таблиц:** 3
- `t_agg_financial_center_balance_monthly` (aggregation)
- `t_scheduled_reminder` (notifications)
- `t_push_subscription` (notifications)

**Переименовано таблиц:** 1
- `t_two_factor_session` → `t_2fa_session`
