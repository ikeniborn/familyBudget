# Claude Code Hooks для проекта Family Budget

## Описание

Эта директория содержит локальные хуки Claude Code для автоматического добавления контекста проекта к запросам пользователя.

## Структура

```
.claude/
├── hooks/
│   └── add-context.sh     # Скрипт сбора контекста проекта
├── settings.json          # Конфигурация хуков
└── README.md             # Этот файл
```

## Установленные хуки

### UserPromptSubmit Hook

**Файл:** `hooks/add-context.sh`  
**Триггер:** Каждый запрос пользователя  
**Назначение:** Автоматически добавляет контекст проекта к запросам

#### Собираемый контекст:

1. **Git информация**
   - Текущая ветка
   - Измененные файлы
   - Последний коммит

2. **Docker контейнеры**
   - Статус запущенных контейнеров
   - Порты

3. **Структура проекта**
   - Наличие ключевых директорий

4. **Текущие задачи**
   - Незавершенные задачи из TASK.md (первые 5)

5. **Логи контейнеров**
   - Последние ошибки и предупреждения

6. **Окружение**
   - Режим работы (Development/Production)

7. **Статус тестов**
   - Покрытие кода (если доступно)

## Настройка

### Включение/отключение хука

Для отключения хука удалите или переименуйте файл `settings.json`.

### Модификация контекста

Вы можете настроить, какой контекст собирать, редактируя файл `hooks/add-context.sh`.

#### Добавление custom контекста:

В конце файла `hooks/add-context.sh` есть секция для пользовательских проверок:

```bash
# 8. Custom Context (user can add custom checks here)
# Добавьте свои проверки здесь
safe_exec "your_command" "Your Label"
```

#### Примеры custom контекста:

```bash
# Показать установленные npm пакеты
safe_exec "cd frontend-svelte && npm list --depth=0" "Frontend Packages"

# Показать размер базы данных
safe_exec "docker exec postgres psql -U budget -d budgetdb -t -c 'SELECT pg_size_pretty(pg_database_size(current_database()));'" "Database Size"

# Показать количество записей в основных таблицах
safe_exec "docker exec postgres psql -U budget -d budgetdb -t -c 'SELECT COUNT(*) FROM t_f_registry;'" "Registry Records"
```

## Безопасность

⚠️ **Важно:** Хуки выполняют произвольные shell-команды. Всегда проверяйте содержимое скриптов перед использованием.

## Отладка

Для проверки работы хука выполните:

```bash
cd /home/ikeniborn/Documents/Project/familyBudget
echo "Test prompt" | ./.claude/hooks/add-context.sh
```

## Отключение хука

Если хук мешает работе, вы можете:

1. Временно отключить: переименуйте `settings.json` в `settings.json.bak`
2. Полностью удалить: удалите директорию `.claude`

## Обновление хука

При изменении `add-context.sh` изменения применяются сразу, перезапуск Claude Code не требуется.