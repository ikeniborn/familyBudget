---
wiki_sources: ["docs/architecture/features/import-wizard.md"]
wiki_updated: 2026-05-05
wiki_status: developing
tags: ["FastAPI", "CSV", "TypeScript", "frontend", "backend"]
aliases: ["CSV Import", "ImportWizard", "csvImporter", "Per-User Mappings", "Import Endpoint"]
---

# Import Wizard Service (CSV Import)

6-шаговый мастер импорта CSV-выписок банка с автоопределением формата и per-user маппингом колонок.

## Основные характеристики

### 6 шагов мастера

| Шаг | Действие |
|-----|----------|
| 1 | Загрузка файла (drag & drop или file picker) |
| 2 | Автоопределение разделителя и кодировки |
| 3 | Предпросмотр и выбор колонок |
| 4 | Маппинг колонок на поля транзакции |
| 5 | Валидация и предпросмотр результата |
| 6 | Импорт с прогресс-баром |

### Per-User Column Mappings (SCD Type 1)

Каждый пользователь имеет свой маппинг колонок для каждого банка. Уникальный constraint: `(bank_provider_id, user_id)`.

```python
# Модель
class BankColumnMapping:
    user_id: int
    bank_provider_id: int
    column_map: dict  # {"amount": "Сумма", "date": "Дата операции", ...}
```

**Поведение:**
- При первом импорте из банка: пользователь настраивает маппинг вручную
- При повторном импорте: маппинг предзаполнен сохранёнными настройками
- Обновление: SCD Type 1 (upsert — перезаписывает предыдущий маппинг)

### Автоопределение формата

- **Разделитель:** пробует `;`, `,`, `\t` — выбирает тот, что даёт максимум колонок
- **Кодировка:** пробует `UTF-8`, `Windows-1251`, `ISO-8859-1`
- **Дата:** несколько форматов (`DD.MM.YYYY`, `YYYY-MM-DD`, `MM/DD/YYYY`)

### Timeout и отмена

Импорт крупных файлов ограничен `AbortController` с таймаутом 30 секунд:
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000);
fetch(url, { signal: controller.signal });
```

### Backend Endpoint

```
POST /api/v1/import/upload
POST /api/v1/import/preview
POST /api/v1/import/execute
GET  /api/v1/import/mappings/{bank_id}
POST /api/v1/import/mappings/{bank_id}
```

**Допустимые форматы файлов:** `.xlsx`, `.csv`, `.json`
**Максимальный размер:** 50 MB (nginx + FastAPI)

### Frontend модуль

`csvImporter` — полностью мигрирован на TypeScript в рамках ES Modules Migration (Phase 2):
- `core/ImportState.ts` — состояние (204 строки, 0 зависимостей)
- `steps/` — рендереры для каждого шага
- `validation/` — валидация данных

## Связанные концепции

- [[recurring-plans-service]]
- [[transfer-service]]
