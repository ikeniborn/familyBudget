# Fix: Dexie SchemaDiff Cascade + DB Deletion After v11.5.3 Login

## Context

После обновления до v11.5.3 пользователи видят два типа ошибок при авторизации через Telegram:

1. `Dexie SchemaDiff: Schema was extended without increasing the number passed to db.version()`
2. `Another connection wants to delete database 'FamilyBudgetDB'. Closing db now to resume the delete request.`

Далее все данные из Dexie пропадают и приложение переходит на API fallback (`[DATA_LAYER] Dexie returned empty`).

**Это критический баг** — пользователь теряет весь офлайн кэш при каждом входе через Telegram.

---

## Root Cause

**Каскад из двух связанных багов:**

### Баг 1: `cleanupLegacyDB.ts` не выставляет MIGRATION_FLAG для версий 2, 3, 4

```typescript
// cleanupLegacyDB.ts — текущий код (НЕПРАВИЛЬНЫЙ)
if (version >= 5 && version <= 10) {
  await Dexie.delete(DB_NAME);  // удаляет легаси
} else if (version === 1) {
  localStorage.setItem(MIGRATION_FLAG, 'true');  // помечает как мигрированный
} else {
  logger.warn(`Unknown database version: ${version}`);  // версии 2, 3, 4 — НИЧЕГО!
}
```

Для версий 2, 3, 4 `MIGRATION_FLAG` никогда не выставляется. Значит `cleanupLegacyDatabase()` запускается при каждой загрузке страницы и каждый раз открывает временный schema-less инстанс БД — что само по себе провоцирует следующий баг.

### Баг 2: `database.ts` не объявляет version 4, хотя у некоторых пользователей БД уже на этой версии

В коммите `48fe5552` схема version 1 была изменена (добавлен `creator_id` в `shoppingLists` и `shoppingListItems`) без создания новой версии. Это вызывает **Dexie SchemaDiff** — Dexie обнаруживает несоответствие `__dbschema` store и автоматически инкрементирует нативную версию (3→4).

Код определяет только версии 1-3 (`DEFAULT_SCHEMA_VERSION = 3`). После SchemaDiff нативная версия становится 4. На следующей загрузке:
- `cleanupLegacyDatabase()` снова запускается (флаг не выставлен)
- Открывает tempDb, получает версию 4
- Версия 4 не в диапазоне 5-10, но и не 1 → падает в `else { warn('Unknown') }`
- `FamilyBudgetDB.open()` открывает БД на версии 4, а код знает только v1-v3 → SchemaDiff снова → инкремент 4→5

Теперь нативная версия = 5. При следующей загрузке:
- `cleanupLegacyDatabase()` видит версию 5 → `5 >= 5 && 5 <= 10` → **`Dexie.delete(DB_NAME)`** 🔥
- Если есть открытое соединение (другая вкладка/сервис-воркер) → `"Another connection wants to delete database"`
- Все данные удалены → API fallback

---

## Solution

### Файл 1: `frontend/shared/db/dexie/migration/cleanupLegacyDB.ts`

Изменить условие с `version === 1` на `version >= 1 && version < 5`, чтобы все современные Dexie-базы (v1-v4) корректно помечались как «мигрированные»:

```typescript
// БЫЛО (строки 92-98):
} else if (version === 1) {
  logger.debug('[Migration] Already using Dexie v1');
  localStorage.setItem(MIGRATION_FLAG, 'true');
} else {
  logger.warn(`[Migration] Unknown database version: ${version}`);
}

// СТАЛО:
} else if (version >= 1 && version < 5) {
  // Valid modern Dexie database (v1-v4)
  logger.debug(`[Migration] Modern Dexie database (v${version}), no migration needed`);
  localStorage.setItem(MIGRATION_FLAG, 'true');
} else {
  logger.warn(`[Migration] Unrecognized database version: ${version}`);
}
```

### Файл 2: `frontend/shared/db/dexie/core/database.ts`

Добавить версию 4 как no-op миграцию (без изменения схемы) — чтобы Dexie не видел несоответствия для БД на нативной версии 4. Обновить `DEFAULT_SCHEMA_VERSION = 4`:

```typescript
// БЫЛО:
const DEFAULT_SCHEMA_VERSION = 3;  // Remove user_id from Stores/ProductGroups

// СТАЛО:
const DEFAULT_SCHEMA_VERSION = 4;  // Acknowledge native v4 from SchemaDiff workaround
```

```typescript
// Добавить после version(3).stores(...).upgrade(...):

// Version 4: No-op migration — acknowledges native v4 browsers
// Background: Dexie SchemaDiff auto-incremented v3→v4 for users who had
// the old v1 schema (before creator_id was added in commit 48fe5552).
// This version prevents repeated SchemaDiff warnings.
this.version(4).stores({});
```

Также обновить комментарий конструктора:
```typescript
/**
 * Version 1: Initial schema (migrated from PGlite v7)
 * Version 2: Shopping lists creator_id schema fix
 * Version 3: Remove user_id from Stores/ProductGroups (global reference data)
 * Version 4: No-op — acknowledges native v4 created by Dexie SchemaDiff workaround
 */
```

---

## Critical Files

| Файл | Изменение |
|------|-----------|
| `frontend/shared/db/dexie/migration/cleanupLegacyDB.ts` | `version === 1` → `version >= 1 && version < 5` (строки 92-98) |
| `frontend/shared/db/dexie/core/database.ts` | `DEFAULT_SCHEMA_VERSION = 4`, добавить `this.version(4).stores({})` |

---

## Impact Analysis

| Сценарий | До фикса | После фикса |
|----------|----------|-------------|
| БД v3, первый вход через Telegram | SchemaDiff 3→4, следующий вход → удаление | SchemaDiff 3→4, флаг выставлен, новых проблем нет |
| БД v4 (уже incremented) | SchemaDiff 4→5, удаление | Код знает v4, нет SchemaDiff, флаг выставлен |
| БД v5 (уже удалена) | Удалена, API fallback | Создаётся заново на v4, работает нормально |
| Новый пользователь | Создаётся на v3, может каскадировать | Создаётся на v4, флаг выставляется сразу |

---

## Verification

1. **TypeScript check**: убедиться что код компилируется без ошибок
   ```bash
   cd frontend && npm run type-check
   ```

2. **Браузер DevTools** (после деплоя):
   - Application → IndexedDB → FamilyBudgetDB → проверить нативную версию (должна быть 4, не расти)
   - Application → Local Storage → `dexie_legacy_cleanup_done` → должен быть `true`
   - Console → не должно быть SchemaDiff warnings
   - Console → не должно быть "Another connection wants to delete database"

3. **Функциональная проверка**:
   - Войти через Telegram → перейти на главную страницу
   - Данные должны загрузиться из Dexie (не из API fallback)
   - `[DATA_LAYER] Dexie returned empty` — НЕ должно появляться

4. **Регрессия**: проверить что легаси миграция всё ещё работает для БД версий 5-10 (не затронуто изменениями)
