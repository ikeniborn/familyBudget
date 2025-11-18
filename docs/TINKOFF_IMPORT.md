# Tinkoff CSV Import - User Guide

## Описание

Функция импорта транзакций из Tinkoff Bank позволяет загружать CSV файлы и импортировать их в Family Budget.

**Статус:** ✅ Ready for Production (FR-080)

## Workflow

### 1. Экспорт CSV из Tinkoff

1. Откройте мобильное приложение Tinkoff
2. Перейдите в раздел "История операций"
3. Выберите "Экспорт" → "CSV"
4. Сохраните файл

### 2. Загрузка CSV

1. Войдите в Family Budget как **администратор**
2. Перейдите: **Админ** → **Импорт Tinkoff**
3. Выберите CSV файл
4. Настройте опции:
   - ☑ Пропустить FAILED транзакции (рекомендуется)
   - ☑ Пропустить внутренние переводы (рекомендуется)
5. Нажмите **"Загрузить и разобрать CSV"**

**Результат:** Транзакции добавлены в staging table

### 3. Обогащение транзакций

После загрузки откроется таблица с транзакциями:

**Обязательные поля:**
- **Категория бюджета** - выберите из списка (доходы/расходы)
- **ЦФО** - выберите финансовый центр

**Опциональные поля:**
- **МВЗ** - место возникновения затрат (если применимо)

**Массовые операции:**
1. Отметьте чекбоксами нужные транзакции
2. Выберите значения в dropdowns "массово"
3. Нажмите **"Применить к выбранным"**

**Индикаторы готовности:**
- ✓ (зеленый badge) - готово к импорту
- ! (желтый badge) - не назначена категория или ЦФО

### 4. Импорт в бюджет

1. Отметьте транзакции для импорта (checkbox)
2. Нажмите **"Импортировать выбранные"**
3. Подтвердите действие

**Результат:** Транзакции добавлены в BudgetFact, видны в разделе "Транзакции"

### 5. Очистка staging

После успешного импорта:
- **"Очистить выбранные"** - удалит только импортированные
- **"Очистить все"** - удалит все из staging (⚠️ осторожно!)

## API Endpoints

### POST /api/v1/import/tinkoff-csv
Upload CSV file

**Parameters:**
- `file`: CSV file (multipart/form-data)
- `skip_failed`: bool (default: true)
- `skip_internal_transfers`: bool (default: true)

**Response:** `ImportUploadResponse`

### GET /api/v1/import/staging
List staging records

**Parameters:**
- `page`: int (default: 1)
- `page_size`: int (default: 50, max: 100)
- `is_selected`: bool | null

**Response:** `ImportStagingListResponse`

### PUT /api/v1/import/staging/{id}
Update single staging record

**Body:** `ImportStagingUpdate`

### PATCH /api/v1/import/staging/bulk
Bulk update multiple records

**Body:** `ImportStagingBulkUpdate`

### POST /api/v1/import/staging/execute
Execute import (staging → BudgetFact)

**Response:** `ImportExecuteResponse`

### DELETE /api/v1/import/staging
Cleanup staging

**Parameters:**
- `selected_only`: bool (default: true)

**Response:** `ImportCleanupResponse`

## Tinkoff CSV Format

**Expected columns (15):**
- Дата операции
- Дата платежа
- Номер карты
- Статус
- Сумма операции
- Валюта операции
- Сумма платежа
- Валюта платежа
- Кэшбэк
- Категория
- MCC
- Описание
- Бонусы (спасибо)
- Округление на инвесткопилку
- Сумма операции с округлением

**Encoding:** UTF-8 or Windows-1251
**Delimiter:** Semicolon (;)
**Decimal separator:** Comma (,)

## Edge Cases

### Автоматически пропускаются:
- FAILED транзакции (если включена опция)
- Внутренние переводы:
  - "Между своими счетами"
  - "Пополнение вклада"
  - "Снятие с вклада"
  - "Закрытие вклада"

### Validation при импорте:
- `article_id` обязателен
- `financial_center_id` обязателен
- `amount` должен быть валидным числом

### Ошибки импорта:
Если транзакция не прошла валидацию, она пропускается с сообщением об ошибке. Другие транзакции импортируются независимо.

## Access Control

**Доступ к импорту:** Только администраторы

**Импортированные транзакции:** Видны всем пользователям (Shared Family Budget model)

## Troubleshooting

### "Ошибка загрузки CSV"
- Проверьте формат файла (CSV из Tinkoff)
- Проверьте кодировку (UTF-8 или Windows-1251)
- Убедитесь, что файл содержит 15 колонок

### "Пропущено N транзакций"
- Проверьте, назначены ли категория и ЦФО
- Проверьте логи для деталей ошибок

### "Staging пустой после загрузки"
- Возможно все транзакции FAILED или внутренние переводы
- Отключите опции "пропустить" и попробуйте снова

## Technical Implementation

**Stack:**
- Backend: FastAPI + SQLModel + PostgreSQL
- Frontend: DaisyUI + Vanilla JS
- Parser: Python csv module
- Validation: Pydantic schemas

**Database:**
- `t_import_staging` - temporary staging table
- `t_f_budget_fact` - final fact table (partitioned by month)

**Services:**
- `TinkoffCSVParser` - CSV parsing + filtering
- `ImportExecutor` - staging → BudgetFact conversion

**Tests:**
- Unit tests: `test_import_executor.py`
- Integration tests: `test_import_endpoints.py`
- Coverage: 85%+

## Version History

- **v1.0.0 (2025-11-18)** - Initial release (FR-080)
  - CSV upload + parsing
  - Staging table with enrichment
  - Bulk operations
  - Import execution
  - Cleanup functionality

## Support

**Issues:** https://github.com/ikeniborn/familyBudget/issues
**PRD:** FR-080 - Tinkoff CSV Import
**Related commits:** 9120a336, 2ed46450, f80ff8e0
