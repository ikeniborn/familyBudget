# Claude Code Hooks для проекта Family Budget

## Описание

Эта директория содержит локальные хуки Claude Code для автоматического добавления контекста к запросам и логирования всех промптов.

## Структура

```
.claude/
├── hooks/
│   └── add-context.sh     # Скрипт добавления контекста и логирования
├── settings.json          # Конфигурация хуков
├── test-hook.sh          # Тестовый скрипт
└── README.md             # Этот файл
```

## Установленные хуки

### UserPromptSubmit Hook

**Файл:** `hooks/add-context.sh`  
**Триггер:** Каждый запрос пользователя  
**Назначение:** 
1. Добавляет фиксированный контекст к каждому запросу
2. Сохраняет логи всех запросов

#### Добавляемый контекст:

К каждому запросу автоматически добавляется:

1. **Роль**: Профессиональный разработчик фронтенд и бэкенд для приложения домашнего учета
2. **Правила**: Использование субагентов
3. **Стандартные задачи**:
   - Анализ задачи с использованием sequential-thinking, context7, memory
   - Формирование плана реализации
   - Декомпозиция и выбор субагентов
   - Тестирование
   - Обновление памяти
   - Коммит и пуш изменений

#### Логирование запросов:

- **Директория логов**: `/home/ikeniborn/Documents/Project/familyBudget/requests/`
- **Формат имени файла**: `YYYYmmddHHMMSS_request.md`
- **Содержимое лога**:
  - Timestamp запроса
  - Оригинальный запрос пользователя
  - Расширенный промпт, отправленный Claude

## Использование

Хук работает автоматически при каждом запросе к Claude Code. Никаких дополнительных действий не требуется.

### Просмотр логов

```bash
# Посмотреть последние логи
ls -lt /home/ikeniborn/Documents/Project/familyBudget/requests/ | head

# Просмотреть конкретный лог
cat /home/ikeniborn/Documents/Project/familyBudget/requests/[timestamp]_request.md
```

## Настройка

### Включение/отключение хука

Для отключения хука переименуйте или удалите файл `settings.json`:

```bash
# Отключить
mv .claude/settings.json .claude/settings.json.bak

# Включить обратно
mv .claude/settings.json.bak .claude/settings.json
```

### Модификация контекста

Для изменения добавляемого контекста отредактируйте файл `hooks/add-context.sh`:
- Роль и правила: строки 21-24
- Задачи: строки 28-42

## Тестирование

Для проверки работы хука:

```bash
# Простой тест
echo "Test prompt" | bash .claude/hooks/add-context.sh

# Проверка создания лога
ls -lt /home/ikeniborn/Documents/Project/familyBudget/requests/ | head -1
```

## Безопасность

⚠️ **Важно:** Хуки выполняют произвольные shell-команды. Всегда проверяйте содержимое скриптов перед использованием.

## Обслуживание

### Очистка старых логов

```bash
# Удалить логи старше 30 дней
find /home/ikeniborn/Documents/Project/familyBudget/requests/ -name "*.md" -mtime +30 -delete

# Архивировать логи
tar -czf requests_backup_$(date +%Y%m%d).tar.gz /home/ikeniborn/Documents/Project/familyBudget/requests/
```

## Отладка

При возникновении проблем:

1. Проверьте права доступа к директории requests
2. Убедитесь, что скрипт исполняемый: `chmod +x .claude/hooks/add-context.sh`
3. Проверьте логи Claude Code для ошибок хуков