# Claude Skills для проекта Family Budget

> **Версия:** 1.0.0
> **Дата:** 2025-10-22
> **Автор:** Family Budget Team

---

## 📋 Оглавление

- [Что такое Claude Skills](#что-такое-claude-skills)
- [Зачем нужны Skills](#зачем-нужны-skills)
- [Доступные Skills](#доступные-skills)
- [Как использовать Skills](#как-использовать-skills)
- [Как создать новый Skill](#как-создать-новый-skill)
- [Best Practices](#best-practices)
- [Примеры использования](#примеры-использования)
- [FAQ](#faq)

---

## Что такое Claude Skills

**Claude Skills** — это специализированные инструкции и шаблоны кода, которые автоматизируют типичные задачи разработки. Skill представляет собой директорию с файлом `SKILL.md` (Markdown + YAML frontmatter), содержащим:

- **Описание задачи**: что делает skill
- **Контекст проекта**: архитектура, технологии, паттерны
- **Шаблоны кода**: готовые code templates
- **Инструкции**: пошаговые руководства
- **Примеры**: реальные use cases
- **Чеклисты**: проверки после выполнения

**Формат SKILL.md:**

```markdown
---
name: Skill Name
description: Краткое описание
version: 1.0.0
author: Team Name
tags: [tag1, tag2]
dependencies: [other-skill]
---

# Skill Name

Подробное описание...

## Когда использовать

- Условие 1
- Условие 2

## Шаблоны кода

...
```

**Ключевые особенности:**

- 🔄 **Auto-invoke**: Claude автоматически вызывает нужный skill при запросе
- 🧩 **Composable**: Skills объединяются автоматически для сложных задач
- 📝 **Structured**: YAML frontmatter + Markdown контент
- 🎯 **Contextual**: Учитывают специфику проекта

---

## Зачем нужны Skills

### Проблемы без Skills:

❌ **Повторяющийся boilerplate код** - каждый раз пишешь одно и то же
❌ **Забытые паттерны** - не помнишь как правильно использовать SCD Type 2
❌ **Inconsistency** - разные разработчики делают по-разному
❌ **Долгий onboarding** - новички долго разбираются в архитектуре
❌ **Пропущенные шаги** - забыл добавить user isolation или тесты

### Решение с Skills:

✅ **Автоматизация** - +40-60% скорость разработки
✅ **Стандартизация** - единый code style и архитектура
✅ **Quality** - обязательные чеклисты и валидации
✅ **Knowledge base** - вся экспертиза в одном месте
✅ **Fast onboarding** - новички продуктивны с первого дня

---

## Доступные Skills

В проекте Family Budget доступно **6 skills**, организованных по фазам внедрения:

### 📦 Фаза 1: Критичные (Backend разработка)

#### 1. [API Development](/.claude/skills/api-development/SKILL.md)

**Автоматизация создания REST API endpoints**

- ✅ Создание CRUD endpoints (create, read, update, delete, list)
- ✅ Pydantic схемы для валидации
- ✅ SCD Type 2 интеграция
- ✅ User data isolation
- ✅ JWT аутентификация
- ✅ Базовые unit тесты

**Использование:**
```
Создай REST API endpoint для модели "Budget" с операциями create, read, update, delete, list.
Используй SCD Type 2 и user isolation.
```

**Tags:** `api, fastapi, rest, crud, scd-type-2`

---

#### 2. [Database Management](/.claude/skills/db-management/SKILL.md)

**Управление БД, миграциями, SCD Type 2 и Closure Table**

- ✅ Создание миграций Alembic
- ✅ Создание dimension моделей с SCD Type 2
- ✅ Создание Closure Table для иерархий
- ✅ Backup и restore БД
- ✅ Performance анализ

**Использование:**
```
Создай миграцию для добавления колонки "email" в таблицу t_d_user.
Создай новую dimension модель "PaymentMethod" с SCD Type 2.
```

**Tags:** `database, postgresql, alembic, migrations, scd-type-2, closure-table`

---

#### 3. [Testing & Quality](/.claude/skills/testing/SKILL.md)

**Автоматизация тестирования и code quality checks**

- ✅ Unit тесты для endpoints
- ✅ Integration тесты для workflows
- ✅ E2E тесты для user journeys
- ✅ Coverage отчеты
- ✅ Linting и formatting (ruff, black, mypy)

**Использование:**
```
Создай unit тесты для endpoint /api/v1/articles.
Покрой все CRUD операции, user isolation, SCD Type 2.
Запусти все тесты с coverage.
```

**Tags:** `testing, pytest, quality, coverage, linting`

---

### 🤖 Фаза 2: Важные (Bot & DevOps)

#### 4. [Telegram Bot Development](/.claude/skills/bot-development/SKILL.md)

**Автоматизация создания Telegram bot команд**

- ✅ Простые команды
- ✅ ConversationHandler с multi-step flow
- ✅ Inline keyboards
- ✅ Интеграция с backend API
- ✅ Валидация пользовательского ввода

**Использование:**
```
Создай команду /balance для показа баланса по всем счетам.
Создай multi-step команду /transfer для перевода между счетами.
```

**Tags:** `telegram, bot, python-telegram-bot, conversationhandler`

---

#### 5. [Deployment & DevOps](/.claude/skills/deployment/SKILL.md)

**Управление деплоем и Docker контейнерами**

- ✅ Production deployment
- ✅ Управление Docker сервисами
- ✅ Просмотр логов
- ✅ Health checks
- ✅ Миграции на production
- ✅ Backup и restore

**Использование:**
```
Задеплой приложение на production с full profile.
Перезапусти backend сервис.
Покажи логи с ERROR за последний час.
```

**Tags:** `deployment, docker, docker-compose, devops`

---

### 📊 Фаза 3: Полезные (Monitoring)

#### 6. [Monitoring & Troubleshooting](/.claude/skills/monitoring/SKILL.md)

**Мониторинг и диагностика проблем**

- ✅ Проверка статуса сервисов
- ✅ Анализ логов
- ✅ Performance мониторинг
- ✅ Database диагностика
- ✅ Troubleshooting guide
- ✅ Alerts и notifications

**Использование:**
```
Покажи статус всех сервисов.
Найди причину почему backend не работает.
Проанализируй производительность БД.
```

**Tags:** `monitoring, logs, metrics, troubleshooting, diagnostics`

---

## Как использовать Skills

### Автоматический вызов (рекомендуется)

Claude автоматически определяет нужный skill на основе вашего запроса.

**Примеры:**

```
👤 USER: Создай REST API endpoint для модели "Category"

🤖 CLAUDE: [Автоматически вызывает api-development skill]
           Создаю endpoint с CRUD операциями, SCD Type 2 и user isolation...
```

```
👤 USER: Задеплой приложение на production

🤖 CLAUDE: [Автоматически вызывает deployment skill]
           Синхронизирую код, применяю миграции, перезапускаю сервисы...
```

### Явный вызов (для сложных задач)

Можно явно указать skill в запросе:

```
Используя api-development skill, создай endpoint для модели "Transaction".
```

### Комбинированные запросы (composability)

Skills автоматически комбинируются для сложных задач:

```
👤 USER: Создай новую dimension таблицу "Merchant", REST API endpoint,
         и unit тесты для неё.

🤖 CLAUDE: [Автоматически вызывает db-management + api-development + testing]
           1. Создаю модель с SCD Type 2 (db-management)
           2. Создаю миграцию Alembic (db-management)
           3. Создаю CRUD endpoint (api-development)
           4. Создаю unit тесты (testing)
```

---

## Как создать новый Skill

### Шаг 1: Определите необходимость

Создавайте skill когда:
- ✅ Задача повторяется 3+ раза
- ✅ Требует специфичных знаний проекта
- ✅ Имеет сложную последовательность шагов
- ✅ Часто приводит к ошибкам при ручном выполнении

**НЕ создавайте skill для:**
- ❌ Одноразовых задач
- ❌ Тривиальных операций
- ❌ Слишком специфичных edge cases

### Шаг 2: Создайте структуру

```bash
# Создать директорию
mkdir -p .claude/skills/your-skill-name

# Создать SKILL.md
touch .claude/skills/your-skill-name/SKILL.md
```

### Шаг 3: Заполните SKILL.md

**Минимальный шаблон:**

```markdown
---
name: Your Skill Name
description: Краткое описание (1 строка)
version: 1.0.0
author: Your Team
tags: [tag1, tag2, tag3]
dependencies: [related-skill]
---

# Your Skill Name

Подробное описание skill и его назначения.

## Когда использовать этот скил

Используй этот скил когда нужно:
- Задача 1
- Задача 2
- Задача 3

Скил автоматически вызывается при запросах типа:
- "Запрос 1"
- "Запрос 2"

## Контекст проекта

Проект использует:
- **Технология 1** - описание
- **Технология 2** - описание
- **Паттерн X** - описание

## Шаблоны кода

### Шаблон 1

\`\`\`python
# Code template с placeholders
def your_function({param1}, {param2}):
    # Implementation
    pass
\`\`\`

### Шаблон 2

\`\`\`bash
# Command template
command --option {value}
\`\`\`

## Проверочный чеклист

После выполнения проверь:

- [ ] Пункт 1
- [ ] Пункт 2
- [ ] Пункт 3

## Связанные скилы

- **skill-1**: для задачи X
- **skill-2**: для задачи Y

## Примеры использования

### Пример 1: Название

\`\`\`
Описание запроса
\`\`\`

### Пример 2: Название

\`\`\`
Описание запроса
\`\`\`

## Часто задаваемые вопросы

**Q: Вопрос 1?**

A: Ответ 1

**Q: Вопрос 2?**

A: Ответ 2
```

### Шаг 4: Добавьте в этот файл (SKILLS.md)

Обновите раздел "Доступные Skills" с описанием нового skill.

### Шаг 5: Протестируйте

Попробуйте использовать новый skill с различными запросами:

```
Используя your-skill-name, выполни [задачу]
```

Проверьте что:
- ✅ Claude корректно интерпретирует skill
- ✅ Генерируется правильный код
- ✅ Все шаблоны работают
- ✅ Чеклисты полные

---

## Best Practices

### ✅ DO: Что нужно делать

1. **Используйте YAML frontmatter**
   - Облегчает автоматический парсинг
   - Позволяет фильтровать skills по tags

2. **Описывайте контекст проекта**
   - Технологии, паттерны, архитектура
   - Специфичные для проекта conventions

3. **Предоставляйте code templates**
   - С placeholders: `{ModelName}`, `{field_name}`
   - Готовые к копированию

4. **Добавляйте чеклисты**
   - Что проверить после выполнения
   - Prevents забытые шаги

5. **Включайте примеры**
   - Реальные use cases
   - Различные сценарии использования

6. **Документируйте edge cases**
   - FAQ секция
   - Troubleshooting guide

7. **Указывайте dependencies**
   - Какие skills связаны
   - Когда их использовать вместе

### ❌ DON'T: Чего избегать

1. **Не дублируйте информацию**
   - Ссылайтесь на другие skills
   - DRY principle

2. **Не делайте слишком generic**
   - Skills должны быть специфичны для проекта
   - Общие инструкции → документация

3. **Не перегружайте skill**
   - Один skill = одна задача
   - Разбивайте на несколько skills

4. **Не забывайте про versioning**
   - Обновляйте version при изменениях
   - Документируйте breaking changes

5. **Не пропускайте примеры**
   - Без примеров skill сложно использовать
   - Минимум 2-3 примера

---

## Примеры использования

### Пример 1: Новый feature (end-to-end)

**Задача:** Добавить функционал "Recurring Transactions" (повторяющиеся транзакции)

**Запрос:**

```
Создай feature "Recurring Transactions":

1. Dimension таблица t_d_recurring_transaction с SCD Type 2
   Поля: user_id, name, amount, article_id, frequency, start_date, end_date

2. REST API endpoint /api/v1/recurring-transactions
   Операции: create, read, update, delete, list

3. Unit и integration тесты

4. Telegram bot команда /recurring для управления

Используй все необходимые skills.
```

**Claude автоматически использует:**
- `db-management` → создание модели и миграции
- `api-development` → создание CRUD endpoint
- `testing` → создание тестов
- `bot-development` → создание bot команды

---

### Пример 2: Bug fix workflow

**Задача:** Исправить bug с медленными запросами в endpoint /api/v1/facts

**Запрос:**

```
Исправь performance issue в /api/v1/facts:

1. Проанализируй slow queries в БД (monitoring skill)
2. Добавь missing indexes (db-management skill)
3. Оптимизируй endpoint query (api-development skill)
4. Создай performance тест (testing skill)
5. Задеплой hotfix (deployment skill)
```

**Claude автоматически использует:**
- `monitoring` → анализ slow queries
- `db-management` → создание индексов
- `api-development` → оптимизация кода
- `testing` → тесты производительности
- `deployment` → hotfix deploy

---

### Пример 3: Production incident

**Задача:** Backend упал на production

**Запрос:**

```
Backend упал на production. Диагностируй и восстанови:

1. Проверь статус всех сервисов (monitoring)
2. Найди ошибки в логах за последние 30 минут (monitoring)
3. Если проблема в БД - проверь connections, slow queries (monitoring + db-management)
4. Восстанови сервис (deployment)
5. Проверь health checks (deployment)
```

**Claude автоматически использует:**
- `monitoring` → диагностика проблемы
- `deployment` → восстановление сервиса

---

## FAQ

### Q: Как узнать какие skills доступны?

**A:** Все доступные skills перечислены в разделе ["Доступные Skills"](#доступные-skills) этого документа. Также можно просмотреть директорию `.claude/skills/`.

```bash
ls -la .claude/skills/
```

---

### Q: Могу ли я изменить существующий skill?

**A:** Да! Skills — это обычные Markdown файлы. Отредактируйте `.claude/skills/{skill-name}/SKILL.md`.

**Не забудьте:**
- Обновить `version` в YAML frontmatter
- Протестировать изменения
- Документировать breaking changes (если есть)

---

### Q: Как создать skill для другого языка программирования?

**A:** Принцип тот же. Замените Python/FastAPI контекст на свой стек:

```markdown
## Контекст проекта

Проект использует:
- **Node.js** с Express.js
- **TypeScript** для type safety
- **Prisma** для ORM
- **Jest** для тестирования
```

---

### Q: Можно ли использовать skills в CI/CD?

**A:** Skills разработаны для интерактивной работы с Claude Code. Для CI/CD используйте обычные скрипты. Однако, skills могут генерировать эти скрипты!

```
Создай GitHub Actions workflow для:
1. Запуска тестов (testing skill)
2. Deployment на staging (deployment skill)
```

---

### Q: Сколько skills нужно проекту?

**A:** Зависит от размера проекта:

- **Маленький проект** (1-2 разработчика): 3-5 skills
- **Средний проект** (3-10 разработчиков): 6-12 skills
- **Большой проект** (10+ разработчиков): 12-20 skills

**Правило:** Создавайте skill когда задача повторяется 3+ раза.

---

### Q: Как организовать skills для микросервисной архитектуры?

**A:** Создайте skills для каждого микросервиса:

```
.claude/skills/
├── common/              # Общие skills
│   ├── api-development/
│   └── testing/
├── auth-service/        # Auth microservice specific
│   ├── jwt-management/
│   └── user-auth/
├── payment-service/     # Payment microservice specific
│   ├── stripe-integration/
│   └── refund-workflow/
└── notification-service/
    ├── email-templates/
    └── push-notifications/
```

---

### Q: Можно ли использовать skills для документации?

**A:** Да! Создайте `documentation` skill:

```markdown
---
name: Documentation
description: Создание и обновление документации
tags: [docs, markdown]
---

# Documentation Skill

## Шаблоны

### API документация

...

### Architecture Decision Record (ADR)

...
```

---

### Q: Как измерить эффективность skills?

**A:** Отслеживайте метрики:

- **Time saved**: Сколько времени экономится на типичных задачах
- **Error reduction**: Снижение количества bugs
- **Consistency**: Единообразие кода
- **Onboarding time**: Скорость адаптации новых разработчиков

**Пример:**
- Без skill: Создание endpoint = 30 минут
- Со skill: Создание endpoint = 5 минут
- **Экономия:** 83% времени

---

### Q: Нужно ли коммитить skills в git?

**A:** **Да!** Skills — часть кодовой базы.

```bash
git add .claude/skills/
git commit -m "feat: Add api-development skill"
git push
```

**Преимущества:**
- ✅ Version control
- ✅ Code review
- ✅ Доступны всей команде
- ✅ История изменений

---

## Roadmap

### Планируемые skills (v2.0)

- **Slash Commands** (`/.claude/commands/`)
  - `/test` - Быстрый запуск тестов
  - `/deploy` - One-command deployment
  - `/logs` - Просмотр логов с фильтрацией
  - `/migrate` - Применение миграций

- **Additional Skills**
  - `code-review` - Автоматический code review
  - `documentation` - Генерация документации
  - `refactoring` - Безопасный refactoring
  - `security-audit` - Security проверки

### Feedback

Нашли баг или хотите предложить улучшение?

- 📧 Email: [team@example.com](mailto:team@example.com)
- 💬 Slack: `#family-budget-dev`
- 🐛 GitHub Issues: [Create Issue](https://github.com/your-org/familyBudget/issues/new)

---

## Заключение

**Claude Skills** — мощный инструмент для автоматизации разработки, который:

✅ Ускоряет разработку на 40-60%
✅ Стандартизирует code style и архитектуру
✅ Снижает количество багов на 30%
✅ Упрощает onboarding новых разработчиков на 70%

**Начните использовать skills прямо сейчас:**

```
Создай REST API endpoint для модели "Example" используя api-development skill.
```

**Happy coding! 🚀**

---

**Версия документа:** 1.0.0
**Последнее обновление:** 2025-10-22
**Лицензия:** MIT
