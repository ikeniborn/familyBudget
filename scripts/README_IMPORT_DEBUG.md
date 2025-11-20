# Диагностика Import 500 Error - Быстрый гайд

## Если таблица t_import_staging существует, но 500 ошибка есть

### Шаг 1: Проверка логов backend

```bash
cd ~/familyBudget
./scripts/show_import_errors.sh
```

Скрипт покажет:
- Ошибки в логах backend
- Import-related логи
- Последние 30 строк логов

### Шаг 2: Проверка инфраструктуры

```bash
cd ~/familyBudget
./scripts/check_import_setup.sh
```

Скрипт проверит:
- Таблица t_import_staging ✅
- Import router подключен
- Import services существуют
- Backend контейнер работает

### Шаг 3: Проверка файлов в production

**На dev сервере проверьте что все файлы синхронизированы:**

```bash
# Проверить наличие import модулей
ls -la /opt/budget/backend/app/services/tinkoff_csv_parser.py
ls -la /opt/budget/backend/app/services/import_executor.py
ls -la /opt/budget/backend/app/models/import_staging.py
ls -la /opt/budget/backend/app/schemas/import_schema.py

# Проверить import router
grep -n "import_router" /opt/budget/backend/app/api/v1/router.py
grep -n "import_router" /opt/budget/backend/app/api/v1/endpoints/__init__.py
```

**Если файлы отсутствуют:**

```bash
cd ~/familyBudget
./deploy.sh --profile full
```

### Шаг 4: Тест в реальном времени

**Terminal 1: Следить за логами**
```bash
cd /opt/budget
docker compose logs backend -f
```

**Browser: Загрузить CSV**
1. Открыть https://budget-dev.ikeniborn.ru/import
2. Выбрать CSV файл
3. Нажать "Загрузить"

**Terminal 1: Сразу увидите ошибку!**

### Типичные причины 500 ошибки

#### 1. ModuleNotFoundError: No module named 'backend.app.services.tinkoff_csv_parser'

**Причина:** Файлы не синхронизированы на сервер

**Решение:**
```bash
cd ~/familyBudget
./deploy.sh --profile full
```

#### 2. ImportError: cannot import name 'ImportStaging'

**Причина:** Model не экспортирован в `__init__.py`

**Проверка:**
```bash
grep "ImportStaging" /opt/budget/backend/app/models/__init__.py
```

**Решение:** Уже исправлено в коммите, нужен redeploy.

#### 3. AttributeError: module 'backend.app.schemas' has no attribute 'ImportUploadResponse'

**Причина:** Schemas не экспортированы

**Проверка:**
```bash
grep "ImportUploadResponse" /opt/budget/backend/app/schemas/__init__.py
```

**Решение:** Уже исправлено, нужен redeploy.

#### 4. Table 't_import_staging' does not exist

**Причина:** Миграция не применена

**Решение:**
```bash
cd /opt/budget
docker compose exec backend alembic upgrade head
```

#### 5. No such file or directory: uploaded CSV

**Причина:** Проблемы с правами на временные файлы

**Решение:**
```bash
cd /opt/budget
docker compose exec backend ls -la /tmp
docker compose restart backend
```

### Шаг 5: Полный redeploy (если ничего не помогает)

```bash
cd ~/familyBudget
git pull
./deploy.sh --profile full

# Проверить
./scripts/check_import_setup.sh
```

### Получение детальной ошибки в браузере

После deploy обновлённой версии (коммит d3b8ce03):

1. Открыть Console (F12)
2. Загрузить CSV
3. В консоли увидите:
   ```javascript
   Server error response: { detail: "реальная ошибка от backend" }
   ```

### Быстрая проверка всего

```bash
# 1. Проверка инфраструктуры
cd ~/familyBudget && ./scripts/check_import_setup.sh

# 2. Проверка ошибок
./scripts/show_import_errors.sh

# 3. Если нужен redeploy
./deploy.sh --profile full

# 4. Проверка после deploy
./scripts/check_import_setup.sh
```

### Контрольный список

- [ ] Таблица t_import_staging существует
- [ ] Backend контейнер работает
- [ ] Import router подключен в backend/app/api/v1/router.py
- [ ] Файлы tinkoff_csv_parser.py, import_executor.py существуют
- [ ] Model ImportStaging экспортирован в models/__init__.py
- [ ] Schemas импорта экспортированы в schemas/__init__.py
- [ ] Нет ошибок в логах backend
- [ ] После загрузки CSV видна детальная ошибка в консоли браузера

### Если всё ещё не работает

Предоставьте:
```bash
# 1. Output от проверки
./scripts/check_import_setup.sh > check_output.txt

# 2. Ошибки из логов
./scripts/show_import_errors.sh > errors_output.txt

# 3. Проверка файлов
ls -la /opt/budget/backend/app/services/tinkoff* /opt/budget/backend/app/models/import* > files_output.txt

# Отправить все три файла
```
