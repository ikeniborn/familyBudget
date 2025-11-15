# Pull Request Labels - Руководство

## Автоматическая генерация Changelog

В проекте настроен **Release Drafter** - он автоматически создает Draft Release с changelog на основе Pull Requests и их labels.

## Обязательные Labels для PR

**ВАЖНО:** Каждый PR ДОЛЖЕН иметь хотя бы один label из категорий ниже.

### Категории и Labels

#### ✨ Features (Новая функциональность)
- `feature` - новая функциональность
- `enhancement` - улучшение существующей функциональности
- `feat` - краткий вариант (автоматически добавляется для веток `feat/*`)

**Когда использовать:**
- Добавление новой страницы/экрана
- Новый API endpoint
- Новый UI компонент
- Новая бизнес-логика

#### 🐛 Bug Fixes (Исправления ошибок)
- `fix` - исправление бага
- `bugfix` - альтернативное название
- `bug` - краткий вариант (автоматически для веток `fix/*`)

**Когда использовать:**
- Исправление неработающей функциональности
- Исправление некорректного поведения
- Устранение ошибок валидации

#### ⚡ Performance (Производительность)
- `performance` - оптимизация производительности
- `perf` - краткий вариант (автоматически для веток `perf/*`)

**Когда использовать:**
- Оптимизация запросов к БД
- Уменьшение размера bundle
- Кэширование
- Улучшение времени отклика

#### 🔧 Refactoring (Рефакторинг)
- `refactor` - рефакторинг без изменения функциональности
- `refactoring` - альтернативное название (автоматически для веток `refactor/*`)

**Когда использовать:**
- Улучшение структуры кода
- Переименование переменных/функций
- Разделение больших функций
- Удаление дублирования

#### 📝 Documentation (Документация)
- `documentation` - изменения в документации
- `docs` - краткий вариант (автоматически для веток `docs/*`)

**Когда использовать:**
- Обновление README, PRD, CLAUDE.md
- Добавление комментариев в код
- Создание новых гайдов
- Исправление опечаток в документации

#### 🚀 Infrastructure (Инфраструктура)
- `infrastructure` - изменения инфраструктуры
- `chore` - технические изменения (автоматически для веток `chore/*`)
- `ci` - CI/CD изменения
- `deployment` - деплоймент конфигурация

**Когда использовать:**
- Обновление Docker конфигурации
- Изменения в deploy.sh
- Настройка GitHub Actions
- Обновление зависимостей

#### 🔒 Security (Безопасность)
- `security` - исправления безопасности

**Когда использовать:**
- Устранение уязвимостей
- Обновление небезопасных зависимостей
- Улучшение аутентификации/авторизации
- Валидация пользовательского ввода

#### ⚠️ Breaking Changes (Критичные изменения)
- `breaking` - breaking changes
- `breaking-change` - альтернативное название
- `major` - требует major версии

**Когда использовать:**
- Удаление публичных API endpoints
- Изменение формата API ответов
- Удаление функциональности
- Несовместимые изменения БД

## Version Labels (Semver)

Release Drafter автоматически определяет версию по labels:

| Label | Версия | Пример | Когда |
|-------|--------|--------|-------|
| `major`, `breaking` | MAJOR | 1.0.0 → 2.0.0 | Breaking changes |
| `minor`, `feature`, `enhancement` | MINOR | 1.0.0 → 1.1.0 | Новая функциональность |
| `patch`, `fix`, `docs` | PATCH | 1.0.0 → 1.0.1 | Исправления |

**По умолчанию:** PATCH (если нет других labels)

## Exclude Labels (Не попадают в Changelog)

- `skip-changelog` - пропустить в changelog
- `wip` - work in progress (черновик)
- `work-in-progress` - альтернативное название
- `duplicate` - дубликат
- `invalid` - некорректный PR

## Автоматические Labels

Release Drafter автоматически добавляет labels на основе имени ветки:

| Паттерн ветки | Автоматический label |
|---------------|---------------------|
| `feat/*`, `feature/*` | `feature` |
| `fix/*` | `fix` |
| `refactor/*` | `refactor` |
| `docs/*` | `documentation` |
| `chore/*` | `chore` |
| `perf/*` | `performance` |

**Пример:**
```bash
git checkout -b feat/add-analytics-filter
# Создаем PR → автоматически получит label "feature"
```

## Как добавить Labels в PR

### Вариант 1: Через GitHub UI
1. Откройте PR на GitHub
2. Справа найдите секцию "Labels"
3. Нажмите на шестеренку
4. Выберите подходящие labels

### Вариант 2: Через GitHub CLI
```bash
gh pr create --label feature,minor
gh pr edit 123 --add-label bugfix
```

### Вариант 3: Автоматически через имя ветки
```bash
git checkout -b feat/my-feature  # → автоматически "feature"
git checkout -b fix/bug-123      # → автоматически "fix"
```

## Примеры

### Пример 1: Новая функциональность
```yaml
PR Title: "feat: Add financial center filter to analytics"
Labels: feature, minor
Branch: feat/analytics-fc-filter

→ Changelog entry:
### ✨ Features
- feat: Add financial center filter to analytics @ikeniborn (#42)

→ Version bump: 1.2.0 → 1.3.0 (MINOR)
```

### Пример 2: Исправление бага
```yaml
PR Title: "fix: Correct date validation in budget form"
Labels: fix, patch
Branch: fix/date-validation

→ Changelog entry:
### 🐛 Bug Fixes
- fix: Correct date validation in budget form @ikeniborn (#43)

→ Version bump: 1.2.0 → 1.2.1 (PATCH)
```

### Пример 3: Breaking Change
```yaml
PR Title: "refactor!: Remove deprecated /api/v1/old-endpoint"
Labels: breaking, major, refactor
Branch: refactor/remove-deprecated-api

→ Changelog entry:
### 🔧 Refactoring
- refactor!: Remove deprecated /api/v1/old-endpoint @ikeniborn (#44)

→ Version bump: 1.2.1 → 2.0.0 (MAJOR)
```

### Пример 4: Множественные категории
```yaml
PR Title: "feat: Add caching to analytics queries (performance boost)"
Labels: feature, performance, minor
Branch: feat/analytics-caching

→ Changelog entries:
### ✨ Features
- feat: Add caching to analytics queries (performance boost) @ikeniborn (#45)

### ⚡ Performance
- feat: Add caching to analytics queries (performance boost) @ikeniborn (#45)

→ Version bump: 2.0.0 → 2.1.0 (MINOR)
```

## Workflow

### 1. Создание ветки
```bash
git checkout -b feat/my-feature master
```

### 2. Коммиты (Conventional Commits)
```bash
git commit -m "feat: Add new feature"
git commit -m "test: Add tests for new feature"
```

### 3. Создание PR
```bash
git push origin feat/my-feature
gh pr create --title "feat: Add new feature" --label feature,minor
```

### 4. Автоматика
- GitHub Actions запускает Release Drafter
- Создается/обновляется Draft Release
- PR entry добавляется в соответствующую категорию

### 5. После мерджа
- Draft Release обновляется
- Можно опубликовать Release вручную когда накопится достаточно изменений

## Проверка Draft Release

1. Перейти в репозиторий на GitHub
2. Releases → Draft releases
3. Посмотреть автоматически сгенерированный changelog
4. При необходимости отредактировать вручную
5. Опубликовать Release с тегом версии

## Best Practices

✅ **DO:**
- Добавляйте label сразу при создании PR
- Используйте Conventional Commits в заголовках PR
- Добавляйте несколько labels если PR охватывает разные категории
- Используйте `breaking` label для несовместимых изменений

❌ **DON'T:**
- Не создавайте PR без labels
- Не используйте `skip-changelog` для важных изменений
- Не забывайте про `major`/`minor`/`patch` labels для контроля версии

## Ссылки

- [Release Drafter Documentation](https://github.com/release-drafter/release-drafter)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
- [GitHub Labels](https://docs.github.com/en/issues/using-labels-and-milestones-to-track-work/managing-labels)
