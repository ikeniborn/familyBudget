# GitHub Changelog - Краткая справка

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

## Автоматизация через GitHub Actions (опционально)

Для автоматической генерации changelog из PR можно использовать **Release Drafter**:

1. Создайте файл `.github/release-drafter.yml`:

```yaml
name-template: 'v$RESOLVED_VERSION'
tag-template: 'v$RESOLVED_VERSION'
categories:
  - title: '✨ Features'
    labels:
      - 'feature'
      - 'enhancement'
  - title: '🐛 Bug Fixes'
    labels:
      - 'fix'
      - 'bugfix'
  - title: '📝 Documentation'
    labels:
      - 'documentation'
change-template: '- $TITLE @$AUTHOR (#$NUMBER)'
version-resolver:
  major:
    labels:
      - 'major'
  minor:
    labels:
      - 'minor'
  patch:
    labels:
      - 'patch'
  default: patch
template: |
  ## Changes

  $CHANGES
```

2. Создайте workflow `.github/workflows/release-drafter.yml`:

```yaml
name: Release Drafter

on:
  push:
    branches:
      - master
  pull_request:
    types: [opened, reopened, synchronize]

permissions:
  contents: read

jobs:
  update_release_draft:
    permissions:
      contents: write
      pull-requests: write
    runs-on: ubuntu-latest
    steps:
      - uses: release-drafter/release-drafter@v5
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

3. Добавляйте labels к PR (feature, fix, documentation и т.д.)
4. Release Drafter автоматически создаст Draft Release с changelog

## Полезные ссылки

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
- [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github)
- [Release Drafter](https://github.com/release-drafter/release-drafter) - автоматизация changelog
- [Keep a Changelog](https://keepachangelog.com/) - стандарт формата changelog
