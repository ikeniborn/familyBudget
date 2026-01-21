# Broken References Fix Progress

**Дата:** 2026-01-21
**Статус:** В процессе (68% завершено)

## Прогресс

**Всего broken references:** 50
**Исправлено:** 34 (68%)
**Осталось:** 16 (32%)

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

### 7. Shopping List Tables (4 ссылки) ✅
**Проблема:** Таблицы `t_f_shopping_list_item` и `t_d_product_group_history` не документированы

**Исправления:**
- Добавлена `t_f_shopping_list_item` в `facts.yaml` (Header+Lines pattern)
- Добавлена `t_d_product_group_history` в `history.yaml` (SCD Type 2)

**Коммит:** cd4e5e21

### 8. Missing Service Indices - Shopping (4 ссылки) ✅
**Проблема:** Ссылки на несуществующие services/5,6,7 в shopping-lists module

**Исправления:**
- `t_d_shopping_list_history`: services/5 → services/0 (shopping_list_service)
- `t_d_shopping_list_item_history`: services/6 → services/1 (shopping_list_item_service)
- `t_d_store_history`: services/7 → services/2 (store_service)
- `t_d_product_group_history`: services/6 → services/3 (product_group_service)

**Коммит:** a7a72dbd

### 9. Missing Service Indices - Budget (1 ссылка) ✅
**Проблема:** Ссылка на несуществующий services/3 в budget-management module

**Исправление:**
- `t_d_article_history`: services/3 → services/0 (article_service)

**Коммит:** a7a72dbd

## Оставшиеся категории (16 ссылок)

### 1. Missing Service Indices (~10 ссылок)
- `budget-management.yaml#/module/services/4` (1 ref) - вероятно financial_center или cost_center history
- `financial-centers.yaml#/module/services/2` (1 ref)
- `cost-centers.yaml#/module/services/1` (1 ref)
- `realtime.yaml#/module/services/0` (1 ref)
- Другие модули (~6 refs)

### 2. Missing Sections (~6 ссылок)
- `realtime.yaml#/critical_constraint` (1 ref)
- `offline.yaml#/indexeddb` (1 ref)
- Другие секции (~4 refs)

## Следующие шаги

1. **Исправить оставшиеся service indices** (~10 refs)
2. **Добавить/исправить missing sections** (~6 refs)
3. **Запустить финальную валидацию** и обновить validation-report.md
4. **Создать финальный коммит** со всеми исправлениями

## Коммиты

- `6eaf64ce`: Phase 4-5 completion (metadata + new docs)
- `ca14be80`: Fix 21 broken references (WebAuthn, aggregation, transfers, 2FA, notifications)
- `b741b435`: Fix 4 broken references (import dimension tables)
- `cd4e5e21`: Add shopping tables documentation (t_f_shopping_list_item, t_d_product_group_history)
- `a7a72dbd`: Fix 5 missing service indices (shopping + budget management)

## Статистика

**Исправлено файлов:** 9
- `endpoints/webauthn.yaml` (7 refs)
- `database/support.yaml` (+3 tables, 1 rename)
- `database/dimensions.yaml` (1 ref)
- `database/facts.yaml` (2 refs + 1 new table)
- `database/indexes.yaml` (1 ref)
- `endpoints/import.yaml` (2 refs)
- `functionality/csv-import.yaml` (2 refs)
- `database/history.yaml` (5 service indices + 1 new table)

**Добавлено таблиц:** 5
- `t_agg_financial_center_balance_monthly` (aggregation)
- `t_scheduled_reminder` (notifications)
- `t_push_subscription` (notifications)
- `t_f_shopping_list_item` (shopping facts)
- `t_d_product_group_history` (product group history)

**Переименовано таблиц:** 1
- `t_two_factor_session` → `t_2fa_session`

**Исправлено service индексов:** 9
- Shopping history tables: 4 refs (services/5,6,7 → services/0,1,2,3)
- Budget management: 1 ref (services/3 → services/0)
- Transfer logic: 3 refs (services/0 → transfer_logic или endpoints)
- WebAuthn: 10 refs (services/8 → services/7)

**Новые строки документации:** ~590
- facts.yaml: +130 lines (t_f_shopping_list_item)
- history.yaml: +110 lines (t_d_product_group_history)
- support.yaml: +250 lines (3 tables)
- validation docs: +100 lines
