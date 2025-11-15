# 16. Changelog & Release Management

## Быстрый старт

После завершения задачи ОБЯЗАТЕЛЬНО подготовьте changelog entry в следующем формате:

```markdown
### [Категория] Краткое описание

**Изменения:**
- Что было добавлено/изменено/исправлено

**Влияние на пользователей:**
[Что изменится для пользователя]

**Технические детали:**
- Файлы: `[измененные файлы]`
- PRD: [секция PRD]
- Commits: [hash коммитов]

**Breaking Changes:** [если есть]
```

## Категории

| Категория | Prefix | Описание |
|-----------|--------|----------|
| **Features** | `feat:` | Новая функциональность |
| **Bug Fixes** | `fix:` | Исправления ошибок |
| **Performance** | `perf:` | Оптимизация производительности |
| **Refactoring** | `refactor:` | Рефакторинг без изменения функциональности |
| **Documentation** | `docs:` | Только документация |
| **Infrastructure** | `chore:` | DevOps, CI/CD, deployment |

## Эмодзи для changelog

- ✨ Новая функциональность
- 🔧 Изменения существующего
- 🐛 Исправления ошибок
- 📝 Обновления документации
- ⚡ Улучшение производительности
- 🔒 Безопасность
- 💥 Breaking changes

## Когда создавать GitHub Release

**Releases создаются вручную при:**
1. Завершении крупной фичи (milestone)
2. Накоплении нескольких важных изменений
3. Релизе новой версии

**Процесс:**
1. Собрать все changelog entries с последнего релиза
2. GitHub → Releases → Draft a new release
3. Создать тег версии (v1.2.0)
4. Скопировать changelog entries, сгруппировать по категориям
5. Publish release

## Semver правила

- **MAJOR (v2.0.0)** - breaking changes (несовместимые изменения API)
- **MINOR (v1.2.0)** - новая функциональность (backward compatible)
- **PATCH (v1.2.1)** - bug fixes (исправления без новых фич)

## Пример changelog entry

```markdown
### Features
#### ✨ Добавлен фильтр по финансовым центрам в аналитике

**Изменения:**
- Добавлен dropdown "Финансовый центр" в фильтры аналитики
- Бэкенд эндпоинт фильтрует транзакции по выбранному ФЦ
- UI показывает выбранный ФЦ в хлебных крошках

**Влияние на пользователей:**
Пользователи теперь могут фильтровать статистику расходов/доходов по конкретному финансовому центру (банковская карта, наличные, электронный кошелек).

**Технические детали:**
- Файлы: `frontend/web/static/js/analytics.js`, `backend/app/api/v1/endpoints/analytics.py`, `frontend/web/templates/analytics.html`
- PRD: FR-045
- Commits: 5d238d1c, 547ba7e3

**Breaking Changes:** Нет
```

## Где хранить changelog entries до Release

**Вариант 1 (Рекомендуется):** В Pull Request description
- При создании PR включите changelog entry в описание
- При мердже в main - скопируете в Draft Release

**Вариант 2:** В коммит сообщениях
- Используйте Conventional Commits формат
- GitHub может автоматически генерировать Release Notes

**Вариант 3:** В Draft Release
- Сразу добавляйте entry в Draft Release в GitHub
- При накоплении достаточного количества - публикуйте

## Автоматизация через GitHub Actions (НАСТРОЕНО ✓)

**Release Drafter уже настроен в проекте!** Он автоматически генерирует changelog из Pull Requests.

### Как это работает

1. **При создании/обновлении PR:**
   - GitHub Actions запускает Release Drafter
   - PR анализируется по labels
   - Автоматически обновляется Draft Release

2. **Автоматическое определение версии:**
   - `major`, `breaking` → v2.0.0 (breaking changes)
   - `feature`, `minor` → v1.3.0 (новая функциональность)
   - `fix`, `patch` → v1.2.1 (исправления)

3. **Автоматическое добавление labels:**
   - Ветка `feat/*` → label `feature`
   - Ветка `fix/*` → label `fix`
   - Ветка `docs/*` → label `documentation`

### Обязательные PR Labels

**ВАЖНО:** Каждый PR ДОЛЖЕН иметь хотя бы один label из категорий:

| Label | Категория | Использование |
|-------|-----------|---------------|
| `feature`, `enhancement`, `feat` | ✨ Features | Новая функциональность |
| `fix`, `bugfix`, `bug` | 🐛 Bug Fixes | Исправления ошибок |
| `performance`, `perf` | ⚡ Performance | Оптимизация |
| `refactor`, `refactoring` | 🔧 Refactoring | Рефакторинг |
| `documentation`, `docs` | 📝 Documentation | Документация |
| `infrastructure`, `chore`, `ci` | 🚀 Infrastructure | DevOps, CI/CD |
| `security` | 🔒 Security | Безопасность |
| `breaking`, `major` | ⚠️ Breaking Changes | Критичные изменения |

### Workflow для разработчиков

**Шаг 1: Создайте ветку с правильным префиксом**
```bash
git checkout -b feat/my-feature   # → автоматически label "feature"
git checkout -b fix/bug-123       # → автоматически label "fix"
git checkout -b docs/update-guide # → автоматически label "documentation"
```

**Шаг 2: Создайте PR с Conventional Commits заголовком**
```bash
gh pr create --title "feat: Add analytics filter" --label feature,minor
```

**Шаг 3: Release Drafter автоматически:**
- Создаст/обновит Draft Release
- Добавит ваш PR в соответствующую категорию
- Определит версию по labels

**Шаг 4: После накопления изменений - публикуйте Release**
1. GitHub → Releases → Draft releases
2. Проверьте автоматически сгенерированный changelog
3. Отредактируйте при необходимости
4. Publish release

### Конфигурация Release Drafter

**Файлы:**
- `.github/release-drafter.yml` - конфигурация категорий и версий
- `.github/workflows/release-drafter.yml` - GitHub Actions workflow

**Документация:**
- `docs/PR_LABELS_GUIDE.md` - подробное руководство по labels

### Примеры

**Пример PR:**
```yaml
Title: "feat: Add financial center filter to analytics"
Labels: feature, minor
Branch: feat/analytics-fc-filter

→ Автоматический changelog entry:
### ✨ Features
- feat: Add financial center filter to analytics @ikeniborn (#42)

→ Version: 1.2.0 → 1.3.0
```

**Проверить Draft Release:**
```bash
# Через браузер
https://github.com/ikeniborn/familyBudget/releases

# Через gh CLI
gh release list --exclude-drafts=false
```

## Полезные ссылки

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
- [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github)
- [Release Drafter](https://github.com/release-drafter/release-drafter) - автоматизация changelog
- [Keep a Changelog](https://keepachangelog.com/) - стандарт формата changelog
